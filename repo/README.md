# RoadSafe Inspection Operations Platform

Full-stack offline-first vehicle inspection platform built with Vue.js, Koa, and MySQL.

##  Quick Start

### Prerequisites
- Docker & Docker Compose
- Git

### One-Click Startup

```bash
cd repo
docker compose up 
```

**Services:**
- Backend API: https://localhost:4000
- Frontend UI: http://localhost:5173

**Default Admin Credentials:**
- Username: `admin`
- Password: `Admin@123456`

## 📁 Project Structure

```
task4/
├── metadata.json           # Project metadata (TASK-15 standard)
├── docs/                   # Documentation
│   ├── README.md          # Original prompt
│   ├── api-spec.md        # REST API documentation
│   └── questions.md       # Business logic clarifications
├── repo/                   # Source code
│   ├── backend/           # Koa.js API server
│   ├── frontend/          # Vue 3 + Tailwind UI
│   ├── unit_tests/        # Unit tests
│   ├── API_tests/         # API integration tests
│   └── docker-compose.yml # Container orchestration
└── sessions/              # Development session logs
```

