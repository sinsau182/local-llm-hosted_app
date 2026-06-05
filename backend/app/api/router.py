from fastapi import APIRouter

from app.api.v1 import auth, inference, search, storage, system


api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(inference.router, prefix="/inference", tags=["inference"])
api_router.include_router(search.router, prefix="/search", tags=["search"])
api_router.include_router(storage.router, prefix="/storage", tags=["storage"])
api_router.include_router(system.router, prefix="/sys", tags=["system"])
