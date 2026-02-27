from typing import Optional

from pydantic import BaseModel


class AdminLoginRequest(BaseModel):
    login_id: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str
    expires_at: str
    user: Optional[dict] = None
