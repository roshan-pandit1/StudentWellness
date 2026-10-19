import { useId } from 'react'
import { useFormContext } from 'react-hook-form'
import type { AssessmentValues } from '../types'
import { Input } from '@/components/ui/input'

interface Props {
  name: Exclude<keyof AssessmentValues, 'acknowledgment'>;
  label: string;
  description: string;
  options?: readonly string[];
  type?: 'text' | 'number';
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  suffix?: string;
}
export function AssessmentField({ name, label, description, options, type = 'text', suffix, ...rest }: Props) {
  const id = useId()
  const { register, formState: { errors } } = useFormContext<AssessmentValues>()
  const error = errors[name]?.message
  const shared = { id, 'aria-invalid': Boolean(error), 'aria-describedby': `${id}-hint${error ? ` ${id}-error` : ''}` }
  return <div className="field"><label htmlFor={id}>{label}</label><div className="input-wrap">{options ? <select {...shared} {...register(name)} className="input" defaultValue=""><option value="" disabled>Select an option</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select> : <Input {...shared} {...rest} type={type} inputMode={type === 'number' ? 'decimal' : undefined} {...register(name, { valueAsNumber: type === 'number' })} className={suffix ? 'has-suffix' : undefined} />}{suffix && <span className="input-suffix" aria-hidden="true">{suffix}</span>}</div><p id={`${id}-hint`} className="field-hint">{description}</p>{error && <p id={`${id}-error`} className="field-error" role="alert">{error}</p>}</div>
}
