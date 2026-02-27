from typing import Optional

from pydantic import BaseModel


class UserLoginRequest(BaseModel):
    login_id: str
    password: str


class UserInfo(BaseModel):
    id: str
    username: str
    email: str
    role: str


class UserLoginResponse(BaseModel):
    token: str
    expires_at: str
    user: UserInfo


class UserCreateRequest(BaseModel):
    email: str
    username: str
    password: str
    role: Optional[str] = "admin"


class UserUpdateRequest(BaseModel):
    email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


class UserListItem(BaseModel):
    id: str
    email: str
    username: str
    role: str
    is_active: bool
    created_at: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
