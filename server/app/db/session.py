from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings

settings = get_settings()

connect_args = {}
engine_kwargs = {
    "pool_size": settings.db_pool_size,
    "max_overflow": settings.db_max_overflow,
    "pool_timeout": settings.db_pool_timeout_seconds,
    "pool_recycle": settings.db_pool_recycle_seconds,
}
if settings.database_url.startswith("postgresql+asyncpg://") and "supabase.co" in settings.database_url:
    # Supabase Postgres requires TLS.
    connect_args["ssl"] = "require"
if "pooler.supabase.com" in settings.database_url:
    # Supabase transaction pooler (PgBouncer) is incompatible with asyncpg statement cache.
    connect_args["statement_cache_size"] = 0

engine = create_async_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
    connect_args=connect_args,
    **engine_kwargs,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
