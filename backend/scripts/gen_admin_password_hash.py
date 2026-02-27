#!/usr/bin/env python3
"""
관리자 비밀번호 해시 생성 스크립트.
.env의 ADMIN_PASSWORD_SALT, ADMIN_PASSWORD_HASH 설정 시 사용합니다.

사용법:
  python scripts/gen_admin_password_hash.py [SALT] [PASSWORD]
  또는 환경변수 ADMIN_PASSWORD_SALT, 비밀번호 입력 프롬프트 사용

예:
  python scripts/gen_admin_password_hash.py mySalt123 myPassword
  -> 출력된 해시를 .env의 ADMIN_PASSWORD_HASH에 넣고,
     ADMIN_PASSWORD_SALT=mySalt123 으로 설정
"""
import hashlib
import os
import sys


def hash_password(salt: str, password: str) -> str:
    salted = f"{salt}{password}".encode("utf-8")
    return hashlib.sha256(salted).hexdigest()


def main() -> None:
    if len(sys.argv) >= 3:
        salt = sys.argv[1]
        password = sys.argv[2]
    else:
        salt = os.environ.get("ADMIN_PASSWORD_SALT", "").strip()
        if not salt:
            salt = input("ADMIN_PASSWORD_SALT (입력 후 Enter): ").strip()
        if not salt:
            print("SALT가 비어 있습니다. .env에 넣을 salt 문자열을 입력하세요.", file=sys.stderr)
            sys.exit(1)
        password = input("비밀번호 (입력 후 Enter): ")
    hashed = hash_password(salt, password)
    print("아래 값을 .env의 ADMIN_PASSWORD_HASH에 넣으세요:")
    print(hashed)
    print()
    print(".env 예시:")
    print(f"ADMIN_PASSWORD_SALT={salt}")
    print(f"ADMIN_PASSWORD_HASH={hashed}")


if __name__ == "__main__":
    main()
