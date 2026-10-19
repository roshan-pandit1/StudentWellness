import { RouterProvider } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AssessmentProvider } from '@/app/AssessmentProvider'
import { router } from '@/app/router'
import { ErrorBoundary } from '@/components/shared/ErrorBoundary'
export default function App() {
  return <ErrorBoundary><MotionConfig reducedMotion="user"><AssessmentProvider><RouterProvider router={router} /></AssessmentProvider></MotionConfig></ErrorBoundary>
}
