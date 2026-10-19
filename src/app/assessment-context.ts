import { createContext } from 'react'
import type { AssessmentValues } from '@/features/assessment/types'
import type { AssessmentResult } from '@/features/results/types'
export interface AssessmentState {
  draft: Partial<AssessmentValues>;
  step: number;
  result: AssessmentResult | null;
  saveDraft: (draft: Partial<AssessmentValues>, step: number) => void;
  setResult: (result: AssessmentResult) => void;
  reset: () => void;
}
export const AssessmentContext = createContext<AssessmentState | null>(null)
