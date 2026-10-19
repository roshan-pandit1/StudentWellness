import { lazy, Suspense } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import HomePage from '@/pages/HomePage'
import AssessmentPage from '@/pages/AssessmentPage'
import AboutPage from '@/pages/AboutPage'
import NotFoundPage from '@/pages/NotFoundPage'
const ResultsPage = lazy(() => import('@/pages/ResultsPage'))
export const router = createBrowserRouter([{ element: <Layout />, children: [
  { index: true, element: <HomePage /> },
  { path: 'assessment', element: <AssessmentPage /> },
  { path: 'results', element: <Suspense fallback={<div className="container empty-page" role="status">Loading your insights…</div>}><ResultsPage /></Suspense> },
  { path: 'about', element: <AboutPage /> },
  { path: '*', element: <NotFoundPage /> },
] }])
