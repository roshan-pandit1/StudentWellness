import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { AssessmentValues } from '@/features/assessment/types'
export function HabitChart({ answers }: { answers: AssessmentValues }) {
  const data = [
    { name: 'Sleep', hours: answers.Sleep_Hours_Per_Night },
    { name: 'Social media', hours: answers.Avg_Daily_Usage_Hours },
    { name: 'Study', hours: answers.Study_Hours },
    { name: 'Movement', hours: answers.Physical_Activity_Hours },
  ]
  return <figure className="habit-chart" aria-label={`Reported hours: ${data.map(item => `${item.name} ${item.hours}`).join(', ')}. Sleep is per night; other activities are per day.`}>
    <ResponsiveContainer width="100%" height={260} minWidth={0}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 25, left: 5, bottom: 8 }} accessibilityLayer>
        <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#dce4dc" />
        <XAxis type="number" domain={[0, Math.max(8, ...data.map(item => item.hours))]} tickLine={false} axisLine={false} unit=" h" fontSize={12} stroke="#596b61" />
        <YAxis type="category" dataKey="name" width={93} tickLine={false} axisLine={false} fontSize={13} stroke="#596b61" />
        <Tooltip cursor={{ fill: '#E8F3EC' }} formatter={value => [`${value} hours`, 'Reported']} contentStyle={{ borderRadius: 12, border: '1px solid #dce4dc', fontFamily: 'inherit' }} />
        <Bar dataKey="hours" fill="#2F7560" radius={[0, 6, 6, 0]} barSize={25} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </figure>
}
