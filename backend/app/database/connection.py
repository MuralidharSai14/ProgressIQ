"""
PROGRESSIQ — Database Setup
SQLAlchemy async engine + session factory for SQLite.
Think of this as: "the connection to the database".
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

import os

def get_engine_and_url():
    raw_url = str(getattr(settings, "database_url", "") or "").strip().strip("'\"")
    url = raw_url
    connect_args = {}

    if not url or url.startswith("sqlite") or url == ":memory:":
        if os.environ.get("VERCEL") or "/var/task" in os.getcwd():
            url = "sqlite+aiosqlite:////tmp/progressiq.db"
        else:
            url = "sqlite+aiosqlite:///./progressiq.db"
        connect_args["check_same_thread"] = False
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    pool_kwargs = {"pool_pre_ping": True}
    if "sqlite" not in url:
        pool_kwargs["pool_recycle"] = 300

    try:
        eng = create_async_engine(
            url,
            echo=False,
            connect_args=connect_args,
            **pool_kwargs,
        )
        return eng, url
    except Exception as e:
        fallback_url = "sqlite+aiosqlite:////tmp/progressiq.db" if (os.environ.get("VERCEL") or "/var/task" in os.getcwd()) else "sqlite+aiosqlite:///./progressiq.db"
        eng = create_async_engine(fallback_url, echo=False, connect_args={"check_same_thread": False}, pool_pre_ping=True)
        return eng, fallback_url

engine, _active_db_url = get_engine_and_url()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class that all database models inherit from."""
    pass


_db_initialized = False

async def ensure_db_ready():
    global _db_initialized
    if not _db_initialized:
        try:
            from app.api.auth import seed_default_users
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
            async with AsyncSessionLocal() as db:
                await seed_default_users(db)
            _db_initialized = True
        except Exception as e:
            _db_initialized = True


async def get_db():
    """
    FastAPI dependency — yields a database session for each request.
    Automatically closes the session when the request is done.
    """
    await ensure_db_ready()
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_all_tables():
    """Create all database tables on startup (if they don't already exist)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
