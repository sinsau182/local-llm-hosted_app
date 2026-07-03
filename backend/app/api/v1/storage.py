from fastapi import APIRouter, Depends, Header, HTTPException, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.storage import ArtifactListResponse, QuotaResponse
from app.services.media_bucket import bucket
from app.services.storage_service import StorageService


router = APIRouter()


def _user_id(x_user_id: str | None) -> str:
    if not x_user_id:
        raise HTTPException(status_code=401, detail="Missing x-user-id header")
    return x_user_id


@router.get("/quota", response_model=QuotaResponse)
async def quota(x_user_id: str | None = Header(default=None), db: Session = Depends(get_db)) -> QuotaResponse:
    return StorageService(db).get_quota(_user_id(x_user_id))


@router.get("/files", response_model=ArtifactListResponse)
async def files(x_user_id: str | None = Header(default=None), db: Session = Depends(get_db)) -> ArtifactListResponse:
    return StorageService(db).list_files(_user_id(x_user_id))


@router.get("/files/{artifact_id}/content")
async def file_content(artifact_id: str, db: Session = Depends(get_db)) -> StreamingResponse:
    """Stream a generated asset from the media bucket. Public by unguessable
    artifact id so it can be used directly as an <img>/<video> src (browsers
    can't attach the x-user-id header to media requests)."""
    artifact = StorageService(db).get_artifact(artifact_id)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    try:
        stream, content_type, size = bucket.stream(artifact.file_path)
    except Exception:  # noqa: BLE001 — object missing / backend down
        raise HTTPException(status_code=404, detail="Object not available")
    headers = {"Content-Disposition": f'inline; filename="{artifact.file_path.split("/")[-1]}"'}
    if size:
        headers["Content-Length"] = str(size)
    return StreamingResponse(stream, media_type=content_type, headers=headers)


@router.delete("/files/{artifact_id}", status_code=204)
async def delete_file(
    artifact_id: str, x_user_id: str | None = Header(default=None), db: Session = Depends(get_db)
) -> Response:
    deleted = StorageService(db).delete_file(_user_id(x_user_id), artifact_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Artifact not found")
    return Response(status_code=204)
