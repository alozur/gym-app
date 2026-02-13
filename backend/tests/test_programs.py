"""Tests for program CRUD routes with routine rotation and deload logic."""

import pytest
from httpx import AsyncClient


async def _get_exercise_id_by_name(client: AsyncClient, name: str) -> str:
    """Helper to look up an exercise ID by name."""
    resp = await client.get("/api/exercises/")
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
        "/api/templates/",
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


@pytest.mark.asyncio
async def test_create_program_with_routines(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")
    t1 = await _create_template(auth_seeded_client, "Push Day", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Pull Day", exercise_id)

    resp = await auth_seeded_client.post(
        "/api/programs/",
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
    assert data["is_active"] is False
    assert data["routine_count"] == 2
    assert len(data["routines"]) == 2
    assert data["routines"][0]["template_name"] == "Push Day"
    assert data["routines"][1]["template_name"] == "Pull Day"


@pytest.mark.asyncio
async def test_list_programs(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Squat")
    t1 = await _create_template(auth_seeded_client, "Leg Day", exercise_id)

    await auth_seeded_client.post(
        "/api/programs/",
        json={
            "name": "Legs Only",
            "routines": [{"template_id": t1, "order": 0}],
        },
    )

    resp = await auth_seeded_client.get("/api/programs/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert any(p["name"] == "Legs Only" for p in data)


@pytest.mark.asyncio
async def test_get_program_detail(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Deadlift")
    t1 = await _create_template(auth_seeded_client, "DL Day", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")
    t1 = await _create_template(auth_seeded_client, "Day A", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Day B", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Squat")
    t1 = await _create_template(auth_seeded_client, "Temp", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")
    t1 = await _create_template(auth_seeded_client, "Activate Test", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")
    t1 = await _create_template(auth_seeded_client, "Today Push", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Today Pull", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_session_finish_advances_rotation(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")
    t1 = await _create_template(auth_seeded_client, "Rot A", exercise_id)
    t2 = await _create_template(auth_seeded_client, "Rot B", exercise_id)

    create_resp = await auth_seeded_client.post(
        "/api/programs/",
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

    await auth_seeded_client.post(f"/api/programs/{program_id}/activate")

    # Create a session linked to the program
    session_resp = await auth_seeded_client.post(
        "/api/sessions/",
        json={
            "template_id": t1,
            "program_id": program_id,
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

    # Verify rotation advanced
    prog_resp = await auth_seeded_client.get(f"/api/programs/{program_id}")
    assert prog_resp.status_code == 200
    prog_data = prog_resp.json()
    assert prog_data["current_routine_index"] == 1
    assert prog_data["weeks_completed"] == 0

    # Finish another session to wrap around
    session2_resp = await auth_seeded_client.post(
        "/api/sessions/",
        json={
            "template_id": t2,
            "program_id": program_id,
            "week_type": "normal",
            "year_week": "2025-01",
        },
    )
    session2_id = session2_resp.json()["id"]
    await auth_seeded_client.put(
        f"/api/sessions/{session2_id}",
        json={"finished_at": "2025-01-07T18:00:00"},
    )

    prog_resp2 = await auth_seeded_client.get(f"/api/programs/{program_id}")
    prog_data2 = prog_resp2.json()
    assert prog_data2["current_routine_index"] == 0
    assert prog_data2["weeks_completed"] == 1


@pytest.mark.asyncio
async def test_deload_detection(auth_seeded_client: AsyncClient):
    """After enough weeks, deload should be detected."""
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Squat")
    t1 = await _create_template(auth_seeded_client, "Deload Test", exercise_id)

    # Create program with deload_every_n_weeks=2 for quick testing
    # (1 routine, so each session = 1 week)
    create_resp = await auth_seeded_client.post(
        "/api/programs/",
        json={
            "name": "Deload Program",
            "deload_every_n_weeks": 2,
            "routines": [{"template_id": t1, "order": 0}],
        },
    )
    program_id = create_resp.json()["id"]
    await auth_seeded_client.post(f"/api/programs/{program_id}/activate")

    # Week 0 (weeks_completed=0): normal (0 % 2 == 0, not == 1)
    resp = await auth_seeded_client.get("/api/programs/today")
    assert resp.json()["is_deload"] is False

    # Complete one session -> weeks_completed=1
    s1 = await auth_seeded_client.post(
        "/api/sessions/",
        json={
            "template_id": t1,
            "program_id": program_id,
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
