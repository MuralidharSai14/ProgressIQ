"""
PROGRESSIQ — Database Setup
SQLAlchemy async engine + session factory for SQLite.
Think of this as: "the connection to the database".
"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from app.config import get_settings

settings = get_settings()

# Convert sqlite:///./file.db → sqlite+aiosqlite:///./file.db for async support
_db_url = settings.database_url.replace("sqlite:///", "sqlite+aiosqlite:///")

engine = create_async_engine(
    _db_url,
    echo=False,
    connect_args={"check_same_thread": False},
)

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
