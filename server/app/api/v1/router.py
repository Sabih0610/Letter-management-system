from fastapi import APIRouter

from app.api.v1.endpoints import ai, approvals, attachments, audit, auth, dashboard, dispatch, items, meta, reports, search, series, users

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(meta.router)
api_router.include_router(users.router)
api_router.include_router(series.router)
api_router.include_router(items.router)
api_router.include_router(attachments.router)
api_router.include_router(approvals.router)
api_router.include_router(dispatch.router)
api_router.include_router(dashboard.router)
api_router.include_router(search.router)
api_router.include_router(reports.router)
api_router.include_router(ai.router)
api_router.include_router(audit.router)

