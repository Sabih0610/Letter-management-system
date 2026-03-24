from pydantic import BaseModel


class ReportMetric(BaseModel):
    label: str
    value: int


class ReportResponse(BaseModel):
    metrics: list[ReportMetric]

