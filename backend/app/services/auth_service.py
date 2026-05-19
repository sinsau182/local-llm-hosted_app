from app.core.security import create_access_token, create_refresh_token
from app.schemas.auth import LoginRequest, TokenResponse, UserProfileResponse


class AuthService:
    def login(self, payload: LoginRequest) -> TokenResponse:
        subject = str(payload.email)
        return TokenResponse(
            access_token=create_access_token(subject),
            refresh_token=create_refresh_token(subject),
        )

    def me(self, subject: str) -> UserProfileResponse:
        return UserProfileResponse(
            user_id="00000000-0000-0000-0000-000000000001",
            email=subject,
            full_name="Platform User",
            role="user",
            storage_quota_bytes=322122547200,
            storage_used_bytes=0,
        )
