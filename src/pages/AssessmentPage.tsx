import { useEffect, useRef, useState } from 'react'
import { FormProvider, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, ArrowRight, Check, Leaf, LoaderCircle, LockKeyhole } from 'lucide-react'
import { assessmentSchema, stepFields } from '@/features/assessment/schema'
import type { AssessmentValues } from '@/features/assessment/types'
import { AssessmentFields } from '@/features/assessment/components/AssessmentFields'
import { StepIndicator } from '@/features/assessment/components/StepIndicator'
import { steps } from '@/features/assessment/steps'
import { useModelInfo } from '@/hooks/useModelInfo'
import { getSupportIssues } from '@/services/modelContract'
import { useAssessment } from '@/hooks/useAssessment'
import { getServiceConfig, submitAssessment } from '@/services/assessmentService'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Disclaimer } from '@/components/shared/Disclaimer'

function serviceInfo() {
  try { return { config: getServiceConfig(), error: '' } }
  catch (error) { return { config: null, error: error instanceof Error ? error.message : 'Invalid service configuration.' } }
}
export default function AssessmentPage() {
  const state = useAssessment()
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(state.step)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const submissionLock = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const previousStep = useRef(step)
  const mounted = useRef(true)
  const navigate = useNavigate()
  const [{ config, error: configError }] = useState(serviceInfo)
  const model = useModelInfo(config)
  const form = useForm<AssessmentValues>({ resolver: zodResolver(assessmentSchema), defaultValues: { acknowledgment: false, ...state.draft }, mode: 'onTouched', shouldUnregister: false })
  const { watch, getValues } = form
  const { saveDraft } = state
  const values = useWatch({ control: form.control })
  useEffect(() => {
    const subscription = watch(() => saveDraft(getValues(), step))
    return () => subscription.unsubscribe()
  }, [watch, getValues, saveDraft, step])
  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])
  useEffect(() => {
    if (previousStep.current !== step) { heading.current?.focus(); previousStep.current = step }
  }, [step])

  useEffect(() => { if (error) errorRef.current?.focus() }, [error])

  function goToStep(next: number) { saveDraft(getValues(), next); setError(''); setStep(next) }
  function checkSupport(fields: (keyof AssessmentValues)[]) {
    if (config?.mode !== 'live') return true
    if (!model.info) return false
    const issues = getSupportIssues(getValues(), model.info).filter(issue => fields.includes(issue.field))
    for (const issue of issues) form.setError(issue.field, { type: 'model', message: issue.message })
    if (issues.length) form.setFocus(issues[0].field)
    return issues.length === 0
  }
  async function next() {
    if (submissionLock.current) return
    const valid = await form.trigger(stepFields[step], { shouldFocus: true })
    if (valid && checkSupport(stepFields[step])) goToStep(step + 1)
  }
  async function submit(answers: AssessmentValues) {
    if (submissionLock.current || !config) return
    if (!checkSupport(stepFields.flat())) {
      const issues = model.info ? getSupportIssues(getValues(), model.info) : []
      const first = stepFields.findIndex(fields => issues.some(issue => fields.includes(issue.field)))
      if (first >= 0) goToStep(first)
      return
    }
    submissionLock.current = true; setPending(true); setError('')
    try {
      const result = await submitAssessment(answers, config)
      if (!mounted.current) return
      state.setResult(result)
      navigate('/results')
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error ? caught.message : 'Something went wrong. Please try again.')
    } finally {
      submissionLock.current = false
      if (mounted.current) setPending(false)
    }
  }
  const live = config?.mode === 'live'
  const unsupported = live && values.Gender !== undefined && !['Male', 'Female'].includes(values.Gender)
  return <div className="container assessment-page">
    <div className="page-intro"><span className="eyebrow">YOUR EVERYDAY, A LITTLE CLEARER</span><h1>A small check-in with yourself.</h1><p>There are no right or wrong habits. Start with what feels true for you.</p></div>
    <div className="assessment-layout"><aside className="assessment-sidebar"><StepIndicator step={step} /><div className="sidebar-note"><Leaf size={26} aria-hidden="true" /><h3>Go at your own pace.</h3><p>Think about a typical day over the past week. Estimates are welcome.</p><p>You can go back and change any answer.</p></div><p className="sidebar-privacy"><LockKeyhole size={15} aria-hidden="true" /> {live ? 'Answers are sent only when you submit.' : 'Your answers stay in this tab.'}<br />Refreshing clears your session.</p></aside>
    <div><Card className="assessment-card">{config?.mode === 'live' && <div className="soft-note model-status" role="status"><strong>{model.loading ? 'Checking model availability…' : model.info ? `Model: ${model.info.model_version}` : 'Model unavailable'}</strong><p>{model.info ? `${model.info.disclaimer} Only values within its observed training support can be submitted. Do not change accurate answers to fit it.` : model.error || 'Fetching supported ranges and categories. No answers are sent by this check.'}</p>{model.error && <Button type="button" variant="outline" size="sm" onClick={model.retry}>Retry model check</Button>}</div>}<div className="form-progress"><span>STEP {step + 1} OF 4</span><span className="badge">{live ? 'LIVE API' : 'DEMO EXPERIENCE'}</span></div><div className="progress-track" role="progressbar" aria-label="Assessment progress" aria-valuenow={step + 1} aria-valuemin={0} aria-valuemax={4} aria-valuetext={`Step ${step + 1} of 4`}><span style={{ width: `${(step + 1) * 25}%` }} /></div>
      <FormProvider {...form}><form noValidate autoComplete="off" onSubmit={event => { if (step < 3) { event.preventDefault(); void next() } else { void form.handleSubmit(submit, errors => { const first = stepFields.findIndex(fields => fields.some(field => errors[field])); if (first >= 0 && first !== step) goToStep(first) })(event) } }} aria-busy={pending}>
        <h2 ref={heading} tabIndex={-1} className="form-heading">{steps[step].title}</h2><p className="form-description">{['Let’s start with a little about your student life.', 'A closer look at how you spend time online.', 'Make room for all the different parts of your day.', 'How have things felt lately? Then give your answers a final look.'][step]}</p>
        <fieldset disabled={pending} className="form-fields">
        <legend className="sr-only">{steps[step].title}</legend>
        <AnimatePresence mode="wait" initial={false}><motion.div key={step} initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.12 }}>
          <AssessmentFields step={step} live={live} backendUrl={config?.baseUrl} onEdit={() => goToStep(0)} />
        </motion.div></AnimatePresence>
        </fieldset>
        {(error || configError) && <div ref={errorRef} tabIndex={-1} className="error-notice" role="alert">{error || configError}</div>}
        {unsupported && <div className="error-notice" role="alert">Your selected identity is not supported by the live model. It will not be recoded. The site operator can enable demo mode so you can explore without a model prediction.</div>}
        <div className="form-actions"><Button type="button" variant="ghost" disabled={step === 0 || pending} onClick={() => goToStep(step - 1)}><ArrowLeft size={17} aria-hidden="true" /> Back</Button><span className="save-note"><Check size={14} aria-hidden="true" /> Kept in this tab</span><Button type="submit" disabled={pending || model.loading || Boolean(model.error) || Boolean(configError) || (step === 3 && Boolean(unsupported))}>{pending ? <><LoaderCircle className="spinner" size={18} aria-hidden="true" /> Preparing insights…</> : step === 3 ? <>{error ? 'Retry prediction' : live ? 'Send & view insights' : 'View demo insights'} <ArrowRight size={17} aria-hidden="true" /></> : <>Next step <ArrowRight size={17} aria-hidden="true" /></>}</Button></div>
        <p className="sr-only" role="status" aria-live="polite">{pending ? 'Preparing your insights. Please wait.' : ''}</p>
      </form></FormProvider>
    </Card><Disclaimer compact /></div></div>
  </div>
}
