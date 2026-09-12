"""
PROGRESSIQ — Database Setup
SQLAlchemy async engine + session factory for SQLite.
Think of this as: "the connection to the database".
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

def get_engine_and_url():
    url = settings.database_url
    connect_args = {}

    if url.startswith("sqlite:///"):
        url = url.replace("sqlite:///", "sqlite+aiosqlite:///")
        connect_args["check_same_thread"] = False
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

    eng = create_async_engine(
        url,
        echo=False,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    return eng, url

engine, _active_db_url = get_engine_and_url()

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class that all database models inherit from."""
    pass


async def get_db():
    """
    FastAPI dependency — yields a database session for each request.
    Automatically closes the session when the request is done.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def create_all_tables():
    """Create all database tables on startup (if they don't already exist)."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
