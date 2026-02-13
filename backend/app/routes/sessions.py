"""Workout session and set logging routes with auto-progress tracking."""

from datetime import datetime
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import (
    ExerciseProgress,
    Program,
    ProgramRoutine,
    User,
    WorkoutSession,
    WorkoutSet,
)
from app.schemas import (
    MessageResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
    SessionUpdate,
    SetCreate,
    SetResponse,
    SetUpdate,
)

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    year_week: Optional[str] = Query(None, description="Filter by year-week, e.g. 2025-27"),
    week_type: Optional[str] = Query(None, description="Filter by week type: normal or deload"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[WorkoutSession]:
    """List the current user's workout sessions with optional filters."""
    query = select(WorkoutSession).where(
        WorkoutSession.user_id == current_user.id
    )
    if year_week is not None:
        query = query.where(WorkoutSession.year_week == year_week)
    if week_type is not None:
        query = query.where(WorkoutSession.week_type == week_type)
    query = query.order_by(WorkoutSession.started_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


@router.post(
    "/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED
)
async def create_session(
    body: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutSession:
    """Start a new workout session from a template or ad-hoc."""
    session = WorkoutSession(
        user_id=current_user.id,
        template_id=body.template_id,
        program_id=body.program_id,
        year_week=body.year_week,
        week_type=body.week_type,
        started_at=datetime.utcnow(),
        synced=False,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionDetailResponse)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutSession:
    """Get session detail with all warmup and working sets."""
    result = await db.execute(
        select(WorkoutSession)
        .where(
            WorkoutSession.id == session_id,
            WorkoutSession.user_id == current_user.id,
        )
        .options(
            selectinload(WorkoutSession.sets).selectinload(WorkoutSet.exercise)
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )
    return session


@router.put("/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    body: SessionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutSession:
    """Update a session (finish time, notes, etc.)."""
    result = await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.id == session_id,
            WorkoutSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    if body.notes is not None:
        session.notes = body.notes
    if body.finished_at is not None:
        session.finished_at = body.finished_at

        # Advance program rotation when finishing a program-linked session
        if session.program_id:
            prog_result = await db.execute(
                select(Program)
                .where(Program.id == session.program_id)
                .options(selectinload(Program.routines))
            )
            program = prog_result.scalar_one_or_none()
            if program and program.routines:
                program.current_routine_index += 1
                if program.current_routine_index >= len(program.routines):
                    program.current_routine_index = 0
                    program.weeks_completed += 1
                program.last_workout_at = datetime.utcnow()

    await db.commit()
    await db.refresh(session)
    return session


@router.post(
    "/{session_id}/sets",
    response_model=SetResponse,
    status_code=status.HTTP_201_CREATED,
)
async def log_set(
    session_id: str,
    body: SetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutSet:
    """Log a warmup or working set. Auto-updates exercise progress for working sets."""
    # Verify session belongs to user
    result = await db.execute(
        select(WorkoutSession).where(
            WorkoutSession.id == session_id,
            WorkoutSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Session not found"
        )

    workout_set = WorkoutSet(
        session_id=session_id,
        exercise_id=body.exercise_id,
        set_type=body.set_type,
        set_number=body.set_number,
        reps=body.reps,
        weight=body.weight,
        rpe=body.rpe,
        notes=body.notes,
    )
    db.add(workout_set)
    await db.flush()

    # Auto-update exercise progress
    if session.year_week:
        await _update_exercise_progress(
            db=db,
            user_id=current_user.id,
            exercise_id=body.exercise_id,
            year_week=session.year_week,
            set_type=body.set_type,
            weight=body.weight,
        )

    await db.commit()
    await db.refresh(workout_set)
    return workout_set


@router.put("/sets/{set_id}", response_model=SetResponse)
async def update_set(
    set_id: str,
    body: SetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkoutSet:
    """Update a logged set."""
    result = await db.execute(
        select(WorkoutSet)
        .where(WorkoutSet.id == set_id)
        .options(selectinload(WorkoutSet.session))
    )
    workout_set = result.scalar_one_or_none()
    if not workout_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Set not found"
        )
    if workout_set.session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to update this set",
        )

    if body.reps is not None:
        workout_set.reps = body.reps
    if body.weight is not None:
        workout_set.weight = body.weight
    if body.rpe is not None:
        workout_set.rpe = body.rpe
    if body.notes is not None:
        workout_set.notes = body.notes

    await db.commit()
    await db.refresh(workout_set)
    return workout_set


@router.delete("/sets/{set_id}", response_model=MessageResponse)
async def delete_set(
    set_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> dict[str, str]:
    """Delete a logged set."""
    result = await db.execute(
        select(WorkoutSet)
        .where(WorkoutSet.id == set_id)
        .options(selectinload(WorkoutSet.session))
    )
    workout_set = result.scalar_one_or_none()
    if not workout_set:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Set not found"
        )
    if workout_set.session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not allowed to delete this set",
        )

    await db.delete(workout_set)
    await db.commit()
    return {"message": "Set deleted successfully"}


async def _update_exercise_progress(
    db: AsyncSession,
    user_id: str,
    exercise_id: str,
    year_week: str,
    set_type: str,
    weight: Decimal,
) -> None:
    """Update or create an ExerciseProgress record when a set is logged."""
    result = await db.execute(
        select(ExerciseProgress).where(
            ExerciseProgress.user_id == user_id,
            ExerciseProgress.exercise_id == exercise_id,
            ExerciseProgress.year_week == year_week,
        )
    )
    progress = result.scalar_one_or_none()

    if set_type == "working":
        if not progress:
            progress = ExerciseProgress(
                user_id=user_id,
                exercise_id=exercise_id,
                year_week=year_week,
                max_weight=weight,
            )
            db.add(progress)
        elif weight > progress.max_weight:
            progress.max_weight = weight
