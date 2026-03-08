"""Bulk sync endpoint for offline-first client data."""

from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from sqlalchemy.orm import selectinload

from app.dependencies import get_current_user, get_db
from app.models import ExerciseProgress, Program, User, UserProgram, WorkoutSession, WorkoutSet
from app.schemas import SyncRequest, SyncResponse

router = APIRouter(prefix="/api/sync", tags=["sync"])


def _naive(dt: datetime | None) -> datetime | None:
    """Strip timezone info so asyncpg can insert into TIMESTAMP WITHOUT TIME ZONE."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


@router.post("", response_model=SyncResponse)
async def sync_data(
    body: SyncRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SyncResponse:
    """Accept bulk sync data from the client and upsert sessions and sets."""
    synced_session_ids: list[str] = []
    synced_set_ids: list[str] = []
    errors: list[str] = []
    new_finished_program_ids: list[str] = []

    # Upsert sessions
    for session_data in body.sessions:
        try:
            result = await db.execute(
                select(WorkoutSession).where(
                    WorkoutSession.id == session_data.id
                )
            )
            existing = result.scalar_one_or_none()
            if existing:
                # Update existing session (last-write-wins)
                if existing.user_id != current_user.id:
                    errors.append(
                        f"Session {session_data.id}: not owned by current user"
                    )
                    continue
                existing.template_id = session_data.template_id
                existing.program_id = session_data.program_id
                existing.phase_workout_id = session_data.phase_workout_id
                existing.user_program_id = session_data.user_program_id
                existing.year_week = session_data.year_week
                existing.week_type = session_data.week_type
                existing.started_at = _naive(session_data.started_at)
                existing.finished_at = _naive(session_data.finished_at)
                existing.notes = session_data.notes
                existing.synced = True
            else:
                session = WorkoutSession(
                    id=session_data.id,
                    user_id=current_user.id,
                    template_id=session_data.template_id,
                    program_id=session_data.program_id,
                    phase_workout_id=session_data.phase_workout_id,
                    user_program_id=session_data.user_program_id,
                    year_week=session_data.year_week,
                    week_type=session_data.week_type,
                    started_at=_naive(session_data.started_at),
                    finished_at=_naive(session_data.finished_at),
                    notes=session_data.notes,
                    synced=True,
                )
                db.add(session)
                # Track new finished sessions with a user_program for rotation
                if session_data.finished_at and session_data.user_program_id:
                    new_finished_program_ids.append(session_data.user_program_id)
            synced_session_ids.append(session_data.id)
        except Exception as exc:
            errors.append(f"Session {session_data.id}: {str(exc)}")

    await db.flush()

    # Upsert sets
    for set_data in body.sets:
        try:
            result = await db.execute(
                select(WorkoutSet).where(WorkoutSet.id == set_data.id)
            )
            existing = result.scalar_one_or_none()
            if existing:
                existing.exercise_id = set_data.exercise_id
                existing.set_type = set_data.set_type
                existing.set_number = set_data.set_number
                existing.reps = set_data.reps
                existing.weight = set_data.weight
                existing.rpe = set_data.rpe
                existing.notes = set_data.notes
            else:
                workout_set = WorkoutSet(
                    id=set_data.id,
                    session_id=set_data.session_id,
                    exercise_id=set_data.exercise_id,
                    set_type=set_data.set_type,
                    set_number=set_data.set_number,
                    reps=set_data.reps,
                    weight=set_data.weight,
                    rpe=set_data.rpe,
                    notes=set_data.notes,
                )
                db.add(workout_set)

            # Auto-update progress for working sets
            if set_data.set_type == "working":
                # Retrieve the session to get year_week
                sess_result = await db.execute(
                    select(WorkoutSession).where(
                        WorkoutSession.id == set_data.session_id
                    )
                )
                sess = sess_result.scalar_one_or_none()
                if sess and sess.year_week:
                    await _sync_update_progress(
                        db=db,
                        user_id=current_user.id,
                        exercise_id=set_data.exercise_id,
                        year_week=sess.year_week,
                        weight=set_data.weight,
                    )

            synced_set_ids.append(set_data.id)
        except Exception as exc:
            errors.append(f"Set {set_data.id}: {str(exc)}")

    # Advance user_programs for newly synced finished sessions
    for up_id in dict.fromkeys(new_finished_program_ids):
        try:
            up_result = await db.execute(
                select(UserProgram)
                .where(
                    UserProgram.id == up_id,
                    UserProgram.user_id == current_user.id,
                )
                .options(
                    selectinload(UserProgram.program).selectinload(Program.routines)
                )
            )
            enrollment = up_result.scalar_one_or_none()
            if enrollment and enrollment.program.program_type == "rotating" and enrollment.program.routines:
                next_index = enrollment.current_routine_index + 1
                if next_index >= len(enrollment.program.routines):
                    next_index = 0
                    enrollment.weeks_completed += 1
                enrollment.current_routine_index = next_index
                enrollment.last_workout_at = datetime.utcnow()
            # Phased advancement is handled via /advance-phased endpoint
        except Exception as exc:
            errors.append(f"UserProgram advance {up_id}: {str(exc)}")

    await db.commit()

    return SyncResponse(
        synced_sessions=synced_session_ids,
        synced_sets=synced_set_ids,
        errors=errors,
    )


async def _sync_update_progress(
    db: AsyncSession,
    user_id: str,
    exercise_id: str,
    year_week: str,
    weight: Decimal,
) -> None:
    """Update exercise progress during sync for working sets."""
    result = await db.execute(
        select(ExerciseProgress).where(
            ExerciseProgress.user_id == user_id,
            ExerciseProgress.exercise_id == exercise_id,
            ExerciseProgress.year_week == year_week,
        )
    )
    progress = result.scalar_one_or_none()
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
