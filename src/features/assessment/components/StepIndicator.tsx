import { Check } from 'lucide-react'
import { steps } from '../steps'
export function StepIndicator({ step }: { step: number }) {
  return <ol className="step-indicator" aria-label="Assessment progress">{steps.map(({ title, subtitle, icon: Icon }, index) => <li key={title} aria-current={step === index ? 'step' : undefined} className={index < step ? 'complete' : step === index ? 'current' : ''}><span className="step-icon">{index < step ? <Check size={19} aria-hidden="true" /> : <Icon size={19} aria-hidden="true" />}</span><span><strong>{title}</strong><small>{subtitle}</small></span><span className="sr-only">{index < step ? 'Completed' : `Step ${index + 1} of 4`}</span></li>)}</ol>
}
