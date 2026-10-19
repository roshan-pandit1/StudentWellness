import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { MotionConfig } from 'framer-motion'
import { AssessmentProvider } from '@/app/AssessmentProvider'
import { Layout } from '@/components/layout/Layout'
import AssessmentPage from '@/pages/AssessmentPage'
import ResultsPage from '@/pages/ResultsPage'
import AboutPage from '@/pages/AboutPage'
import { useAssessment } from '@/hooks/useAssessment'
import { validAnswers } from './fixtures'
import modelInfo from '../contracts/model-info.json'
import predictionExample from '../contracts/prediction-example.json'

// These tests exercise form/result behavior; chart layout requires a real browser.
vi.mock('@/features/results/components/HabitChart', () => ({ HabitChart: () => <div>Reported lifestyle chart</div> }))
function renderFlow(path = '/assessment', seed = false) {
  vi.stubEnv('VITE_ASSESSMENT_MODE', 'demo')
  return render(<MotionConfig reducedMotion="always"><AssessmentProvider><MemoryRouter initialEntries={[path]}>{seed && <SeedDraft />}<Routes><Route element={<Layout />}><Route path="assessment" element={<AssessmentPage />} /><Route path="results" element={<ResultsPage />} /><Route path="about" element={<AboutPage />} /></Route></Routes></MemoryRouter></AssessmentProvider></MotionConfig>)
}
function SeedDraft() {
  const { saveDraft } = useAssessment()
  return <button onClick={() => saveDraft({ ...validAnswers, Daily_Unlocks: 120 }, 3)}>Seed completed draft</button>
}
async function fillAbout(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Age'), '21')
  await user.selectOptions(screen.getByLabelText('Gender'), 'Another identity')
  await user.type(screen.getByLabelText('Country'), 'India')
  await user.selectOptions(screen.getByLabelText('Academic level'), 'Undergraduate')
}
async function next(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole('button', { name: 'Next step' }))
  await screen.findByLabelText(label)
}

describe('assessment experience', () => {
  it('blocks advancing when required answers are missing', async () => {
    renderFlow(); const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Next step' }))
    expect(await screen.findByText('Enter your age.')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'About you' })).toBeVisible()
    expect(screen.queryByLabelText('Most used platform')).not.toBeInTheDocument()
  })
  it('preserves entered answers when navigating backward and between routes', async () => {
    renderFlow(); const user = userEvent.setup()
    await fillAbout(user)
    await next(user, 'Most used platform')
    await user.type(screen.getByLabelText('Most used platform'), 'YouTube')
    await user.click(screen.getByRole('button', { name: 'Back' }))
    expect(await screen.findByLabelText('Age')).toHaveValue(21)
    expect(screen.getByLabelText('Gender')).toHaveValue('Another identity')
    await user.click(screen.getByRole('link', { name: 'About' }))
    await user.click(screen.getByRole('link', { name: /Start Your Assessment/ }))
    expect(await screen.findByLabelText('Country')).toHaveValue('India')
    await next(user, 'Most used platform')
    expect(screen.getByLabelText('Most used platform')).toHaveValue('YouTube')
  })
  it('completes all steps with an inclusive identity and displays honest demo results', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock)
    renderFlow(); const user = userEvent.setup()
    await fillAbout(user)
    await next(user, 'Most used platform')
    await user.type(screen.getByLabelText('Most used platform'), 'YouTube')
    await user.selectOptions(screen.getByLabelText('Main purpose of social media use'), 'Education')
    await user.type(screen.getByLabelText('Average daily social media usage'), '2.5')
    await user.type(screen.getByLabelText('Daily phone unlocks'), '40')
    await next(user, 'Study hours per day')
    await user.type(screen.getByLabelText('Study hours per day'), '5')
    await user.type(screen.getByLabelText('Physical activity hours per day'), '0.5')
    await user.type(screen.getByLabelText('Sleep hours per night'), '7.5')
    await next(user, 'Self-reported stress level')
    await user.selectOptions(screen.getByLabelText('Self-reported stress level'), 'Medium')
    expect(screen.getByText('Another identity', { selector: 'dd' })).toBeVisible()
    expect(screen.getByText('YouTube', { selector: 'dd' })).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'View demo insights' }))
    expect(await screen.findByText('Please acknowledge the educational-use notice.')).toBeVisible()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: 'View demo insights' }))
    expect(await screen.findByText('Demo result — not a real prediction.')).toBeVisible()
    expect(screen.getByText('7.2', { selector: 'strong' })).toBeVisible()
    expect(screen.getByText('7.5', { selector: 'strong' })).toBeVisible()
    expect(fetchMock).not.toHaveBeenCalled()
    await user.click(screen.getByRole('link', { name: 'Retake Assessment' }))
    expect(await screen.findByLabelText('Age')).toHaveValue(null)
    expect(screen.getByLabelText('Country')).toHaveValue('')
  })
  it('shows a useful empty state for a direct results visit', () => {
    renderFlow('/results')
    expect(screen.getByRole('heading', { name: 'Your insights begin with a check-in.' })).toBeVisible()
    expect(screen.queryByText('7.2')).not.toBeInTheDocument()
  })
  it('clears answers on provider unmount (no persistent storage)', async () => {
    const first = renderFlow(); const user = userEvent.setup()
    await fillAbout(user); first.unmount(); renderFlow()
    expect(screen.getByLabelText('Age')).toHaveValue(null)
    expect(screen.getByLabelText('Country')).toHaveValue('')
  })
  it('disables submission while a live request is pending and preserves answers after failure', async () => {
    renderFlow('/about', true); const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Seed completed draft' }))
    vi.stubEnv('VITE_ASSESSMENT_MODE', 'live'); vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    let rejectRequest: (error: Error) => void = () => {}
    const fetchMock = vi.fn((url: string) => url.endsWith('/model-info') ? Promise.resolve(new Response(JSON.stringify(modelInfo))) : new Promise<Response>((_resolve, reject) => { rejectRequest = reject }))
    vi.stubGlobal('fetch', fetchMock)
    await user.click(screen.getByRole('link', { name: /Start Your Assessment/ }))
    await screen.findByLabelText('Self-reported stress level')
    const submit = screen.getByRole('button', { name: 'Send & view insights' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.dblClick(submit)
    expect(fetchMock.mock.calls.filter(([url]) => url.endsWith('/predict'))).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Preparing insights…' })).toBeDisabled()
    rejectRequest(new TypeError('network unavailable'))
    await waitFor(() => expect(screen.getByText(/Could not reach the backend/)).toBeVisible())
    expect(screen.getByText('India', { selector: 'dd' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'Retry prediction' })).toBeEnabled()
  })
  it('shows the live model version, disclaimer, and dataset scale without a demo label', async () => {
    renderFlow('/about', true); const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Seed completed draft' }))
    vi.stubEnv('VITE_ASSESSMENT_MODE', 'live'); vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(new Response(JSON.stringify(url.endsWith('/model-info') ? modelInfo : predictionExample)))))
    await user.click(screen.getByRole('link', { name: /Start Your Assessment/ }))
    const submit = await screen.findByRole('button', { name: 'Send & view insights' })
    await waitFor(() => expect(submit).toBeEnabled())
    await user.click(submit)
    expect(await screen.findByText('Experimental estimate — not a medical assessment.')).toBeVisible()
    expect(screen.getByText(`Model: ${predictionExample.model_version}`)).toBeVisible()
    expect(screen.getByText(predictionExample.disclaimer)).toBeVisible()
    expect(screen.getByText('dataset score')).toBeVisible()
    expect(screen.queryByText('out of 10')).not.toBeInTheDocument()
    expect(screen.queryByText('Demo result — not a real prediction.')).not.toBeInTheDocument()
  })
  it('blocks unsupported live values before sending any prediction request', async () => {
    renderFlow('/about'); const user = userEvent.setup()
    vi.stubEnv('VITE_ASSESSMENT_MODE', 'live'); vi.stubEnv('VITE_API_BASE_URL', 'http://localhost:8000')
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(modelInfo)))
    vi.stubGlobal('fetch', fetchMock)
    await user.click(screen.getByRole('link', { name: /Start Your Assessment/ }))
    await fillAbout(user)
    const nextButton = screen.getByRole('button', { name: 'Next step' })
    await waitFor(() => expect(nextButton).toBeEnabled())
    await user.click(nextButton)
    expect(await screen.findByText(/Not supported by this model/)).toBeVisible()
    expect(screen.getByLabelText('Gender')).toHaveValue('Another identity')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/model-info', expect.anything())
  })

})
