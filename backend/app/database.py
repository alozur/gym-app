from collections.abc import AsyncGenerator

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite+aiosqlite:///./gym_tracker.db"
    JWT_SECRET: str = "change-me"
    CORS_ORIGINS: str = "http://localhost:5173"
    DB_SCHEMA: str = "public"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    execution_options={"schema_translate_map": {None: settings.DB_SCHEMA}},
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    metadata = MetaData(schema=settings.DB_SCHEMA)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
