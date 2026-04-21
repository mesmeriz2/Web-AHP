import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.api.admin import router as admin_router
from app.api.health import router as health_router
from app.api.participant import router as participant_router
from app.api.user import router as user_router
from app.core.constants import ROLE_SUPER_ADMIN
from app.core.settings import get_settings
from app.db.base import Base
from app.db.session import engine, SessionLocal
from app import models  # noqa: F401

settings = get_settings()

_DEFAULT_CORS_ORIGINS = [
    "http://localhost:5175",
    "http://127.0.0.1:5175",
    "https://localhost",
    "http://localhost",
    "https://blinktask.work",
    "http://blinktask.work",
]
_env_cors = os.getenv("CORS_ORIGINS", "").strip()
_env_origins = [o.strip() for o in _env_cors.split(",") if o.strip()]
cors_origins = list({*_DEFAULT_CORS_ORIGINS, *_env_origins})

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(health_router)
app.include_router(admin_router)
app.include_router(participant_router)
app.include_router(user_router)


def _add_column_if_missing(conn, table_name: str, column_name: str, column_type: str):
    """테이블에 컬럼이 없으면 ALTER TABLE로 추가."""
    inspector = inspect(conn)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    if column_name not in columns:
        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}"))


def _seed_super_admin(db):
    """super_admin이 없으면 생성하거나 기존 초기 계정을 승격."""
    from app.models.user import User
    from app.services.auth import generate_salt, hash_password
    from app.services.utils import generate_id

    # 이미 super_admin이 존재하면 그 ID 반환
    existing_super = db.query(User).filter(User.role == ROLE_SUPER_ADMIN).first()
    if existing_super:
        return existing_super.id

    # super_admin은 없지만 초기 계정(username 일치)이 있으면 role 승격
    existing_user = db.query(User).filter(
        User.username == settings.initial_super_admin_username
    ).first()
    if existing_user:
        existing_user.role = ROLE_SUPER_ADMIN
        db.commit()
        return existing_user.id

    # 아무 계정도 없으면 새로 생성
    salt = generate_salt()
    pwd_hash = hash_password(settings.initial_super_admin_password, salt)
    user = User(
        id=generate_id(),
        email=settings.initial_super_admin_email,
        username=settings.initial_super_admin_username,
        password_hash=pwd_hash,
        password_salt=salt,
        role=ROLE_SUPER_ADMIN,
        is_active=True,
    )
    db.add(user)
    db.commit()
    return user.id


def _assign_orphan_records(db, super_admin_id: str):
    """owner_id가 NULL인 프로젝트/템플릿을 super_admin에게 할당."""
    from app.models.project import Project
    from app.models.template import SurveyTemplate

    db.query(Project).filter(Project.owner_id.is_(None)).update(
        {"owner_id": super_admin_id}, synchronize_session=False
    )
    db.query(SurveyTemplate).filter(SurveyTemplate.owner_id.is_(None)).update(
        {"owner_id": super_admin_id}, synchronize_session=False
    )
    db.commit()


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        _add_column_if_missing(conn, "projects", "owner_id", "VARCHAR REFERENCES users(id)")
        _add_column_if_missing(conn, "survey_templates", "owner_id", "VARCHAR REFERENCES users(id)")
        conn.commit()

    db = SessionLocal()
    try:
        super_admin_id = _seed_super_admin(db)
        if super_admin_id:
            _assign_orphan_records(db, super_admin_id)
        else:
            from app.models.user import User
            sa = db.query(User).filter(User.role == ROLE_SUPER_ADMIN).first()
            if sa:
                _assign_orphan_records(db, sa.id)
    finally:
        db.close()
