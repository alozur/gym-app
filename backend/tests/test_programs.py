"""Tests for program CRUD routes with routine rotation and deload logic."""

import pytest
from httpx import AsyncClient


async def _get_exercise_id_by_name(client: AsyncClient, name: str) -> str:
    """Helper to look up an exercise ID by name."""
    resp = await client.get("/api/exercises")
    exercises = resp.json()
    exercise = next(e for e in exercises if e["name"] == name)
    return exercise["id"]


def _make_template_exercise(exercise_id: str, week_type: str, order: int) -> dict:
    """Helper to build a TemplateExerciseCreate payload."""
    return {
        "exercise_id": exercise_id,
        "week_type": week_type,
        "order": order,
        "working_sets": 3,
        "min_reps": 8,
        "max_reps": 12,
        "early_set_rpe_min": 7.0,
        "early_set_rpe_max": 8.0,
        "last_set_rpe_min": 8.0,
        "last_set_rpe_max": 9.0,
        "rest_period": "2-3 min",
        "intensity_technique": None,
        "warmup_sets": 2,
    }


async def _create_template(client: AsyncClient, name: str, exercise_id: str) -> str:
    """Create a template and return its ID."""
    resp = await client.post(
        "/api/templates",
        json={
            "name": name,
            "template_exercises": [
                _make_template_exercise(exercise_id, "normal", 0),
                _make_template_exercise(exercise_id, "deload", 1),
            ],
        },
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _get_enrollment(client: AsyncClient, program_id: str) -> dict | None:
    """Get the user's enrollment for a specific program."""
    resp = await client.get("/api/programs/enrollments")
    assert resp.status_code == 200
    for e in resp.json():
        if e["program_id"] == program_id:
            return e
    return None


@pytest.mark.asyncio
async def test_create_program_with_routines(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(auth_seeded_client, "Push Day", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Pull Day", exercise_id)

    resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "PPL Program",
            "deload_every_n_weeks": 4,
            "routines": [
                {"template_id": t1, "order": 0},
                {"template_id": t2, "order": 1},
            ],
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "PPL Program"
    assert data["deload_every_n_weeks"] == 4
    assert data["routine_count"] == 2
    assert len(data["routines"]) == 2
    assert data["routines"][0]["template_name"] == "Push Day"
    assert data["routines"][1]["template_name"] == "Pull Day"
    # Auto-enrollment created
    enrollment = await _get_enrollment(auth_seeded_client, data["id"])
    assert enrollment is not None
    assert enrollment["is_active"] is False


@pytest.mark.asyncio
async def test_list_programs(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Smith Machine Squat"
    )
    t1 = await _create_template(auth_seeded_client, "Leg Day", exercise_id)

    await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Legs Only",
            "routines": [{"template_id": t1, "order": 0}],
        },
    )

    resp = await auth_seeded_client.get("/api/programs")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(p["name"] == "Legs Only" for p in data)


@pytest.mark.asyncio
async def test_get_program_detail(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Barbell RDL")
    t1 = await _create_template(auth_seeded_client, "DL Day", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Deadlift Focus",
            "routines": [{"template_id": t1, "order": 0}],
        },
    )
    program_id = create_resp.json()["id"]

    resp = await auth_seeded_client.get(f"/api/programs/{program_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Deadlift Focus"
    assert len(data["routines"]) == 1
    assert data["routines"][0]["template_name"] == "DL Day"


@pytest.mark.asyncio
async def test_update_program(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(auth_seeded_client, "Day A", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Day B", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Old Name",
            "routines": [{"template_id": t1, "order": 0}],
        },
    )
    program_id = create_resp.json()["id"]

    resp = await auth_seeded_client.put(
        f"/api/programs/{program_id}",
        json={
            "name": "New Name",
            "deload_every_n_weeks": 8,
            "routines": [
                {"template_id": t1, "order": 0},
                {"template_id": t2, "order": 1},
            ],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["deload_every_n_weeks"] == 8
    assert len(data["routines"]) == 2


@pytest.mark.asyncio
async def test_delete_program(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Smith Machine Squat"
    )
    t1 = await _create_template(auth_seeded_client, "Temp", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={"name": "To Delete", "routines": [{"template_id": t1, "order": 0}]},
    )
    program_id = create_resp.json()["id"]

    resp = await auth_seeded_client.delete(f"/api/programs/{program_id}")
    assert resp.status_code == 200
    assert resp.json()["message"] == "Program deleted successfully"

    # Verify it's gone
    resp = await auth_seeded_client.get(f"/api/programs/{program_id}")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_activate_deactivate_program(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(auth_seeded_client, "Activate Test", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={"name": "Activate Me", "routines": [{"template_id": t1, "order": 0}]},
    )
    program_id = create_resp.json()["id"]

    # Activate
    resp = await auth_seeded_client.post(f"/api/programs/{program_id}/activate")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_active"] is True
    assert data["started_at"] is not None
    assert data["current_routine_index"] == 0
    assert data["weeks_completed"] == 0

    # Deactivate
    resp = await auth_seeded_client.post(f"/api/programs/{program_id}/deactivate")
    assert resp.status_code == 200
    assert resp.json()["is_active"] is False


@pytest.mark.asyncio
async def test_today_endpoint(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(auth_seeded_client, "Today Push", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Today Pull", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Today Program",
            "deload_every_n_weeks": 6,
            "routines": [
                {"template_id": t1, "order": 0},
                {"template_id": t2, "order": 1},
            ],
        },
    )
    program_id = create_resp.json()["id"]

    # Activate
    await auth_seeded_client.post(f"/api/programs/{program_id}/activate")

    # Get today
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.status_code == 200
    data = resp.json()
    assert data["program"]["name"] == "Today Program"
    assert data["template_name"] == "Today Push"
    assert data["week_type"] == "normal"
    assert data["week_number"] == 1
    assert data["is_deload"] is False
    assert data["next_routine_name"] == "Today Pull"
    assert isinstance(data["template_exercises"], list)


@pytest.mark.asyncio
async def test_today_no_active_program(auth_seeded_client: AsyncClient):
    # Deactivate any active enrollments
    enrollments_resp = await auth_seeded_client.get("/api/programs/enrollments")
    for enr in enrollments_resp.json():
        if enr["is_active"]:
            await auth_seeded_client.post(
                f"/api/programs/{enr['program_id']}/deactivate"
            )
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_session_finish_advances_rotation(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(auth_seeded_client, "Rot A", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Rot B", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Rotation Test",
            "deload_every_n_weeks": 6,
            "routines": [
                {"template_id": t1, "order": 0},
                {"template_id": t2, "order": 1},
            ],
        },
    )
    program_id = create_resp.json()["id"]

    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    user_program_id = activate_resp.json()["id"]

    # Create a session linked to the program with user_program_id
    session_resp = await auth_seeded_client.post(
        "/api/sessions",
        json={
            "template_id": t1,
            "program_id": program_id,
            "user_program_id": user_program_id,
            "week_type": "normal",
            "year_week": "2025-01",
        },
    )
    assert session_resp.status_code == 201
    session_id = session_resp.json()["id"]

    # Finish the session
    finish_resp = await auth_seeded_client.put(
        f"/api/sessions/{session_id}",
        json={"finished_at": "2025-01-06T18:00:00"},
    )
    assert finish_resp.status_code == 200

    # Verify rotation advanced via enrollment
    enrollment = await _get_enrollment(auth_seeded_client, program_id)
    assert enrollment["current_routine_index"] == 1
    assert enrollment["weeks_completed"] == 0

    # Finish another session to wrap around
    session2_resp = await auth_seeded_client.post(
        "/api/sessions",
        json={
            "template_id": t2,
            "program_id": program_id,
            "user_program_id": user_program_id,
            "week_type": "normal",
            "year_week": "2025-01",
        },
    )
    session2_id = session2_resp.json()["id"]
    await auth_seeded_client.put(
        f"/api/sessions/{session2_id}",
        json={"finished_at": "2025-01-07T18:00:00"},
    )

    enrollment2 = await _get_enrollment(auth_seeded_client, program_id)
    assert enrollment2["current_routine_index"] == 0
    assert enrollment2["weeks_completed"] == 1


@pytest.mark.asyncio
async def test_deload_detection(auth_seeded_client: AsyncClient):
    """After enough weeks, deload should be detected."""
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Smith Machine Squat"
    )
    t1 = await _create_template(auth_seeded_client, "Deload Test", exercise_id)

    # Create program with deload_every_n_weeks=2 for quick testing
    # (1 routine, so each session = 1 week)
    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Deload Program",
            "deload_every_n_weeks": 2,
            "routines": [{"template_id": t1, "order": 0}],
        },
    )
    program_id = create_resp.json()["id"]
    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    user_program_id = activate_resp.json()["id"]

    # Week 0 (weeks_completed=0): normal (0 % 2 == 0, not == 1)
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.json()["is_deload"] is False

    # Complete one session -> weeks_completed=1
    s1 = await auth_seeded_client.post(
        "/api/sessions",
        json={
            "template_id": t1,
            "program_id": program_id,
            "user_program_id": user_program_id,
            "week_type": "normal",
            "year_week": "2025-01",
        },
    )
    await auth_seeded_client.put(
        f"/api/sessions/{s1.json()['id']}",
        json={"finished_at": "2025-01-06T18:00:00"},
    )

    # Week 1 (weeks_completed=1): deload (1 % 2 == 1 == 2-1)
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.json()["is_deload"] is True
    assert resp.json()["week_type"] == "deload"


# ---------------------------------------------------------------------------
# Helpers for phased program tests
# ---------------------------------------------------------------------------


async def _create_phased_program_in_db(
    db_session,
    user_id: str,
    program_name: str = "Phased Test Program",
    num_phases: int = 2,
    days_per_week: int = 3,
    duration_weeks: int = 2,
    exercise_id: str | None = None,
) -> tuple:
    """Create a phased program with phases and workouts directly in the DB.

    Returns (program_id, phase_ids, workout_ids).
    """
    from app.models import (
        PhaseWorkout,
        PhaseWorkoutExercise,
        PhaseWorkoutSection,
        Program,
        ProgramPhase,
        UserProgram,
    )

    program = Program(
        user_id=user_id,
        name=program_name,
        program_type="phased",
        deload_every_n_weeks=6,
    )
    db_session.add(program)
    await db_session.flush()

    # Auto-enroll
    enrollment = UserProgram(user_id=user_id, program_id=program.id)
    db_session.add(enrollment)

    phase_ids = []
    workout_ids = []

    for phase_order in range(num_phases):
        phase = ProgramPhase(
            program_id=program.id,
            name=f"Phase {phase_order + 1}",
            description=f"Test phase {phase_order + 1}",
            order=phase_order,
            duration_weeks=duration_weeks,
        )
        db_session.add(phase)
        await db_session.flush()
        phase_ids.append(phase.id)

        # Create workouts for each week * day combination
        for week in range(1, duration_weeks + 1):
            for day_idx in range(days_per_week):
                workout = PhaseWorkout(
                    phase_id=phase.id,
                    name=f"Phase {phase_order + 1} W{week} D{day_idx + 1}",
                    day_index=day_idx,
                    week_number=week,
                )
                db_session.add(workout)
                await db_session.flush()
                workout_ids.append(workout.id)

                if exercise_id:
                    section = PhaseWorkoutSection(
                        workout_id=workout.id,
                        name="Main Work",
                        order=0,
                        notes=None,
                    )
                    db_session.add(section)
                    await db_session.flush()

                    ex = PhaseWorkoutExercise(
                        section_id=section.id,
                        exercise_id=exercise_id,
                        order=0,
                        working_sets=3,
                        reps_display="8-12",
                        rest_period="2 min",
                        warmup_sets=2,
                    )
                    db_session.add(ex)

    await db_session.commit()
    return program.id, phase_ids, workout_ids


# ---------------------------------------------------------------------------
# Phased program: advance-phased endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_advance_phased_increments_day(
    auth_seeded_client: AsyncClient, db_session
):
    """Calling advance-phased on a phased program increments day_index from 0 to 1."""
    # Get the current user's ID
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name="Advance Day Test",
        num_phases=1,
        days_per_week=3,
        duration_weeks=2,
        exercise_id=exercise_id,
    )

    # Activate the program
    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    assert activate_resp.json()["current_day_index"] == 0

    # Advance once
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()
    assert data["current_day_index"] == 1
    assert data["current_week_in_phase"] == 0
    assert data["current_phase_index"] == 0


@pytest.mark.asyncio
async def test_advance_phased_wraps_day_to_next_week(
    auth_seeded_client: AsyncClient, db_session
):
    """When day_index is at the last day (2), advance resets to 0 and bumps week."""
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Barbell RDL")
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name="Wrap Day Test",
        num_phases=1,
        days_per_week=3,
        duration_weeks=3,
        exercise_id=exercise_id,
    )

    # Activate
    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    enrollment_id = activate_resp.json()["id"]

    # Manually set day_index to 2 (last day) via DB
    from sqlalchemy import update as sa_update

    from app.models import UserProgram

    await db_session.execute(
        sa_update(UserProgram)
        .where(UserProgram.id == enrollment_id)
        .values(current_day_index=2, current_week_in_phase=0)
    )
    await db_session.commit()

    # Advance — should wrap day to 0 and bump week to 1
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()
    assert data["current_day_index"] == 0
    assert data["current_week_in_phase"] == 1
    assert data["current_phase_index"] == 0


@pytest.mark.asyncio
async def test_advance_phased_wraps_week_to_next_phase(
    auth_seeded_client: AsyncClient, db_session
):
    """At the last day of the last week of a phase, advance increments the phase."""
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Smith Machine Squat"
    )
    # 2 phases, 2 weeks each, 3 days per week
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name="Wrap Phase Test",
        num_phases=2,
        days_per_week=3,
        duration_weeks=2,
        exercise_id=exercise_id,
    )

    # Activate
    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    enrollment_id = activate_resp.json()["id"]

    # Set enrollment to last day of last week of phase 0:
    # day_index=2, current_week_in_phase=1 (0-indexed, duration=2 so last is 1),
    # current_phase_index=0
    from sqlalchemy import update as sa_update

    from app.models import UserProgram

    await db_session.execute(
        sa_update(UserProgram)
        .where(UserProgram.id == enrollment_id)
        .values(
            current_day_index=2,
            current_week_in_phase=1,
            current_phase_index=0,
        )
    )
    await db_session.commit()

    # Advance — day wraps to 0, week wraps to 0, phase increments to 1
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()
    assert data["current_day_index"] == 0
    assert data["current_week_in_phase"] == 0
    assert data["current_phase_index"] == 1


@pytest.mark.asyncio
async def test_advance_phased_rejects_rotating_program(
    auth_seeded_client: AsyncClient,
):
    """Calling advance-phased on a rotating program returns HTTP 400."""
    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    t1 = await _create_template(
        auth_seeded_client, "Rotating Advance Test", exercise_id
    )

    create_resp = await auth_seeded_client.post(
        "/api/programs",
        json={
            "name": "Rotating Program",
            "routines": [{"template_id": t1, "order": 0}],
        },
    )
    assert create_resp.status_code == 201
    program_id = create_resp.json()["id"]

    # Activate it
    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200

    # advance-phased must fail for a rotating program
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 400


# ---------------------------------------------------------------------------
# Phased program: GET /phases endpoint tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_list_phases(auth_seeded_client: AsyncClient, db_session):
    """GET /api/programs/{id}/phases returns all phases with their workouts."""
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    program_id, phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name="List Phases Test",
        num_phases=2,
        days_per_week=3,
        duration_weeks=1,
        exercise_id=exercise_id,
    )

    resp = await auth_seeded_client.get(f"/api/programs/{program_id}/phases")
    assert resp.status_code == 200
    phases = resp.json()

    assert isinstance(phases, list)
    assert len(phases) == 2

    # Phases should be ordered and contain workout data
    assert phases[0]["name"] == "Phase 1"
    assert phases[0]["order"] == 0
    assert phases[0]["duration_weeks"] == 1

    assert phases[1]["name"] == "Phase 2"
    assert phases[1]["order"] == 1

    # Each phase should have workouts (3 days * 1 week = 3 workouts per phase)
    assert isinstance(phases[0]["workouts"], list)
    assert len(phases[0]["workouts"]) == 3

    # Verify workouts contain sections and exercises
    workout = phases[0]["workouts"][0]
    assert "sections" in workout
    assert len(workout["sections"]) == 1
    assert len(workout["sections"][0]["exercises"]) == 1


# ---------------------------------------------------------------------------
# Dynamic daysPerWeek: parametrize over 2 and 5 days per week
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
@pytest.mark.parametrize("days_per_week", [2, 5])
async def test_advance_phased_dynamic_days_per_week_increment(
    auth_seeded_client: AsyncClient, db_session, days_per_week: int
):
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Barbell Bench Press"
    )
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name=f"Dynamic {days_per_week}d Test",
        num_phases=1,
        days_per_week=days_per_week,
        duration_weeks=3,
        exercise_id=exercise_id,
    )

    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    assert activate_resp.json()["current_day_index"] == 0

    # Advance once — day should go from 0 to 1 (no wrap regardless of days_per_week)
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()
    assert data["current_day_index"] == 1
    assert data["current_week_in_phase"] == 0
    assert data["current_phase_index"] == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("days_per_week", [2, 5])
async def test_advance_phased_dynamic_days_per_week_wrap(
    auth_seeded_client: AsyncClient, db_session, days_per_week: int
):
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Barbell RDL")
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name=f"Dynamic wrap {days_per_week}d Test",
        num_phases=1,
        days_per_week=days_per_week,
        duration_weeks=3,
        exercise_id=exercise_id,
    )

    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    enrollment_id = activate_resp.json()["id"]

    from sqlalchemy import update as sa_update

    from app.models import UserProgram

    # Place enrollment at the last day of the first week
    last_day = days_per_week - 1
    await db_session.execute(
        sa_update(UserProgram)
        .where(UserProgram.id == enrollment_id)
        .values(current_day_index=last_day, current_week_in_phase=0)
    )
    await db_session.commit()

    # Advance — day must wrap to 0 and week must increment to 1
    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()
    assert data["current_day_index"] == 0
    assert data["current_week_in_phase"] == 1
    assert data["current_phase_index"] == 0


# ---------------------------------------------------------------------------
# Full cycle: all phases complete → started_at resets
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_advance_phased_full_cycle_resets_started_at(
    auth_seeded_client: AsyncClient, db_session
):
    me_resp = await auth_seeded_client.get("/api/auth/me")
    assert me_resp.status_code == 200
    user_id = me_resp.json()["id"]

    exercise_id = await _get_exercise_id_by_name(
        auth_seeded_client, "Smith Machine Squat"
    )
    # 2 phases, 1 week each, 3 days per week
    program_id, _phase_ids, _workout_ids = await _create_phased_program_in_db(
        db_session,
        user_id=user_id,
        program_name="Full Cycle Test",
        num_phases=2,
        days_per_week=3,
        duration_weeks=1,
        exercise_id=exercise_id,
    )

    activate_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/activate"
    )
    assert activate_resp.status_code == 200
    enrollment_id = activate_resp.json()["id"]
    original_started_at = activate_resp.json()["started_at"]

    from sqlalchemy import update as sa_update

    from app.models import UserProgram

    # Set enrollment to last day of last week of last phase:
    # current_day_index=2, current_week_in_phase=0 (duration=1, so last is 0),
    # current_phase_index=1 (last of 2 phases)
    await db_session.execute(
        sa_update(UserProgram)
        .where(UserProgram.id == enrollment_id)
        .values(
            current_day_index=2,
            current_week_in_phase=0,
            current_phase_index=1,
        )
    )
    await db_session.commit()

    advance_resp = await auth_seeded_client.post(
        f"/api/programs/{program_id}/advance-phased"
    )
    assert advance_resp.status_code == 200
    data = advance_resp.json()

    # All counters wrap back to the beginning
    assert data["current_day_index"] == 0
    assert data["current_week_in_phase"] == 0
    assert data["current_phase_index"] == 0

    # started_at must have been reset (not equal to the original value)
    assert data["started_at"] is not None
    assert data["started_at"] != original_started_at
