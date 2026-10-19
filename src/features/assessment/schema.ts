import { z } from 'zod'
import type { AssessmentValues, StudentAssessment } from './types'

const hours = (max = 24) => z.number({ error: 'Enter a number.' }).min(0, 'Use 0 or more hours.').max(max, `Use ${max} hours or fewer.`)
export const assessmentSchema = z.object({
  Age: z.number({ error: 'Enter your age.' }).int('Enter a whole number.').min(13, 'This student demo is for ages 13–100.').max(100, 'This student demo is for ages 13–100.'),
  Gender: z.enum(['Male', 'Female', 'Another identity', 'Prefer not to say'], { error: 'Choose an option, including prefer not to say.' }),
  Country: z.string().trim().min(2, 'Enter your country (at least 2 characters).').max(80, 'Use 80 characters or fewer.'),
  Academic_Level: z.enum(['High School', 'Undergraduate', 'Graduate'], { error: 'Choose your academic level.' }),
  Most_Used_Platform: z.string().trim().min(2, 'Enter a platform, or None.').max(60, 'Use 60 characters or fewer.'),
  Purpose_Of_Use: z.enum(['Networking', 'Education', 'Entertainment', 'News'], { error: 'Choose the closest purpose.' }),
  Avg_Daily_Usage_Hours: hours(),
  Daily_Unlocks: z.number({ error: 'Enter a number.' }).int('Enter a whole number.').min(0, 'Use 0 or more unlocks.').max(1000, 'Use 1,000 unlocks or fewer.'),
  Study_Hours: hours(),
  Physical_Activity_Hours: hours(),
  Sleep_Hours_Per_Night: hours(),
  Stress_Level: z.enum(['Low', 'Medium', 'High', 'Very High'], { error: 'Choose the level that feels closest.' }),
  acknowledgment: z.boolean().refine(Boolean, 'Please acknowledge the educational-use notice.'),
 }).refine(values => values.Sleep_Hours_Per_Night + values.Study_Hours + values.Physical_Activity_Hours <= 24, {
  path: ['Physical_Activity_Hours'],
  error: 'Sleep, study and physical activity together cannot exceed 24 hours. Count each block of time once.',
  // Run this check at step 3 even while the later stress field is unanswered.
  when(payload) {
    return z.object({ Sleep_Hours_Per_Night: hours(), Study_Hours: hours(), Physical_Activity_Hours: hours() }).safeParse(payload.value).success
  },
})

export const stepFields: (keyof AssessmentValues)[][] = [
  ['Age', 'Gender', 'Country', 'Academic_Level'],
  ['Most_Used_Platform', 'Purpose_Of_Use', 'Avg_Daily_Usage_Hours', 'Daily_Unlocks'],
  ['Study_Hours', 'Physical_Activity_Hours', 'Sleep_Hours_Per_Night'],
  ['Stress_Level', 'acknowledgment'],
]

export function toApiPayload(input: AssessmentValues): StudentAssessment {
  const { acknowledgment, Gender, ...rest } = assessmentSchema.parse(input)
  void acknowledgment
  if (Gender !== 'Male' && Gender !== 'Female') {
    throw new Error('The current model only supports Male and Female categories. Your identity will not be recoded. You can explore this experience in demo mode instead.')
  }
  return { ...rest, Gender }
}
