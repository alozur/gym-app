import pytest
from httpx import AsyncClient

AUTHELIA_HEADERS = {
    "Remote-User": "testuser",
    "Remote-Email": "test@example.com",
    "Remote-Name": "Test User",
    "Remote-Groups": "users",
}


@pytest.mark.asyncio
async def test_me_returns_user(client: AsyncClient):
    response = await client.get("/api/auth/me", headers=AUTHELIA_HEADERS)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    assert data["display_name"] == "Test User"


@pytest.mark.asyncio
async def test_update_me(client: AsyncClient):
    # Create user first
    await client.get("/api/auth/me", headers=AUTHELIA_HEADERS)
    # Update
    response = await client.put(
        "/api/auth/me",
        json={"display_name": "Updated Name"},
        headers=AUTHELIA_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["display_name"] == "Updated Name"


@pytest.mark.asyncio
async def test_logout_returns_message(client: AsyncClient):
    response = await client.post("/api/auth/logout", headers=AUTHELIA_HEADERS)
    assert response.status_code == 200
    assert response.json()["message"] == "Successfully logged out"


@pytest.mark.asyncio
async def test_login_returns_410(client: AsyncClient):
    response = await client.post(
        "/api/auth/login",
        json={"email": "a@b.com", "password": "x"},
    )
    assert response.status_code == 410


@pytest.mark.asyncio
async def test_register_returns_410(client: AsyncClient):
    response = await client.post(
        "/api/auth/register",
        json={"email": "a@b.com", "password": "12345678", "display_name": "X"},
    )
    assert response.status_code == 410
