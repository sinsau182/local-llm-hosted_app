from fastapi import APIRouter, Header, HTTPException, Response

from app.schemas.storage import ArtifactListResponse, QuotaResponse
from app.services.storage_service import StorageService


router = APIRouter()
service = StorageService()


def _user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return x_user_id


@router.get("/quota", response_model=QuotaResponse)
async def quota(x_user_id: str | None = Header(default=None)) -> QuotaResponse:
    return service.get_quota(_user_id(x_user_id))


@router.get("/files", response_model=ArtifactListResponse)
async def files(x_user_id: str | None = Header(default=None)) -> ArtifactListResponse:
    return service.list_files(_user_id(x_user_id))


@router.delete("/files/{artifact_id}", status_code=204)
async def delete_file(artifact_id: str, x_user_id: str | None = Header(default=None)) -> Response:
    deleted = service.delete_file(_user_id(x_user_id), artifact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return Response(status_code=204)
