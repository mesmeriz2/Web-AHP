from fastapi import APIRouter

from app.core.settings import APP_VERSION

router = APIRouter()


@router.get("/api/health")
def health_check():
    return {"status": "ok", "version": APP_VERSION}
