"""Tests for workout template CRUD routes."""

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
        "min_warmup_sets": 2,
        "max_warmup_sets": 3,
    }


@pytest.mark.asyncio
async def test_create_template_with_prescriptions(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Bench Press")

    payload = {
        "name": "Push Day",
        "template_exercises": [
            _make_template_exercise(exercise_id, "normal", 0),
            _make_template_exercise(exercise_id, "deload", 1),
        ],
    }

    response = await auth_seeded_client.post("/api/templates/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Push Day"
    assert "id" in data
    assert len(data["template_exercises"]) == 2

    week_types = [e["week_type"] for e in data["template_exercises"]]
    assert "normal" in week_types
    assert "deload" in week_types


@pytest.mark.asyncio
async def test_list_templates(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Squat")

    # Create a template first
    await auth_seeded_client.post(
        "/api/templates/",
        json={
            "name": "Leg Day",
            "template_exercises": [
                _make_template_exercise(exercise_id, "normal", 0),
            ],
        },
    )

    # List templates
    response = await auth_seeded_client.get("/api/templates/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    names = [t["name"] for t in data]
    assert "Leg Day" in names


@pytest.mark.asyncio
async def test_get_template_detail(auth_seeded_client: AsyncClient):
    exercise_id = await _get_exercise_id_by_name(auth_seeded_client, "Deadlift")

    # Create template with both normal and deload
    create_resp = await auth_seeded_client.post(
        "/api/templates/",
        json={
            "name": "Pull Day",
            "template_exercises": [
                _make_template_exercise(exercise_id, "normal", 0),
                _make_template_exercise(exercise_id, "deload", 1),
            ],
        },
    )
    template_id = create_resp.json()["id"]

    # Get detail
    response = await auth_seeded_client.get(f"/api/templates/{template_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == template_id
    assert data["name"] == "Pull Day"
    assert len(data["template_exercises"]) == 2

    # Verify both week types are present
    week_types = {e["week_type"] for e in data["template_exercises"]}
    assert week_types == {"normal", "deload"}

    # Verify prescription fields
    for ex in data["template_exercises"]:
        assert ex["working_sets"] == 3
        assert ex["min_reps"] == 8
        assert ex["max_reps"] == 12
        assert ex["rest_period"] == "2-3 min"
