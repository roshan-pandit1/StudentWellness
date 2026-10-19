export interface StudentAssessment {
  Age: number;
  Gender: 'Male' | 'Female';
  Country: string;
  Academic_Level: 'High School' | 'Undergraduate' | 'Graduate';
  Most_Used_Platform: string;
  Purpose_Of_Use: 'Networking' | 'Education' | 'Entertainment' | 'News';
  Avg_Daily_Usage_Hours: number;
  Daily_Unlocks: number;
  Study_Hours: number;
  Physical_Activity_Hours: number;
  Sleep_Hours_Per_Night: number;
  Stress_Level: 'Low' | 'Medium' | 'High' | 'Very High';
}

// UI-only choices never enter the model contract through coercion or a default.
export type GenderIdentity = StudentAssessment['Gender'] | 'Another identity' | 'Prefer not to say'
export type AssessmentValues = Omit<StudentAssessment, 'Gender'> & {
  Gender: GenderIdentity;
  acknowledgment: boolean;
}
