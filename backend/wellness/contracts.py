from __future__ import annotations

from typing import Dict, List, Literal, Optional
from pydantic import BaseModel, ConfigDict, Field, model_validator

FEATURES = [
    'Age', 'Gender', 'Country', 'Academic_Level', 'Most_Used_Platform',
    'Purpose_Of_Use', 'Avg_Daily_Usage_Hours', 'Daily_Unlocks', 'Study_Hours',
    'Physical_Activity_Hours', 'Sleep_Hours_Per_Night', 'Stress_Level',
]
TARGET = 'Mental_Health_Score'
NUMERIC = ['Age', 'Avg_Daily_Usage_Hours', 'Daily_Unlocks', 'Study_Hours',
           'Physical_Activity_Hours', 'Sleep_Hours_Per_Night']
CATEGORICAL = [name for name in FEATURES if name not in NUMERIC]
DISCLAIMER = 'Experimental educational estimate; not a medical diagnosis.'
FORMAT_VERSION = 1


class AssessmentRequest(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True, allow_inf_nan=False)
    Age: int = Field(ge=13, le=100)
    Gender: Literal['Male', 'Female']
    Country: str = Field(min_length=2, max_length=80)
    Academic_Level: Literal['High School', 'Undergraduate', 'Graduate']
    Most_Used_Platform: str = Field(min_length=2, max_length=60)
    Purpose_Of_Use: Literal['Networking', 'Education', 'Entertainment', 'News']
    Avg_Daily_Usage_Hours: float = Field(ge=0, le=24)
    Daily_Unlocks: int = Field(ge=0, le=1000)
    Study_Hours: float = Field(ge=0, le=24)
    Physical_Activity_Hours: float = Field(ge=0, le=24)
    Sleep_Hours_Per_Night: float = Field(ge=0, le=24)
    Stress_Level: Literal['Low', 'Medium', 'High', 'Very High']

    @model_validator(mode='after')
    def check_routine(self):
        if self.Study_Hours + self.Physical_Activity_Hours + self.Sleep_Hours_Per_Night > 24:
            raise ValueError('Sleep, study and activity together must not exceed 24 hours.')
        return self


class NumericRange(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    min: float
    max: float

    @model_validator(mode='after')
    def ordered(self):
        if self.min > self.max:
            raise ValueError('Invalid range')
        return self


class ScoreReference(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    observed_min: float
    observed_max: float
    definition_verified: Literal[False] = False
    description: str = 'Observed training-target range; theoretical scale and scoring definition are unverified.'

    @model_validator(mode='after')
    def ordered(self):
        if self.observed_min >= self.observed_max:
            raise ValueError('Target must vary')
        return self


class ModelInfo(BaseModel):
    model_version: str
    disclaimer: str = DISCLAIMER
    feature_names: List[str]
    numeric_ranges: Dict[str, NumericRange]
    categorical_values: Dict[str, List[str]]
    score_reference: ScoreReference


class PredictionResponse(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    Mental_Health_Score: float
    model_version: str
    disclaimer: str = DISCLAIMER
    score_reference: ScoreReference
    warnings: List[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal['ready', 'unavailable']
    model_loaded: bool
    model_version: Optional[str] = None
    reason: Optional[str] = None


class FieldIssue(BaseModel):
    field: str
    message: str


class ErrorResponse(BaseModel):
    code: str
    message: str
    fields: List[FieldIssue] = Field(default_factory=list)
