import { z } from 'zod'
import type { AssessmentValues } from '@/features/assessment/types'

const numericRange = z.object({ min: z.number().finite(), max: z.number().finite() }).refine(value => value.min <= value.max)
const categories = z.array(z.string().min(1)).min(1)
export const scoreReferenceSchema = z.object({
  observed_min: z.number().finite(), observed_max: z.number().finite(),
  definition_verified: z.literal(false), description: z.string().min(1).max(500),
}).refine(value => value.observed_min < value.observed_max)
export const modelInfoSchema = z.object({
  model_version: z.string().min(1).max(120), disclaimer: z.string().min(1).max(500),
  feature_names: z.array(z.string()).length(12),
  numeric_ranges: z.object({ Age: numericRange, Avg_Daily_Usage_Hours: numericRange, Daily_Unlocks: numericRange,
    Study_Hours: numericRange, Physical_Activity_Hours: numericRange, Sleep_Hours_Per_Night: numericRange }),
  categorical_values: z.object({ Gender: categories, Country: categories, Academic_Level: categories,
    Most_Used_Platform: categories, Purpose_Of_Use: categories, Stress_Level: categories }),
  score_reference: scoreReferenceSchema,
}).refine(info => {
  const keys = [...Object.keys(info.numeric_ranges), ...Object.keys(info.categorical_values)]
  return new Set(info.feature_names).size === keys.length && keys.every(key => info.feature_names.includes(key))
})
export const predictionResponseSchema = z.object({
  Mental_Health_Score: z.number().finite(),
  model_version: z.string().min(1).max(120), disclaimer: z.string().min(1).max(500),
  score_reference: scoreReferenceSchema, warnings: z.array(z.string().max(500)).max(10),
})
export type ModelInfo = z.infer<typeof modelInfoSchema>
export type ScoreReference = z.infer<typeof scoreReferenceSchema>
export type SupportIssue = { field: keyof AssessmentValues; message: string }

export function getSupportIssues(values: Partial<AssessmentValues>, info: ModelInfo): SupportIssue[] {
  const issues: SupportIssue[] = []
  for (const [name, range] of Object.entries(info.numeric_ranges)) {
    const field = name as keyof typeof info.numeric_ranges
    const value = values[field]
    if (typeof value === 'number' && Number.isFinite(value) && (value < range.min || value > range.max)) {
      issues.push({ field, message: `Supported training range: ${range.min}–${range.max}. Your answer is outside that range; do not change it just to fit the model.` })
    }
  }
  for (const [name, supported] of Object.entries(info.categorical_values)) {
    const field = name as keyof typeof info.categorical_values
    const value = values[field]
    if (value && !supported.includes(value.trim())) {
      issues.push({ field, message: `Not supported by this model. Supported values: ${supported.join(', ')}. No value will be recoded.` })
    }
  }
  return issues
}
