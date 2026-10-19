import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchModelInfo, getServiceConfig, submitAssessment } from '@/services/assessmentService'
import { validAnswers } from './fixtures'
import predictionExample from '../contracts/prediction-example.json'
import modelInfo from '../contracts/model-info.json'
import { getSupportIssues, modelInfoSchema } from '@/services/modelContract'

const live = { mode: 'live' as const, baseUrl: 'http://localhost:8000' }
afterEach(() => { vi.useRealTimers() })
describe('assessment service', () => {
  it('makes no request in demo mode and returns an explicitly tagged fixed sample', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    expect(await submitAssessment(validAnswers, { mode: 'demo' })).toMatchObject({ mode: 'demo', score: 7.2, answers: validAnswers })
    expect(await submitAssessment({ ...validAnswers, Gender: 'Another identity' }, { mode: 'demo' })).toMatchObject({ mode: 'demo', score: 7.2 })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('defaults to demo and rejects unknown modes', () => {
    vi.stubEnv('VITE_ASSESSMENT_MODE', '')
    expect(getServiceConfig().mode).toBe('demo')
    vi.stubEnv('VITE_ASSESSMENT_MODE', 'typo')
    expect(() => getServiceConfig()).toThrow('Invalid application mode')
  })
  it('validates before making any request', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(submitAssessment({ ...validAnswers, acknowledgment: false }, live)).rejects.toMatchObject({ kind: 'validation' })
    await expect(submitAssessment({ ...validAnswers, Gender: 'Prefer not to say' }, live)).rejects.toThrow('will not be recoded')
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(['', 'ftp://example.com', 'http://example.com', 'https://user:pass@example.com', 'https://example.com?key=secret'])('rejects unsafe or invalid URL %s', async baseUrl => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(submitAssessment(validAnswers, { ...live, baseUrl })).rejects.toMatchObject({ kind: 'configuration' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('posts the exact model contract and consumes a valid response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...predictionExample, Mental_Health_Score: 6.5 }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await submitAssessment(validAnswers, live)
    expect(result).toMatchObject({ score: 6.5, mode: 'live' })
    const { acknowledgment, ...payload } = validAnswers; void acknowledgment
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/predict', expect.objectContaining({ method: 'POST', credentials: 'omit', body: expect.any(String) }))
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(payload)
  })
  it('handles network failures without silently returning a demo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: 'network', message: expect.stringContaining('No demo result') })
  })
  it.each([400, 422, 500, 503])('handles HTTP %i safely', async status => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('private server detail', { status })))
    await expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: status < 500 ? 'validation' : 'server' })
  })
  it.each([{ Mental_Health_Score: '7.2' }, { Mental_Health_Score: 11 }, { Mental_Health_Score: -1 }, { Mental_Health_Score: null }, {}])('rejects unexpected API response %j', async body => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body))))
    await expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: 'response' })
  })
  it('handles malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>')))
    await expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: 'response' })
  })
  it('aborts requests after 15 seconds', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((_resolve, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    })))
    const assertion = expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: 'network', message: expect.stringContaining('timed out') })
    await vi.advanceTimersByTimeAsync(15_000)
    await assertion
  })
})


describe('Phase 2 response compatibility and support information', () => {
  it('consumes a real response captured from the exported backend model', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(predictionExample))))
    const result = await submitAssessment(validAnswers, live)
    expect(result).toMatchObject({ mode: 'live', score: predictionExample.Mental_Health_Score,
      modelVersion: predictionExample.model_version, disclaimer: predictionExample.disclaimer,
      scoreReference: predictionExample.score_reference })
  })
  it.each([-1, 11, 12.345])('does not clamp or impose a fictional scale on %s', async score => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ ...predictionExample, Mental_Health_Score: score }))))
    expect(await submitAssessment(validAnswers, live)).toMatchObject({ mode: 'live', score })
  })
  it('loads supported values without transmitting assessment answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(modelInfo)))
    vi.stubGlobal('fetch', fetchMock)
    expect(await fetchModelInfo(live)).toEqual(modelInfoSchema.parse(modelInfo))
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/model-info', expect.not.objectContaining({ body: expect.anything() }))
  })
  it('rejects missing models and incompatible model information', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 503 })))
    await expect(fetchModelInfo(live)).rejects.toMatchObject({ kind: 'server' })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    await expect(fetchModelInfo(live)).rejects.toMatchObject({ kind: 'response' })
  })
  it('refuses model-info calls in demo mode', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    await expect(fetchModelInfo({ mode: 'demo' })).rejects.toMatchObject({ kind: 'configuration' })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it('flags unsupported categories and out-of-training-range answers without recoding', () => {
    const input = { ...validAnswers, Age: 17, Most_Used_Platform: 'None', Gender: 'Another identity' as const }
    const issues = getSupportIssues(input, modelInfoSchema.parse(modelInfo))
    expect(issues.map(issue => issue.field)).toEqual(expect.arrayContaining(['Age', 'Gender', 'Most_Used_Platform', 'Daily_Unlocks']))
    expect(input.Gender).toBe('Another identity')
  })
})

it('reports a body-read timeout as a timeout rather than malformed JSON', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => Promise.resolve({
    ok: true, status: 200,
    json: () => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))),
  })))
  const assertion = expect(submitAssessment(validAnswers, live)).rejects.toMatchObject({ kind: 'network', message: expect.stringContaining('timed out') })
  await vi.advanceTimersByTimeAsync(15_000)
  await assertion
})
