# Training Log

Training Log is now a TypeScript application with a React frontend and an Azure Functions API backed by PostgreSQL.

## Stack

- Frontend: React + TypeScript + React Router + Vite
- API: Azure Functions (Node/TypeScript)
- Database: PostgreSQL
- Tests: Jest for API logic, Vitest + React Testing Library for frontend UI

## Features

- Signup, login, logout, and delete-account flows
- Paginated workout list
- Workout detail page with owner-only workout edit/delete controls
- Owner-only exercise create, edit, and delete controls
- Cookie-based session auth between frontend and Azure Functions API

## Local Development

1. Install dependencies with `npm install`.
2. Copy [api/local.settings.json.example](/Users/iancornett/src/ae-bootcamp-demo/training-log/api/local.settings.json.example) to `api/local.settings.json`.
3. Set `DATABASE_URL` and `SESSION_SECRET` in that local settings file.
4. Install Azure Functions Core Tools if you want to run the API locally.

Useful commands:

- Frontend only: `npm run dev:web`
- API TypeScript watch: `npm run dev:api:build`
- API host only: `npm run dev:api:start`
- Full local stack: `npm run dev:full`
- Frontend + API typecheck: `npm run typecheck`
- API tests: `npm run test:api`
- Frontend tests: `npm run test:web`
- Production build: `npm run build`

## Database Setup

The PostgreSQL schema and seed data are still defined in [schema.sql](/Users/iancornett/src/ae-bootcamp-demo/training-log/schema.sql). Load that schema into your local or Azure PostgreSQL instance before starting the API.

## Git Hooks

Git hooks are installed with `simple-git-hooks`. Run [bin/setup-hooks](/Users/iancornett/src/ae-bootcamp-demo/training-log/bin/setup-hooks) once after cloning, or run `npm run prepare` directly.

The pre-commit hook runs:

- `npm run typecheck`
- `npm run test:api`
- `npm run test:web`
