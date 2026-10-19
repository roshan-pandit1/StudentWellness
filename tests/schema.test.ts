import { describe, expect, it } from 'vitest'
import { assessmentSchema, toApiPayload } from '@/features/assessment/schema'
import { validAnswers } from './fixtures'

describe('assessment validation', () => {
  it('accepts realistic values including fractional hours', () => {
    expect(assessmentSchema.safeParse(validAnswers).success).toBe(true)
  })
  it.each([
    { Age: 12 }, { Age: 101 }, { Age: 20.5 }, { Age: NaN }, { Country: ' ' },
    { Daily_Unlocks: -1 }, { Daily_Unlocks: 1001 }, { Daily_Unlocks: 4.5 },
    { Avg_Daily_Usage_Hours: 25 }, { Sleep_Hours_Per_Night: -2 },
    { Study_Hours: Infinity }, { Most_Used_Platform: '' }, { acknowledgment: false },
    { Sleep_Hours_Per_Night: 12, Study_Hours: 10, Physical_Activity_Hours: 3 },
  ])('rejects invalid input %j', changes => {
    expect(assessmentSchema.safeParse({ ...validAnswers, ...changes }).success).toBe(false)
  })
  it('checks the daily time budget before the final step is filled', () => {
    const result = assessmentSchema.safeParse({ Study_Hours: 12, Sleep_Hours_Per_Night: 12, Physical_Activity_Hours: 2 })
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error.issues.some(issue => issue.path[0] === 'Physical_Activity_Hours' && issue.message.includes('24 hours'))).toBe(true)
  })
  it('permits overlapping social media and study time', () => {
    expect(assessmentSchema.safeParse({ ...validAnswers, Avg_Daily_Usage_Hours: 14 }).success).toBe(true)
  })
  it.each(['Another identity', 'Prefer not to say'] as const)('preserves %s in the UI, but never recodes it for the API', Gender => {
    const answers = { ...validAnswers, Gender }
    expect(assessmentSchema.parse(answers).Gender).toBe(Gender)
    expect(() => toApiPayload(answers)).toThrow('will not be recoded')
  })
  it('produces exactly the 12 API fields without UI acknowledgment', () => {
    const { acknowledgment, ...expected } = validAnswers
    void acknowledgment
    expect(toApiPayload({ ...validAnswers, Country: ' India ' })).toEqual(expected)
    expect(Object.keys(toApiPayload(validAnswers))).toHaveLength(12)
  })
})
