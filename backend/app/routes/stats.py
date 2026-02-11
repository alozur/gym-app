"""Volume and personal records statistics routes."""

from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import Exercise, User, WorkoutSession, WorkoutSet
from app.schemas import RecordResponse, VolumeResponse

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("/volume", response_model=list[VolumeResponse])
async def get_volume_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[VolumeResponse]:
    """Calculate volume (sets x reps x weight) per muscle group per year-week."""
    result = await db.execute(
        select(
            WorkoutSession.year_week,
            Exercise.muscle_group,
            func.sum(WorkoutSet.reps * WorkoutSet.weight).label("total_volume"),
        )
        .join(WorkoutSession, WorkoutSet.session_id == WorkoutSession.id)
        .join(Exercise, WorkoutSet.exercise_id == Exercise.id)
        .where(
            WorkoutSession.user_id == current_user.id,
            WorkoutSet.set_type == "working",
            WorkoutSession.year_week.isnot(None),
        )
        .group_by(WorkoutSession.year_week, Exercise.muscle_group)
        .order_by(WorkoutSession.year_week)
    )
    rows = result.all()
    return [
        VolumeResponse(
            year_week=row.year_week,
            muscle_group=row.muscle_group,
            total_volume=Decimal(str(row.total_volume)),
        )
        for row in rows
    ]


@router.get("/records", response_model=list[RecordResponse])
async def get_personal_records(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[RecordResponse]:
    """Get personal records per exercise (max weight, max reps)."""
    result = await db.execute(
        select(
            WorkoutSet.exercise_id,
            Exercise.name.label("exercise_name"),
            func.max(WorkoutSet.weight).label("max_weight"),
            func.max(WorkoutSet.reps).label("max_reps"),
        )
        .join(WorkoutSession, WorkoutSet.session_id == WorkoutSession.id)
        .join(Exercise, WorkoutSet.exercise_id == Exercise.id)
        .where(
            WorkoutSession.user_id == current_user.id,
            WorkoutSet.set_type == "working",
        )
        .group_by(WorkoutSet.exercise_id, Exercise.name)
        .order_by(Exercise.name)
    )
    rows = result.all()
    return [
        RecordResponse(
            exercise_id=row.exercise_id,
            exercise_name=row.exercise_name,
            max_weight=Decimal(str(row.max_weight)),
            max_reps=row.max_reps,
        )
        for row in rows
    ]
