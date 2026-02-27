from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.constants import ROLE_ADMIN, ROLE_SUPER_ADMIN
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import (
    PasswordChangeRequest,
    UserCreateRequest,
    UserInfo,
    UserListItem,
    UserLoginRequest,
    UserLoginResponse,
    UserUpdateRequest,
)
from app.services.auth import (
    authenticate_user,
    create_token,
    generate_salt,
    get_current_user,
    hash_password,
    require_super_admin,
    verify_password,
)
from app.services.utils import generate_id

router = APIRouter(prefix="/api/users", tags=["users"])


@router.post("/login", response_model=UserLoginResponse)
def user_login(request: UserLoginRequest, db: Session = Depends(get_db)):
    user = authenticate_user(db, request.login_id, request.password)
    token_data = create_token(user)
    return UserLoginResponse(
        token=token_data["token"],
        expires_at=token_data["expires_at"],
        user=UserInfo(**token_data["user"]),
    )


@router.get("/me", response_model=UserInfo)
def get_me(current_user: User = Depends(get_current_user)):
    return UserInfo(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role,
    )


@router.patch("/me/password")
def change_password(
    request: PasswordChangeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(request.current_password, current_user.password_salt, current_user.password_hash):
        raise HTTPException(status_code=400, detail="current password is incorrect")
    if len(request.new_password) < 4:
        raise HTTPException(status_code=400, detail="password too short")
    new_salt = generate_salt()
    current_user.password_salt = new_salt
    current_user.password_hash = hash_password(request.new_password, new_salt)
    db.commit()
    return {"status": "password changed"}


@router.get("/", response_model=List[UserListItem])
def list_users(
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [
        UserListItem(
            id=u.id,
            email=u.email,
            username=u.username,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at.isoformat() if u.created_at else "",
        )
        for u in users
    ]


@router.post("/", response_model=UserListItem)
def create_user(
    request: UserCreateRequest,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if request.role not in (ROLE_ADMIN, ROLE_SUPER_ADMIN):
        raise HTTPException(status_code=400, detail="invalid role")
    if len(request.password) < 4:
        raise HTTPException(status_code=400, detail="password too short")

    existing = db.query(User).filter(
        (User.email == request.email) | (User.username == request.username)
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="email or username already exists")

    salt = generate_salt()
    user = User(
        id=generate_id(),
        email=request.email,
        username=request.username,
        password_hash=hash_password(request.password, salt),
        password_salt=salt,
        role=request.role,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return UserListItem(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.patch("/{user_id}", response_model=UserListItem)
def update_user(
    user_id: str,
    request: UserUpdateRequest,
    _: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")

    if request.email is not None:
        dup = db.query(User).filter(User.email == request.email, User.id != user_id).first()
        if dup:
            raise HTTPException(status_code=409, detail="email already in use")
        user.email = request.email

    if request.username is not None:
        dup = db.query(User).filter(User.username == request.username, User.id != user_id).first()
        if dup:
            raise HTTPException(status_code=409, detail="username already in use")
        user.username = request.username

    if request.role is not None:
        if request.role not in (ROLE_ADMIN, ROLE_SUPER_ADMIN):
            raise HTTPException(status_code=400, detail="invalid role")
        user.role = request.role

    if request.is_active is not None:
        user.is_active = request.is_active

    if request.password is not None:
        if len(request.password) < 4:
            raise HTTPException(status_code=400, detail="password too short")
        new_salt = generate_salt()
        user.password_salt = new_salt
        user.password_hash = hash_password(request.password, new_salt)

    db.commit()
    return UserListItem(
        id=user.id,
        email=user.email,
        username=user.username,
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else "",
    )


@router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot deactivate yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    user.is_active = False
    db.commit()
    return {"status": "deactivated"}
