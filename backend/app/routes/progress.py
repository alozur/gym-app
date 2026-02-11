"""Exercise progress tracking routes."""

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models import ExerciseProgress, User
from app.schemas import ProgressResponse

router = APIRouter(prefix="/api/progress", tags=["progress"])


@router.get(
    "/exercise/{exercise_id}", response_model=list[ProgressResponse]
)
async def get_exercise_progress(
    exercise_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ExerciseProgress]:
    """Get year-week history for an exercise (max weight, warmup info per week)."""
    result = await db.execute(
        select(ExerciseProgress)
        .where(
            ExerciseProgress.user_id == current_user.id,
            ExerciseProgress.exercise_id == exercise_id,
        )
        .order_by(ExerciseProgress.year_week)
    )
    return list(result.scalars().all())
