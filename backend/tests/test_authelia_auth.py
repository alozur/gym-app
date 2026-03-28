import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_me_with_authelia_headers(client: AsyncClient):
    """Authenticated request via Authelia headers returns user info."""
    headers = {
        "Remote-User": "testuser",
        "Remote-Email": "test@example.com",
        "Remote-Name": "Test User",
        "Remote-Groups": "users",
    }
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"


@pytest.mark.asyncio
async def test_me_without_headers_returns_401(client: AsyncClient):
    """Request without Authelia headers returns 401."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_auto_provisions_new_user(client: AsyncClient):
    """First request with new email creates user in DB."""
    headers = {
        "Remote-User": "newuser",
        "Remote-Email": "new@example.com",
        "Remote-Name": "New Person",
        "Remote-Groups": "users",
    }
    response = await client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "new@example.com"

    # Second request should return the same user
    response2 = await client.get("/api/auth/me", headers=headers)
    assert response2.json()["id"] == data["id"]


@pytest.mark.asyncio
async def test_existing_user_matched_by_email(client: AsyncClient):
    """Existing user matched by email, display_name not overwritten."""
    headers = {
        "Remote-User": "existinguser",
        "Remote-Email": "existing@example.com",
        "Remote-Name": "Original Name",
        "Remote-Groups": "users",
    }
    resp1 = await client.get("/api/auth/me", headers=headers)
    user_id = resp1.json()["id"]

    headers["Remote-Name"] = "Different Name"
    resp2 = await client.get("/api/auth/me", headers=headers)
    assert resp2.json()["id"] == user_id
    assert resp2.json()["display_name"] == "Original Name"
