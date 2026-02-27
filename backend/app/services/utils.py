import secrets
from uuid import uuid4

from app.core.settings import get_settings

settings = get_settings()


def generate_id() -> str:
    return str(uuid4())


def generate_code(length: int) -> str:
    if length <= 0:
        raise ValueError("code length must be positive")
    token = secrets.token_urlsafe(length)
    return token[:length]


def generate_project_code() -> str:
    return generate_code(settings.project_code_length)


def generate_admin_code() -> str:
    return generate_code(settings.admin_code_length)


def generate_participant_code() -> str:
    return generate_code(settings.participant_code_length)
