from fastapi import APIRouter, Header, HTTPException

from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse
from app.services.auth_service import AuthService


router = APIRouter()
service = AuthService()


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest) -> TokenResponse:
    return service.login(payload)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(authorization: str | None = Header(default=None)) -> TokenResponse:
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing authorization header")
    return TokenResponse(access_token="new_access_token", refresh_token="new_refresh_token")


@router.get("/me", response_model=UserProfileResponse)
async def me(x_user_email: str | None = Header(default=None)) -> UserProfileResponse:
    if not x_user_email:
        raise HTTPException(status_code=401, detail="Missing x-user-email header")
    return service.me(x_user_email)
