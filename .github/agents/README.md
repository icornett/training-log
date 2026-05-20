# Agent Modes

Use this directory to choose the right Test-Driven Development agent mode for the task.

## Available Agents

### tdd-developer
File: [tdd-developer.agent.md](tdd-developer.agent.md)

Use when:
- The task spans backend and frontend.
- You want one general TDD mode.
- You need strict Red-Green-Refactor guidance regardless of layer.

Focus:
- Full TDD workflow for new features and failing tests.
- Enforces test-first behavior.
- Keeps fixes minimal and scoped to test outcomes.

### tdd-backend
File: [tdd-backend.agent.md](tdd-backend.agent.md)

Use when:
- Work is backend/API/service logic only.
- You need Jest + Supertest-first execution.
- You want backend-oriented failure analysis and minimal green-phase changes.

Focus:
- Backend-first Red-Green-Refactor cycle.
- API behavior, status codes, payloads, and error-path verification.
- Avoids unrelated lint cleanup unless it blocks tests.

### tdd-frontend
File: [tdd-frontend.agent.md](tdd-frontend.agent.md)

Use when:
- Work is frontend component or UI flow focused.
- You need React Testing Library-first execution.
- You are covering critical user journeys with Playwright.

Focus:
- Frontend-first Red-Green-Refactor cycle.
- Accessibility-first selectors (`getByRole`, `getByLabelText`), then `data-testid`.
- Playwright Page Object Model patterns and state-based waits.
- Avoids unrelated lint cleanup unless it blocks tests.

## Quick Selection Guide
- Pick `tdd-developer` for mixed or unclear scope.
- Pick `tdd-backend` for API/business logic tasks.
- Pick `tdd-frontend` for component and UI behavior tasks.

## Core Rule Across All Modes
- For new features: write tests first (RED), implement minimal code to pass (GREEN), then refactor (REFACTOR).
