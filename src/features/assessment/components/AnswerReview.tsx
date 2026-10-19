import type { AssessmentValues } from '../types'

const answerLabels: Record<Exclude<keyof AssessmentValues, 'acknowledgment'>, string> = {
  Age: 'Age', Gender: 'Gender', Country: 'Country', Academic_Level: 'Academic level',
  Most_Used_Platform: 'Most used platform', Purpose_Of_Use: 'Social media purpose',
  Avg_Daily_Usage_Hours: 'Social media hours/day', Daily_Unlocks: 'Phone unlocks/day',
  Study_Hours: 'Study hours/day', Physical_Activity_Hours: 'Activity hours/day',
  Sleep_Hours_Per_Night: 'Sleep hours/night', Stress_Level: 'Self-reported stress',
}
export function AnswerReview({ values }: { values: Partial<AssessmentValues> }) {
  return <dl className="answer-review">{Object.entries(answerLabels).map(([key, label]) => {
    const value = values[key as keyof typeof answerLabels]
    const display = value === undefined || value === '' || (typeof value === 'number' && !Number.isFinite(value)) ? 'Not answered' : String(value)
    return <div key={key}><dt>{label}</dt><dd>{display}</dd></div>
  })}</dl>
}
