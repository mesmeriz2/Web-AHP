# Web-AHP

AHP(계층분석법, Analytic Hierarchy Process) 기반의 의사결정 지원 플랫폼입니다.
관리자가 목표 → 기준 → 대안의 계층 구조를 설계하면, 참여자가 쌍대비교 설문을 완료하고, 시스템이 우선순위 가중치와 일관성 비율(CR)을 자동으로 계산합니다.

## 주요 기능

- **계층 구조 설계** — 목표, 기준, 대안을 트리 형태로 구성
- **쌍대비교 설문** — 참여자 코드 입력만으로 설문 참여 (회원가입 불필요)
- **AHP 연산** — 고유벡터 기반 우선순위 계산, 일관성 지수(CI/CR) 자동 검증
- **결과 집계** — 참여자별 행렬의 기하평균 집계 후 전역 가중치 산출
- **설문 템플릿** — 계층 구조를 저장·재사용
- **다중 사용자(RBAC)** — Super Admin, Admin 역할 분리

## 기술 스택

| 레이어 | 기술 |
|--------|------|
| Frontend | React 18, TypeScript, Vite, MUI, Recharts |
| Backend | FastAPI, SQLAlchemy (async), NumPy, PyJWT |
| Database | PostgreSQL 16 |
| Infra | Docker, Docker Compose |

## 시작하기

### 1. 환경 변수 설정

```bash
cp env.example .env
```

`.env`를 열어 아래 항목을 필수로 수정합니다.

| 변수 | 설명 |
|------|------|
| `POSTGRES_PASSWORD` | PostgreSQL 비밀번호 |
| `DATABASE_URL` | SQLAlchemy 접속 URL |
| `ADMIN_PASSWORD_SALT` | 관리자 비밀번호 salt |
| `ADMIN_PASSWORD_HASH` | SHA-256 해시 (아래 스크립트로 생성) |
| `ADMIN_JWT_SECRET` | JWT 서명 키 |

**관리자 비밀번호 해시 생성:**

```bash
python backend/scripts/gen_admin_password_hash.py <SALT> <PASSWORD>
```

### 2. Docker로 실행 (권장)

```bash
docker-compose up --build
```

| 서비스 | URL |
|--------|-----|
| Frontend | http://localhost:5175 |
| Backend API | http://localhost:8006 |
| PostgreSQL | localhost:5434 |

### 3. 로컬 개발 (개별 실행)

**Backend**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend**
```bash
cd frontend
npm install
npm run dev   # http://localhost:5173
```

## 프로젝트 구조

```
.
├── backend/
│   ├── app/
│   │   ├── api/          # FastAPI 라우터 (admin, participant, health)
│   │   ├── models/       # SQLAlchemy ORM 모델
│   │   ├── schemas/      # Pydantic DTO
│   │   ├── services/     # 비즈니스 로직 (AHP 연산, 계층 구조, 결과 집계)
│   │   ├── core/         # 설정, 상수
│   │   └── db/           # DB 세션 팩토리
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/          # Axios 요청 함수
│       ├── pages/        # Admin / Participant 페이지
│       ├── components/   # UI 컴포넌트
│       └── types/        # TypeScript 타입 정의
├── docker-compose.yml
└── env.example
```

## API 주요 엔드포인트

모든 경로는 `/api` 하위입니다.

| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/admin/login` | 관리자 로그인 (JWT 반환) |
| GET/POST | `/admin/projects` | 프로젝트 목록 조회 / 생성 |
| GET/PATCH/DELETE | `/admin/projects/{id}` | 프로젝트 CRUD |
| GET/POST | `/admin/projects/{id}/hierarchy` | 계층 노드 조회 / 추가 |
| GET | `/admin/projects/{id}/results` | AHP 결과 집계 조회 |
| GET/POST | `/admin/projects/{id}/participants` | 참여자 관리 |
| GET | `/participant/{code}/tasks` | 참여자 설문 목록 조회 |
| POST | `/participant/submit` | 쌍대비교 행렬 제출 |

## AHP 워크플로우

```
관리자                          참여자
  │                               │
  ├─ 프로젝트 생성                 │
  ├─ 계층 구조 설계                │
  │  (목표 → 기준 → 대안)          │
  ├─ 참여자 코드 생성              │
  │                    코드 입력 ──┤
  │                    쌍대비교   ─┤
  │                    행렬 제출  ─┤
  │                               │
  ├─ 결과 조회
  │  (기하평균 집계 → 고유벡터
  │   → 전역 가중치 / CR 검증)
```

## 테스트

```bash
cd backend
pytest                                        # 전체 테스트
pytest tests/test_ahp_consistency.py         # AHP 일관성 테스트
```

## 환경 변수 주요 옵션

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `CR_THRESHOLD` | `0.1` | 일관성 비율 허용 임계값 |
| `MIN_PARTICIPANTS` | `1` | 프로젝트 최소 참여자 수 |
| `MAX_PARTICIPANTS` | `20` | 프로젝트 최대 참여자 수 |
| `VITE_API_BASE_URL` | `http://localhost:8006` | 프론트엔드 API 기본 URL |
| `VITE_PAIRWISE_SCALE` | `1,2,3,4,5,6,7,8,9` | 쌍대비교 척도 |

> 역프록시(예: Synology) 환경에서는 `VITE_API_BASE_URL`을 비워 상대 경로를 사용하세요.
