import type { AssessmentValues } from '../assessment/types'
import type { ScoreReference } from '@/services/modelContract'
type BaseResult = { score: number; answers: AssessmentValues }
export type AssessmentResult = BaseResult & (
  | { mode: 'demo' }
  | { mode: 'live'; modelVersion: string; disclaimer: string; scoreReference: ScoreReference; warnings: string[] }
)
