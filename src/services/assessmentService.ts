import { assessmentSchema, toApiPayload } from '@/features/assessment/schema'
import type { AssessmentValues, StudentAssessment } from '@/features/assessment/types'
import type { AssessmentResult } from '@/features/results/types'
import { getDemoResult } from './demoService'
import { modelInfoSchema, predictionResponseSchema } from './modelContract'

export type ServiceConfig = { mode: 'demo' | 'live'; baseUrl?: string }
export class AssessmentServiceError extends Error {
  constructor(message: string, public readonly kind: 'configuration' | 'validation' | 'network' | 'response' | 'server') {
    super(message)
    this.name = 'AssessmentServiceError'
  }
}
export function getServiceConfig(): ServiceConfig {
  const mode = import.meta.env.VITE_ASSESSMENT_MODE || 'demo'
  if (mode !== 'demo' && mode !== 'live') throw new AssessmentServiceError('Invalid application mode. Set VITE_ASSESSMENT_MODE to demo or live.', 'configuration')
  return { mode, baseUrl: import.meta.env.VITE_API_BASE_URL }
}
function endpoint(baseUrl: string | undefined, path: string): string {
  try {
    const url = new URL(baseUrl || '')
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error()
    if (url.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) throw new Error()
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${path}`
    return url.toString()
  } catch {
    throw new AssessmentServiceError('The backend URL is missing or invalid. Configure VITE_API_BASE_URL with HTTPS (HTTP is allowed for local development).', 'configuration')
  }
}

export async function fetchModelInfo(config: ServiceConfig) {
  if (config.mode !== 'live') throw new AssessmentServiceError('Model information is only requested in live mode.', 'configuration')
  const url = endpoint(config.baseUrl, 'model-info')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error' })
    if (!response.ok) throw new AssessmentServiceError('The model is not ready. No answers have been sent.', 'server')
    const parsed = modelInfoSchema.safeParse(await response.json())
    if (!parsed.success) throw new AssessmentServiceError('The model information is incompatible. No answers have been sent.', 'response')
    return parsed.data
  } catch (error) {
    if (error instanceof AssessmentServiceError) throw error
    throw new AssessmentServiceError('Could not load model support information. No answers have been sent. Check the backend and try again.', 'network')
  } finally { clearTimeout(timeout) }
}

export async function submitAssessment(input: AssessmentValues, config = getServiceConfig()): Promise<AssessmentResult> {
  const parsed = assessmentSchema.safeParse(input)
  if (!parsed.success) throw new AssessmentServiceError('Please check your answers and acknowledge the educational-use notice.', 'validation')
  const answers = parsed.data
  if (config.mode === 'demo') return getDemoResult(answers)

  let payload: StudentAssessment
  try { payload = toApiPayload(answers) }
  catch (error) { throw new AssessmentServiceError(error instanceof Error ? error.message : 'Unsupported model input.', 'validation') }
  const url = endpoint(config.baseUrl, 'predict')
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
    })
    if (response.status === 422 || response.status === 400) {
      // Do not echo an arbitrary server body, which may contain personal data.
      throw new AssessmentServiceError('The backend could not accept these answers. Check the supported categories and ranges, then try again.', 'validation')
    }
    if (!response.ok) throw new AssessmentServiceError('The wellness service is unavailable. Your answers are still here; please try again later.', 'server')
    let body: unknown
    try { body = await response.json() }
    catch {
      if (controller.signal.aborted) throw new AssessmentServiceError('The request timed out while reading the response. Please try again.', 'network')
      throw new AssessmentServiceError('The backend returned an unreadable response. No result was created.', 'response')
    }
    const result = predictionResponseSchema.safeParse(body)
    if (!result.success) throw new AssessmentServiceError('The backend returned an unexpected score. No result was created.', 'response')
    return { mode: 'live', score: result.data.Mental_Health_Score, answers, modelVersion: result.data.model_version, disclaimer: result.data.disclaimer, scoreReference: result.data.score_reference, warnings: result.data.warnings }
  } catch (error) {
    if (error instanceof AssessmentServiceError) throw error
    throw new AssessmentServiceError(controller.signal.aborted ? 'The request timed out. Please try again when the service is available.' : 'Could not reach the backend. Check your connection and try again. No demo result has been substituted.', 'network')
  } finally { clearTimeout(timeout) }
}
