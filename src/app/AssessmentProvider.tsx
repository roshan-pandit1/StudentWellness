import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { AssessmentValues } from '@/features/assessment/types'
import type { AssessmentResult } from '@/features/results/types'
import { AssessmentContext } from './assessment-context'
export function AssessmentProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Partial<AssessmentValues>>({})
  const [step, setStep] = useState(0)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const saveDraft = useCallback((values: Partial<AssessmentValues>, currentStep: number) => {
    setDraft(values); setStep(currentStep)
  }, [])
  const reset = useCallback(() => { setDraft({}); setStep(0); setResult(null) }, [])
  const value = useMemo(() => ({ draft, step, result, saveDraft, setResult, reset }), [draft, step, result, saveDraft, reset])
  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>
}
