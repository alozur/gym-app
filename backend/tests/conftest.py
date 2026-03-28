import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

import app.database as _db_module

# SQLite doesn't support schemas — clear before models are registered
_db_module.Base.metadata.schema = None

from app.database import Base  # noqa: E402
from app.dependencies import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.seed import seed_exercises  # noqa: E402

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

AUTHELIA_HEADERS = {
    "Remote-User": "testuser",
    "Remote-Email": "test@example.com",
    "Remote-Name": "Test User",
    "Remote-Groups": "users",
}


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def seeded_client(client: AsyncClient, db_session: AsyncSession) -> AsyncClient:
    """Client with seeded exercises."""
    await seed_exercises(db_session)
    return client


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncClient:
    """Client authenticated via Authelia headers."""
    # Auto-provision the user by hitting /me with headers
    response = await client.get("/api/auth/me", headers=AUTHELIA_HEADERS)
    assert response.status_code == 200

    # Set headers for all subsequent requests
    client.headers.update(AUTHELIA_HEADERS)
    return client


@pytest_asyncio.fixture
async def auth_seeded_client(
    auth_client: AsyncClient, db_session: AsyncSession
) -> AsyncClient:
    """Authenticated client with seeded exercises."""
    await seed_exercises(db_session)
    return auth_client
