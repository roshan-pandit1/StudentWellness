import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { createInterface } from 'node:readline'
import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AssessmentProvider } from '@/app/AssessmentProvider'
import { Layout } from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'
import AssessmentPage from '@/pages/AssessmentPage'
import ResultsPage from '@/pages/ResultsPage'
import { predictionResponseSchema } from '@/services/modelContract'
import payload from '../../backend/tests/example_request.json'

// No graphical browser is available here. Only chart sizing is replaced; all form,
// routing, service, response validation, FastAPI and model code run for real.
vi.mock('@/features/results/components/HabitChart', () => ({ HabitChart: () => <div>Chart sizing requires browser QA</div> }))
let backend: ChildProcessWithoutNullStreams
let sequence = 0
const pending = new Map<number, { resolve: (value: Response) => void; reject: (error: Error) => void }>()

beforeAll(async () => {
  const executable = process.env.WELLNESS_TEST_PYTHON
  if (!executable) throw new Error('Set WELLNESS_TEST_PYTHON to a Python interpreter with backend/requirements-dev.txt installed.')
  backend = spawn(executable, ['-u', '-m', 'tests.asgi_bridge'], {
    cwd: resolve('backend'), env: { ...process.env, WELLNESS_CORS_ORIGINS: '[]' }, stdio: 'pipe',
  })
  await new Promise<void>((resolveReady, rejectReady) => {
    const deadline = setTimeout(() => { backend.kill(); rejectReady(new Error('Backend startup timed out')) }, 15_000)
    backend.once('error', rejectReady)
    backend.once('exit', () => {
      clearTimeout(deadline)
      rejectReady(new Error('Backend test process exited. Check Python dependencies and model artifacts.'))
      for (const request of pending.values()) request.reject(new Error('Backend transport closed'))
      pending.clear()
    })
    // Drain diagnostics without echoing potentially sensitive exception content.
    backend.stderr.resume()
    createInterface({ input: backend.stdout }).on('line', line => {
      const message = JSON.parse(line)
      if ('ready' in message) {
        clearTimeout(deadline)
        if (message.ready) resolveReady()
        else rejectReady(new Error('Backend model failed readiness'))
      } else {
        pending.get(message.id)?.resolve(new Response(JSON.stringify(message.body), { status: message.status, headers: { 'Content-Type': 'application/json' } }))
        pending.delete(message.id)
      }
    })
  })
}, 20_000)

afterAll(() => { backend?.stdin.end(); backend?.kill() })

function asgiFetch(url: string | URL | Request, init?: RequestInit): Promise<Response> {
  const id = ++sequence
  return new Promise((resolveResponse, reject) => {
    const abort = () => { pending.delete(id); reject(new DOMException('Aborted', 'AbortError')) }
    if (init?.signal?.aborted) { abort(); return }
    init?.signal?.addEventListener('abort', abort, { once: true })
    pending.set(id, {
      resolve: response => { init?.signal?.removeEventListener('abort', abort); resolveResponse(response) },
      reject,
    })
    backend.stdin.write(JSON.stringify({ id, path: new URL(String(url)).pathname, method: init?.method || 'GET', body: init?.body }) + '\n')
  })
}

describe('React → FastAPI → exported model integration (ASGI transport)', () => {
  it('completes landing → four steps → failed send → retry → real prediction → retake', async () => {
    vi.stubEnv('VITE_ASSESSMENT_MODE', 'live')
    vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    let failNextPrediction = true
    let responseBody: unknown
    let submittedBody: unknown
    const fetchSpy = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/predict')) {
        if (failNextPrediction) { failNextPrediction = false; throw new TypeError('Simulated connection interruption') }
        submittedBody = JSON.parse(String(init?.body))
        const response = await asgiFetch(url, init)
        responseBody = await response.clone().json()
        return response
      }
      return asgiFetch(url, init)
    })
    vi.stubGlobal('fetch', fetchSpy)
    render(<AssessmentProvider><MemoryRouter><Routes><Route element={<Layout />}>
      <Route index element={<HomePage />} /><Route path="assessment" element={<AssessmentPage />} />
      <Route path="results" element={<ResultsPage />} />
    </Route></Routes></MemoryRouter></AssessmentProvider>)
    const user = userEvent.setup()
    expect(screen.getByRole('heading', { level: 1, name: /Understand Your Habits/ })).toBeVisible()
    await user.click(screen.getByRole('link', { name: /Start Your Assessment/ }))
    await user.type(screen.getByLabelText('Age'), String(payload.Age))
    await user.selectOptions(screen.getByLabelText('Gender'), payload.Gender)
    await user.type(screen.getByLabelText('Country'), payload.Country)
    await user.selectOptions(screen.getByLabelText('Academic level'), payload.Academic_Level)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Next step' })).toBeEnabled())
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.type(await screen.findByLabelText('Most used platform'), payload.Most_Used_Platform)
    await user.selectOptions(screen.getByLabelText('Main purpose of social media use'), payload.Purpose_Of_Use)
    await user.type(screen.getByLabelText('Average daily social media usage'), String(payload.Avg_Daily_Usage_Hours))
    await user.type(screen.getByLabelText('Daily phone unlocks'), String(payload.Daily_Unlocks))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.type(await screen.findByLabelText('Study hours per day'), String(payload.Study_Hours))
    await user.type(screen.getByLabelText('Physical activity hours per day'), String(payload.Physical_Activity_Hours))
    await user.type(screen.getByLabelText('Sleep hours per night'), String(payload.Sleep_Hours_Per_Night))
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    await user.selectOptions(await screen.findByLabelText('Self-reported stress level'), payload.Stress_Level)
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'Send & view insights' }))
    expect(await screen.findByText(/Could not reach the backend/)).toBeVisible()
    expect(screen.queryByText('Demo result — not a real prediction.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry prediction' }))
    expect(await screen.findByRole('heading', { name: 'Here’s your everyday snapshot.' })).toBeVisible()
    const actual = predictionResponseSchema.parse(responseBody)
    expect(submittedBody).toEqual(payload)
    expect(actual.Mental_Health_Score).toBeGreaterThanOrEqual(actual.score_reference.observed_min)
    expect(actual.Mental_Health_Score).toBeLessThanOrEqual(actual.score_reference.observed_max)
    expect(within(screen.getByRole('img', { name: /Estimated wellness indicator/ })).getByText(actual.Mental_Health_Score.toFixed(1), { selector: 'strong' })).toBeVisible()
    expect(screen.getByText(`Model: ${actual.model_version}`)).toBeVisible()
    expect(screen.getByText(actual.disclaimer)).toBeVisible()
    expect(screen.queryByText('Demo result — not a real prediction.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('link', { name: 'Retake Assessment' }))
    expect(await screen.findByLabelText('Age')).toHaveValue(null)
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1')
  }, 20_000)
})
