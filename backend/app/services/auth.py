import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Dict

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.constants import ROLE_SUPER_ADMIN
from app.core.settings import get_settings
from app.db.session import get_db
from app.models.user import User

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


def generate_salt() -> str:
    return secrets.token_hex(16)


def hash_password(password: str, salt: str) -> str:
    salted = f"{salt}{password}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_password(password, salt), expected_hash)


def authenticate_user(db: Session, login_id: str, password: str) -> User:
    """email 또는 username으로 사용자 조회 후 비밀번호 검증."""
    user = db.query(User).filter(
        (User.email == login_id) | (User.username == login_id)
    ).first()
    if not user:
        raise HTTPException(status_code=401, detail="invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="account disabled")
    if not verify_password(password, user.password_salt, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid credentials")
    return user


def create_token(user: User) -> Dict[str, object]:
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.admin_jwt_expires_minutes)
    payload = {
        "sub": user.id,
        "role": user.role,
        "username": user.username,
        "exp": expires_at,
    }
    token = jwt.encode(payload, settings.admin_jwt_secret, algorithm=settings.admin_jwt_algorithm)
    return {
        "token": token,
        "expires_at": expires_at.isoformat(),
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        },
    }


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=401, detail="missing authorization")
    if credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="invalid auth scheme")
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.admin_jwt_secret,
            algorithms=[settings.admin_jwt_algorithm],
        )
    except jwt.ExpiredSignatureError as error:
        raise HTTPException(status_code=401, detail="token expired") from error
    except jwt.InvalidTokenError as error:
        raise HTTPException(status_code=401, detail="invalid token") from error

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid token subject")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="user not found")
    if not user.is_active:
        raise HTTPException(status_code=401, detail="account disabled")
    return user


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != ROLE_SUPER_ADMIN:
        raise HTTPException(status_code=403, detail="super admin access required")
    return current_user
