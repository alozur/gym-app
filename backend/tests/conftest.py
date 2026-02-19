import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.database import Base
from app.dependencies import get_db
from app.main import app
from app.seed import seed_exercises

# Use SQLite in-memory for tests — translate "public" schema to None for SQLite
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    echo=False,
    execution_options={"schema_translate_map": {"public": None}},
)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


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
    """Client that is registered and logged in."""
    register_data = {
        "email": "test@example.com",
        "password": "testpassword123",
        "display_name": "Test User",
    }
    response = await client.post("/api/auth/register", json=register_data)
    assert response.status_code == 201
    tokens = response.json()

    client.headers["Authorization"] = f"Bearer {tokens['access_token']}"
    return client


@pytest_asyncio.fixture
async def auth_seeded_client(
    auth_client: AsyncClient, db_session: AsyncSession
) -> AsyncClient:
    """Authenticated client with seeded exercises."""
    await seed_exercises(db_session)
    return auth_client
