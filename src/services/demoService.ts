import type { AssessmentValues } from '@/features/assessment/types'
import type { AssessmentResult } from '@/features/results/types'

export async function getDemoResult(answers: AssessmentValues): Promise<AssessmentResult> {
  // Intentionally fixed, never calculated from a person's identity or habits.
  return { mode: 'demo', score: 7.2, answers: { ...answers } }
}
