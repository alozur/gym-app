"""Tests for workout session and set logging routes."""

import pytest
from httpx import AsyncClient


async def _get_exercise_id_by_name(client: AsyncClient, name: str) -> str:
    resp = await client.get("/api/exercises/")
    exercises = resp.json()
    exercise = next(e for e in exercises if e["name"] == name)
    return exercise["id"]


async def _create_session(client: AsyncClient, week_type: str = "normal") -> dict:
    """Helper to create a workout session."""
    response = await client.post(
        "/api/sessions/",
        json={"week_type": week_type, "year_week": "2025-27"},
    )
    assert response.status_code == 201
    return response.json()


@pytest.mark.asyncio
async def test_create_session(auth_seeded_client: AsyncClient):
    response = await auth_seeded_client.post(
        "/api/sessions/",
        json={"week_type": "normal", "year_week": "2025-27"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["week_type"] == "normal"
    assert data["year_week"] == "2025-27"
    assert data["synced"] is False
    assert data["finished_at"] is None
    assert "id" in data
    assert "started_at" in data


@pytest.mark.asyncio
async def test_log_warmup_set(auth_seeded_client: AsyncClient):
    session = await _create_session(auth_seeded_client)
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Barbell Bench Press")

    response = await auth_seeded_client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "exercise_id": exercise_id,
            "set_type": "warmup",
            "set_number": 1,
            "reps": 10,
            "weight": 40.0,
            "rpe": None,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["set_type"] == "warmup"
    assert data["set_number"] == 1
    assert data["reps"] == 10
    assert float(data["weight"]) == 40.0
    assert data["exercise_id"] == exercise_id


@pytest.mark.asyncio
async def test_log_working_set(auth_seeded_client: AsyncClient):
    session = await _create_session(auth_seeded_client)
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Barbell Bench Press")

    response = await auth_seeded_client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "exercise_id": exercise_id,
            "set_type": "working",
            "set_number": 1,
            "reps": 8,
            "weight": 80.0,
            "rpe": 8.0,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["set_type"] == "working"
    assert data["reps"] == 8
    assert float(data["weight"]) == 80.0
    assert float(data["rpe"]) == 8.0


@pytest.mark.asyncio
async def test_get_session_with_sets(auth_seeded_client: AsyncClient):
    session = await _create_session(auth_seeded_client)
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Smith Machine Squat")

    # Log a warmup set
    await auth_seeded_client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "exercise_id": exercise_id,
            "set_type": "warmup",
            "set_number": 1,
            "reps": 10,
            "weight": 60.0,
        },
    )
    # Log a working set
    await auth_seeded_client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "exercise_id": exercise_id,
            "set_type": "working",
            "set_number": 1,
            "reps": 5,
            "weight": 100.0,
            "rpe": 8.5,
        },
    )

    # Get session detail
    response = await auth_seeded_client.get(f"/api/sessions/{session['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == session["id"]
    assert len(data["sets"]) == 2

    set_types = [s["set_type"] for s in data["sets"]]
    assert "warmup" in set_types
    assert "working" in set_types
