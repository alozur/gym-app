"""Tests for exercise progress auto-tracking."""

import pytest
from httpx import AsyncClient


async def _get_exercise_id_by_name(client: AsyncClient, name: str) -> str:
    resp = await client.get("/api/exercises/")
    exercises = resp.json()
    exercise = next(e for e in exercises if e["name"] == name)
    return exercise["id"]


@pytest.mark.asyncio
async def test_exercise_progress_updated_on_set_log(auth_seeded_client: AsyncClient):
    """Logging a working set should create/update the exercise progress record."""
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")

    # Create a session with year_week (required for progress tracking)
    session_resp = await auth_seeded_client.post(
        "/api/sessions/",
        json={"week_type": "normal", "year_week": "2025-27"},
    )
    session = session_resp.json()

    # Log a working set
    await auth_seeded_client.post(
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

    # Check progress
    progress_resp = await auth_seeded_client.get(
        f"/api/progress/exercise/{exercise_id}"
    )
    assert progress_resp.status_code == 200
    progress_data = progress_resp.json()
    assert len(progress_data) >= 1

    week_data = next(p for p in progress_data if p["year_week"] == "2025-27")
    assert float(week_data["max_weight"]) == 80.0

    # Log a heavier set and verify max_weight updates
    await auth_seeded_client.post(
        f"/api/sessions/{session['id']}/sets",
        json={
            "exercise_id": exercise_id,
            "set_type": "working",
            "set_number": 2,
            "reps": 6,
            "weight": 90.0,
            "rpe": 9.0,
        },
    )

    progress_resp2 = await auth_seeded_client.get(
        f"/api/progress/exercise/{exercise_id}"
    )
    progress_data2 = progress_resp2.json()
    week_data2 = next(p for p in progress_data2 if p["year_week"] == "2025-27")
    assert float(week_data2["max_weight"]) == 90.0
