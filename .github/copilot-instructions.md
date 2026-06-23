# GitHub Copilot Instructions - training-log

## Project Context
- Backend API powered by Azure Functions + Azure Database for PostgreSQL
  Flexible Server (serverless) with Drizzle ORM (query builder) + `pg` Pool
- Focus on iterative, feedback-driven development

## Documentation References
- docs/project-overview.md — Architecture, tech stack, and structure
- docs/testing-guidelines.md — Test patterns and standards
- docs/workflow-patterns.md — Development workflow guidance

---

## Architecture

- **Frontend:** React (functional components, hooks) hosted on Azure Static Web Apps
- **Routing:** React Router — handles all client-side navigation
- **Backend:** Azure Functions (minimized) — only for server-side operations
- **Database:** Azure Database for PostgreSQL Flexible Server (serverless)
- **DB Client:** `pg` Pool with Drizzle ORM (query builder)
- **Language:** TypeScript throughout — frontend and Azure Functions
- **Styling:** [Add your choice: Tailwind CSS / CSS Modules / Styled Components]
- **State Management:** [Add your choice: Context API / Zustand / Redux Toolkit]
- **Testing:** Jest + React Testing Library (frontend), Jest (Azure Functions)

---

## Development Principles
- Test-Driven Development: Red-Green-Refactor cycle
- Incremental Changes: Small, testable modifications
- Systematic Debugging: Use test failures as guides
- Validation Before Commit: All tests pass, no lint errors
- All schema changes must be applied via SQL migration scripts
- TypeScript strict mode enabled — no use of `any` without explicit justification

---

## Routing Strategy

### Prefer React Router Over Azure Functions
- Handle all **navigation and view logic** with React Router
- Use **dynamic segments** (e.g., `/users/:id`) in React Router before
  considering a serverless function
- Use **nested routes** for layouts and shared UI regions
- Use **loader patterns** (React Router v6.4+) for data fetching tied to routes
- Configure `staticwebapp.config.json` to redirect all routes to `index.html`
  so React Router controls navigation

### staticwebapp.config.json — Catch-All Route
```
{
  "navigationFallback": {
    "rewrite": "/index.html",
    "exclude": ["/api/*", "/assets/*"]
  }
}
```

### When to Use an Azure Function
Only create an Azure Function when the operation:
- Requires a **secret or API key** that cannot be exposed client-side
- Performs a **database read or write** via PostgreSQL
- Calls a **third-party API** that does not support CORS or requires server-side auth
- Requires **server-side validation** before persisting data
- Handles **webhooks** or background processing

### When NOT to Use an Azure Function
- **Filtering, sorting, or transforming** data already on the client
- **Navigation** or conditional rendering based on route params
- **Form validation** that does not involve secrets or database lookups
- Fetching from a **public API** that supports CORS — call it directly from React

---

## Route Classification Checklist
- [ ] Classify as React Router or Azure Function using the criteria above
- [ ] If React Router: create page component and add route to the router
- [ ] If Azure Function: create handler in `/api`, add query in `api/shared/repository.ts`
- [ ] Write tests before implementing (TDD)
- [ ] Update `staticwebapp.config.json` if new route protection rules are needed

---

## Azure PostgreSQL Flexible Server (Serverless) Best Practices

### Connection Management
- Use a **shared `pg` Pool** instantiated once per module — never create a new Pool
  per function invocation (exhausts connections on cold starts)
- Use **pgBouncer** connection pooling (available in Azure PostgreSQL Flexible Server)
  and set `pgbouncer=true` in the connection string
- Always include `?sslmode=require` in `DATABASE_URL` for Azure-hosted connections

### pg Pool Pattern (`api/shared/db.ts`)
```typescript
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
```

### Connection String Configuration
```
# .env (never commit this file)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require&pgbouncer=true"
```

### Schema and Migrations
- Schema is defined in `api/shared/schema.ts` using Drizzle table definitions
- All schema changes must be applied via SQL migration scripts in `schema.sql`
- Use `npx drizzle-kit introspect` to regenerate the Drizzle schema from the DB
- Never alter the database manually in production

### Query Best Practices (Drizzle ORM)
- Use `db.select({ ... }).from(table)` with explicit field lists — never return
  full rows containing sensitive fields to the client
- Use `.limit()` and `.offset()` for all list queries (pagination)
- Use `db.transaction(async (tx) => { ... })` for operations that must
  succeed or fail together
- Prefer Drizzle query builder over raw SQL for type safety and composability

```typescript
// Good — typed, minimal fields, paginated
const rows = await db
  .select({ id: users.id, name: users.username })
  .from(users)
  .where(eq(users.active, true))
  .orderBy(desc(users.createdAt))
  .limit(20)
  .offset(page * 20)

// Good — transaction
const result = await db.transaction(async (tx) => {
  const [order] = await tx.insert(orders).values(orderData).returning({ id: orders.id })
  await tx.update(inventory).set({ stock: sql`${inventory.stock} - 1` }).where(eq(inventory.id, itemId))
  return order
})

// Avoid — selecting full row with sensitive fields
const user = await db.select().from(users).where(eq(users.id, id)).limit(1)
return user[0]
```

### Date / Timezone Policy
- `date` columns in PostgreSQL are timezone-agnostic; Drizzle returns them as
  ISO `"YYYY-MM-DD"` strings (`{ mode: 'string' }`)
- Future `timestamp` columns **must** use `timestamptz` (stored UTC)
- On the client, always use `formatWorkoutDate(isoDate)` from `src/utils/date.ts`
  to parse dates as local calendar dates — never use `new Date(isoDateString)`
  directly (parses as UTC midnight, shows wrong day in non-UTC timezones)

### Security
- Store `DATABASE_URL` in **Azure Static Web Apps environment variables** or
  **Azure Key Vault** — never in source code or client bundle
- Always validate and sanitize inputs in the Azure Function **before** querying
- Use **row-level filtering** based on the authenticated user's identity —
  never trust client-supplied user IDs for authorization
- Restrict the PostgreSQL role used by the app to minimum required privileges

---

## Azure Functions Best Practices (Minimized)

- Place all functions under the `/api` directory as required by Azure Static Web Apps
- Keep functions **stateless** — do not rely on in-memory state between invocations
- Validate and **sanitize all inputs** at the function boundary
- Return consistent **JSON response shapes** with appropriate HTTP status codes
- Use **shared middleware wrappers** for auth and error handling to avoid duplication
- Store all secrets in **Azure Key Vault** or Static Web Apps environment variables

### Azure Function Structure
```
api/
├── users/
│   ├── index.ts              # GET /api/users, POST /api/users
│   └── function.json
├── users-detail/
│   ├── index.ts              # GET /api/users/{id}, PUT, DELETE
│   └── function.json
└── shared/
    ├── db.ts                 # Prisma singleton
    ├── auth.ts               # Shared auth middleware
    └── response.ts           # Consistent response helpers
```

---

## React Best Practices

### Component Design
- One component per file
- Name components with **PascalCase**
- Name files to match the component name (e.g., `UserProfile.tsx`)
- Co-locate related files (component, styles, tests) in the same folder

### Hooks
- Follow the **Rules of Hooks** — only call hooks at the top level
- Extract reusable logic into **custom hooks** (prefix with `use`)
- Use `useCallback` and `useMemo` only when there is a measurable performance need
- Prefer `useReducer` over `useState` for complex state logic

### Props and State
- Define **prop types** with TypeScript interfaces — no use of `any`
- Avoid **prop drilling** more than 2 levels deep — use Context or a state manager
- Keep state as **local as possible**; lift state only when necessary
- Treat state as **immutable** — never mutate state directly

### Data Fetching
- Use **React Query (TanStack Query)** or **SWR** for data fetching and caching
- All database-backed data must be fetched through **/api Azure Functions** —
  never connect to PostgreSQL from the client
- Handle **loading**, **error**, and **empty** states explicitly in every component
- Abstract all API calls into a dedicated `services/` directory

### Performance
- Use **React.lazy** and **Suspense** for code splitting on routes
- Avoid anonymous functions and object literals in JSX props when they cause
  unnecessary re-renders
- Use the **React DevTools Profiler** to identify bottlenecks before optimizing

### Folder Structure
```
src/
├── components/        # Reusable UI components
│   └── Button/
│       ├── Button.tsx
│       ├── Button.test.tsx
│       └── Button.module.css
├── pages/             # Route-level components mapped to React Router routes
├── hooks/             # Custom hooks
├── services/          # API clients for /api function calls
├── context/           # React Context providers
├── utils/             # Pure utility functions
└── types/             # Shared TypeScript types/interfaces
api/                   # Azure Functions (minimized)
├── shared/
│   ├── db.ts
│   ├── auth.ts
│   └── response.ts
└── [function-name]/
prisma/
├── schema.prisma
└── migrations/
staticwebapp.config.json
```

---

## Testing Scope

- **Frontend:** Jest + React Testing Library
- **Azure Functions:** Jest with mocked Prisma
- **UI end-to-end:** Playwright for critical user journey automation
- **Manual browser testing** for exploratory validation and visual checks
- Reason: Combine fast feedback (unit/integration) with end-to-end quality
  confidence (UI tests)

### Playwright User Journey Requirement
Every user-facing feature **must** include a Playwright user journey test. This is
non-negotiable for feature completeness. A feature is not considered done until its
user journey is covered by a Playwright test.

What counts as a user-facing feature:
- New pages or routes
- New user interactions (forms, buttons, workflows)
- Offline/sync behavior changes
- Error states that users can encounter
- New or changed data flows through the UI

Playwright test location:
- SQLite mock API tests: `tests/e2e/sqlite/` — preferred for new features (fast,
  no real DB required)
- Mobile user journey tests: `tests/e2e/mobile-*.spec.ts` — for mobile-specific flows
- Real DB tests: `tests/e2e/real-db/` — for integration tests requiring live data

### Testing Approach by Context
- Azure Function changes: Write Jest tests FIRST, then implement (RED-GREEN-REFACTOR)
- Frontend component features: Write React Testing Library tests FIRST for component
  behavior, then implement (RED-GREEN-REFACTOR). Follow with manual browser testing
  for full UI flows.
- **All new features:** Write Playwright user journey test covering the end-to-end
  flow before the feature is considered complete.
- This is true TDD: Test first, then code to pass the test

---

## Test-Driven Development (TDD)

### Core TDD Cycle
Follow the **Red → Green → Refactor** cycle:
1. **Red** — Write a failing test that describes the desired behavior
2. **Green** — Write the minimum code to make the test pass
3. **Refactor** — Clean up the code without breaking tests

### Testing Philosophy
- Write tests **before** or **alongside** implementation, not after
- Tests should describe **behavior**, not implementation details
- Prefer **integration-style tests** over shallow unit tests for React components
- A test should have a **single reason to fail**
- Avoid testing **third-party libraries** — trust them and test your usage of them

### React Component Testing (React Testing Library)
- Query elements the way a **user would find them**:
  - Prefer `getByRole`, `getByLabelText`, `getByText`
  - Avoid `getByTestId` unless no semantic alternative exists
- Test **user interactions**, not internal state or implementation
- Use `userEvent` over `fireEvent` for more realistic interaction simulation
- Wrap async interactions in `waitFor` or use `findBy` queries
- Use **MemoryRouter** from React Router when testing components that use routing

```
// Good — tests behavior and routing
test('navigates to user detail on row click', async () => {
  render(
    
      
        } />
        } />
      
    
  )
  await userEvent.click(screen.getByText('Jane Doe'))
  expect(screen.getByRole('heading', { name: /jane doe/i })).toBeInTheDocument()
})
```

### Azure Function and Database Testing
- **Mock repository functions** in unit and integration tests — never connect to a
  real database in automated tests
- Use `jest.mock('./shared/repository.js', () => ({ findAll: jest.fn(), ... }))` to
  mock the entire repository module
- Test the **function handler behavior** (status codes, response shape, error handling)
  separately from the **repository/Drizzle query logic**
- Repository functions are the seam for mocking — handlers import from `repository.ts`,
  tests mock that module

```typescript
// api/functions/workouts.test.ts
import * as repo from '../shared/repository.js'

jest.mock('../shared/repository.js')

test('returns paginated workouts', async () => {
  const mockWorkouts = [{ id: 1, name: 'Legs', date: '2024-01-03', username: 'jane' }]
  jest.mocked(repo.listWorkoutsByUsername).mockResolvedValue(mockWorkouts)
  const context = createMockContext()
  const request = createMockRequest({ method: 'GET' })
  await handler(context, request)
  expect(context.res.status).toBe(200)
  expect(context.res.body).toEqual(mockWorkouts)
})
```

### Custom Hook Testing
- Use `renderHook` from React Testing Library to test custom hooks in isolation
- Test the **public interface** of the hook (inputs, outputs, side effects)

### Test Organization
- Co-locate test files with source files using the `.test.ts(x)` suffix
- Group tests with `describe` blocks that mirror component or function names
- Use `beforeEach` for common setup; avoid shared mutable state between tests
- Name tests using the pattern: **"it [does something] when [condition]"**

### Coverage Guidelines
- Aim for **meaningful coverage**, not 100% line coverage
- Prioritize coverage of:
  - Repository function logic and data transformation (high coverage)
  - User-facing component interactions (high coverage)
  - Edge cases and error states (always test these)
  - Happy path flows (always test these)
- Do **not** chase coverage metrics at the expense of test quality

---

## Workflow Patterns
1. TDD Workflow: Write/fix tests → Run → Fail → Implement → Pass → Refactor
2. Code Quality Workflow: Run lint → Categorize issues → Fix systematically → Re-validate
3. Integration Workflow: Identify issue → Debug → Test → Fix → Verify end-to-end
4. UI Testing Workflow: Define critical journeys → Create Playwright tests → Run →
   Debug failures → Validate coverage

---

## Agent Usage
- **tdd-developer:** For implementation and unit/integration TDD cycles; do NOT
  create or run Playwright UI tests in this mode
- **code-reviewer:** For addressing lint errors and code quality improvements
- **test-engineer:** Owns all Playwright UI test authoring/execution, failure
  triage, and isolation checks

---

## Memory System
- **Persistent Memory:** This file (`.github/copilot-instructions.md`) contains
  foundational principles and workflows
- **Working Memory:** `.github/memory/` directory contains discoveries and patterns
- During active development, take notes in `.github/memory/scratch/working-notes.md`
  (not committed)
- At end of session, summarize key findings into `.github/memory/session-notes.md`
  (committed)
- Document recurring code patterns in `.github/memory/patterns-discovered.md`
  (committed)
- Reference these files when providing context-aware suggestions

---

## Workflow Utilities
GitHub CLI commands for workflow automation (available to all modes):
- List open issues: `gh issue list --state open`
- Get issue details: `gh issue view `
- Get issue with comments: `gh issue view  --comments`
- The main exercise issue will have "Exercise:" in the title
- Steps are posted as comments on the main issue
- Use these commands when `/execute-step` or `/validate-step` prompts are invoked

---

## Git Workflow
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `db:`
- Feature branches: `feature/`
- Always stage all changes before committing: `git add .`
- Push to the correct branch: `git push origin `

---

## Code Style and Conventions
- Use **ESLint** with `eslint-plugin-react`, `eslint-plugin-react-hooks`,
  and `eslint-plugin-jsx-a11y`
- Use **Prettier** for consistent formatting
- TypeScript strict mode enabled throughout — frontend and Azure Functions
- No use of `any` without a comment explaining why it cannot be avoided
- All new features must include tests before merging
- All schema changes must be applied via SQL migration scripts
- Keep Azure Functions modular — extract focused modules for connection config,
  query helpers, and validation logic

---

## Recent Learnings
- Database connectivity in containers: Do not rely on local PostgreSQL socket
  defaults in production containers. Prefer `DATABASE_URL` for runtime configuration.
- Azure PostgreSQL: Always include `?sslmode=require` in `DATABASE_URL` for
  Azure-hosted Postgres connections.
- Drizzle in serverless: Use a shared `pg.Pool` instantiated once per module and
  wrap it with `drizzle(pool, { schema })`. Never create a new Pool per invocation.
- pgBouncer: Enable pgBouncer in the Azure PostgreSQL connection string
  (`pgbouncer=true`) for serverless workloads.
- Drizzle camelCase: Drizzle infers JS property names in camelCase from the column
  name in the schema definition (e.g., `integer('num_sets')` → property `numSets`).
  Interfaces that consume Drizzle results must use camelCase keys.
- Timezone off-by-one: `new Date('YYYY-MM-DD')` parses as UTC midnight. Always use
  `new Date(year, month-1, day)` for local-time date display on the client.
- ESM extensions: `api/` uses NodeNext module resolution — all relative imports
  must include the `.js` extension even for `.ts` source files.
- Maintainability and linting: Keep Azure Functions modular. Extracting focused
  modules (connection config, query helpers, validation logic) helps satisfy
  class-length lint rules without changing behavior.