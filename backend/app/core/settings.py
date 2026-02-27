from functools import lru_cache
import json
from pathlib import Path
from typing import Dict, List

from pydantic_settings import BaseSettings, SettingsConfigDict

APP_VERSION = "1.0.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    project_name: str
    app_env: str
    backend_port: int
    frontend_port: int

    database_url: str
    min_participants: int
    max_participants: int
    cr_threshold: float
    ahp_ri_table_path: str
    cors_origins: str = ""
    ahp_max_iter: int
    ahp_tolerance: float
    project_code_length: int
    admin_code_length: int
    participant_code_length: int
    admin_id: str
    admin_password_salt: str
    admin_password_hash: str
    admin_jwt_secret: str
    admin_jwt_algorithm: str
    admin_jwt_expires_minutes: int

    initial_super_admin_email: str = "admin@ahp.local"
    initial_super_admin_username: str = "admin"
    initial_super_admin_password: str = "admin1234"

    def load_ri_table(self) -> Dict[int, float]:
        ri_path = Path(self.ahp_ri_table_path)
        if not ri_path.is_file():
            ri_path = Path(__file__).resolve().parent / ri_path
        raw = json.loads(ri_path.read_text(encoding="utf-8"))
        return {int(k): float(v) for k, v in raw.items()}

    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_ri_table() -> Dict[int, float]:
    """캐시된 RI 테이블 반환. 반복 파일 I/O 방지."""
    return get_settings().load_ri_table()


@lru_cache
def get_settings() -> Settings:
    return Settings()
