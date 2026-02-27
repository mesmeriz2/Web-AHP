# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AHP Service — a decision intelligence platform for running Analytic Hierarchy Process (AHP) pairwise comparison surveys. Admins design a Goal → Criteria → Alternatives hierarchy, participants complete comparison matrices, and the system computes weighted priorities and consistency ratios.

## Commands

### Docker (recommended full-stack)
```bash
docker-compose up --build   # Build and start all services
docker-compose up           # Start without rebuilding
docker-compose down         # Stop all services
```

Services: Frontend → `localhost:5175`, Backend API → `localhost:8006`, PostgreSQL → `localhost:5434`

### Frontend (from `frontend/`)
```bash
npm run dev       # Dev server on http://localhost:5173
npm run build     # Production build to dist/
npm run preview   # Serve dist/ for testing
```

### Backend (from `backend/`)
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000   # Run dev server
pytest                                              # Run all tests
pytest tests/test_ahp_consistency.py               # Run a single test file
```

### Admin utility
```bash
python scripts/generate_password_hash.py   # Generate ADMIN_PASSWORD_HASH for .env
```

## Architecture

### Three-layer stack
- **Frontend**: React 18 + TypeScript + Vite + MUI → `frontend/src/`
- **Backend**: FastAPI + SQLAlchemy (async) + NumPy → `backend/app/`
- **Database**: PostgreSQL 16

### Backend structure (`backend/app/`)
| Directory | Purpose |
|-----------|---------|
| `api/` | FastAPI route handlers (`admin.py`, `participant.py`, `health.py`) |
| `models/` | SQLAlchemy ORM models |
| `schemas/` | Pydantic request/response DTOs |
| `services/` | Business logic — the most important layer |
| `core/` | Settings loaded from `.env` via pydantic-settings |
| `db/` | Database session factory and `Base` |

Key services:
- `services/ahp.py` — `compute_priority_vector()` (power method), `compute_consistency()` (CI/CR), `aggregate_matrices()` (geometric mean across participants)
- `services/hierarchy.py` — builds nested tree from flat `HierarchyNode` rows
- `services/results.py` — computes global weights by traversing hierarchy levels
- `services/auth.py` — SHA-256 password check + JWT creation/validation

### Frontend structure (`frontend/src/`)
| Directory | Purpose |
|-----------|---------|
| `api/` | Axios/fetch functions grouped by domain |
| `pages/` | Admin pages (login, project CRUD, results) and Participant survey page |
| `components/admin/` | Admin-specific UI components |
| `components/common/` | Shared UI primitives |
| `types/` | TypeScript interfaces mirroring backend schemas |

### Data model (key relationships)
```
Project
  └── HierarchyNode (goal → criteria → alternative, self-referential parent_id)
  └── Participant (unique code per participant)
       └── PairwiseResponse (one per HierarchyNode that has children)
SurveyTemplate (stores reusable hierarchy JSON)
```

### AHP workflow
1. Admin creates Project + HierarchyNode tree, generates participant codes
2. Participant enters code → receives list of comparison tasks (one per non-leaf node)
3. Participant submits N×N matrices; backend immediately validates and stores CI/CR
4. Admin fetches `/results` → backend aggregates via geometric mean, runs power method, returns global priority vectors

## Environment Configuration

Copy `env.example` to `.env`. Critical variables:

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | Full SQLAlchemy URL |
| `ADMIN_PASSWORD_HASH` | SHA-256 of `ADMIN_PASSWORD_SALT + password` |
| `ADMIN_JWT_SECRET` | JWT signing key |
| `VITE_API_BASE_URL` | Empty string = relative paths (same origin); set to `http://localhost:8006` for local dev outside Docker |
| `CR_THRESHOLD` | Backend consistency threshold (default `0.2`) |
| `VITE_CR_THRESHOLD` | Frontend display threshold (default `0.1`) |

## API Routes Summary

All routes are under `/api`.

- `POST /admin/login` — returns JWT
- `GET/POST /admin/projects` — list / create projects
- `GET/PATCH/DELETE /admin/projects/{id}` — project CRUD
- `GET/POST /admin/projects/{id}/hierarchy` — read / add nodes
- `PATCH/DELETE /admin/projects/{id}/hierarchy/{node_id}` — update / delete node
- `POST /admin/projects/{id}/archive` and `/restore`
- `GET /admin/projects/{id}/participants` / `POST` — manage participants
- `GET /admin/projects/{id}/results` — aggregated AHP results
- `GET /admin/templates` / `POST` — survey templates
- `GET /participant/{code}/tasks` — survey task list for a participant
- `POST /participant/submit` — submit a pairwise response matrix
- `GET /health` — service health check
