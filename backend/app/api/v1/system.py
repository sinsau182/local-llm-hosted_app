from fastapi import APIRouter

from app.services.system_service import SystemService


router = APIRouter()
service = SystemService()


@router.get("/vram")
async def vram() -> dict[str, float]:
    return service.get_vram()


@router.get("/queue")
async def queue() -> dict[str, int]:
    return service.get_queue()
