"""Tests for exercise CRUD routes."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_exercises(auth_seeded_client: AsyncClient):
    response = await auth_seeded_client.get("/api/exercises/")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 19  # 19 seeded exercises
    names = [e["name"] for e in data]
    assert "Lying Leg Curl" in names
    assert "Bench Press" in names
    assert "Squat" in names


@pytest.mark.asyncio
async def test_create_custom_exercise(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/exercises/",
        json={
            "name": "My Custom Exercise",
            "muscle_group": "Chest",
            "equipment": "Dumbbell",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "My Custom Exercise"
    assert data["muscle_group"] == "Chest"
    assert data["is_custom"] is True
    assert data["equipment"] == "Dumbbell"

    # Verify it appears in listing
    list_resp = await auth_client.get("/api/exercises/")
    assert list_resp.status_code == 200
    names = [e["name"] for e in list_resp.json()]
    assert "My Custom Exercise" in names


@pytest.mark.asyncio
async def test_get_exercise_with_substitutions(auth_seeded_client: AsyncClient):
    # Get all exercises to find Lying Leg Curl
    list_resp = await auth_seeded_client.get("/api/exercises/")
    exercises = list_resp.json()
    lying_leg_curl = next(e for e in exercises if e["name"] == "Lying Leg Curl")

    # Get exercise detail
    response = await auth_seeded_client.get(f"/api/exercises/{lying_leg_curl['id']}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Lying Leg Curl"
    assert len(data["substitutions"]) == 2

    sub_names = []
    for sub in data["substitutions"]:
        assert "substitute_exercise_id" in sub
        assert "priority" in sub

    # Verify the expected substitutions by priority
    subs_by_priority = sorted(data["substitutions"], key=lambda s: s["priority"])
    assert subs_by_priority[0]["priority"] == 1
    assert subs_by_priority[1]["priority"] == 2
