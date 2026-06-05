from fastapi import APIRouter

from app.schemas.inference import (
    AddDocRequest,
    AddDocResponse,
    SearchRequest,
    SearchResponse,
)
from app.services.search_service import SearchService

router = APIRouter()
service = SearchService()


@router.post("/add", response_model=AddDocResponse, status_code=201)
async def add_document(payload: AddDocRequest) -> AddDocResponse:
    return service.add_document(payload)


@router.post("/query", response_model=SearchResponse)
async def search(payload: SearchRequest) -> SearchResponse:
    return service.search(payload)
