from pydantic import BaseModel, EmailStr


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserProfileResponse(BaseModel):
    user_id: str
    email: EmailStr
    full_name: str
    role: str
    storage_quota_bytes: int
    storage_used_bytes: int
