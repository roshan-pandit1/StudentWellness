import { useContext } from 'react'
import { AssessmentContext } from '@/app/assessment-context'
export function useAssessment() {
  const state = useContext(AssessmentContext)
  if (!state) throw new Error('useAssessment must be used inside AssessmentProvider')
  return state
}
