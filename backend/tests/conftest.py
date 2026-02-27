from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

# 테스트 수집 전 프로젝트 루트(AHP) .env 로드. backend/에서 pytest 시 Settings 검증 통과.
_env_file = Path(__file__).resolve().parents[2] / ".env"
if _env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(_env_file)
