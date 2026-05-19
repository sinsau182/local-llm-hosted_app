from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.job import Job


class JobRepository:
    def __init__(self, db: Session):
        self.db = db

    def get(self, job_id: str) -> Job | None:
        return self.db.scalar(select(Job).where(Job.id == job_id))
