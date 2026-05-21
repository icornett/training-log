# GitHub Copilot Instructions - training-log

## Project Context
- Full-stack training-log application migrating from Ruby/Sinatra backend to
  React frontend hosted on Azure Static Web Apps
- Backend API replaced by Azure Functions + Azure Database for PostgreSQL
  Flexible Server (serverless) with Prisma ORM
- Focus on iterative, feedback-driven development
- Current phase: Sinatra-to-serverless migration with React frontend build-out

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
- **ORM:** Prisma
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
- All schema changes must include a Prisma migration
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

## Sinatra to React / Azure Functions Migration Map

Use this map when converting existing Sinatra routes. Classify each route as
**React Router** (client-side only) or **Azure Function** (requires server-side
execution) before writing any new code.

```
# Sinatra route       → React Router equivalent
get '/'               → } />
get '/users'          → } />
get '/users/:id'      → } />
get '/about'          → } />

# Sinatra route       → Azure Function + PostgreSQL
post '/users'         → /api/users (POST) → Prisma create
put '/users/:id'      → /api/users/:id (PUT) → Prisma update
delete '/users/:id'   → /api/users/:id (DELETE) → Prisma delete
get '/users'          → /api/users (GET) → Prisma findMany (if auth required)
get '/reports/export' → /api/reports/export (requires secret or raw SQL)
```

### Migration Checklist per Route
- [ ] Classify as React Router or Azure Function using the criteria above
- [ ] If React Router: create page component and add route to the router
- [ ] If Azure Function: create handler in `/api`, add Prisma query in `shared/db.ts`
- [ ] Write tests before implementing (TDD)
- [ ] Update `staticwebapp.config.json` if new route protection rules are needed
- [ ] Verify no Sinatra business logic has been lost — check helpers and before-filters

---

## Azure PostgreSQL Flexible Server (Serverless) Best Practices

### Connection Management
- **Never instantiate Prisma Client directly in a function handler** — cold starts
  and concurrent invocations will exhaust the PostgreSQL connection pool
- Use a **singleton Prisma Client** shared across function invocations within the
  same instance
- Set `connection_limit` in the Prisma datasource URL to a low value (e.g., `1` or `2`)
- Use **pgBouncer** connection pooling (available in Azure PostgreSQL Flexible Server)
  and set `pgbouncer=true` in the connection string
- Always include `?sslmode=require` in `DATABASE_URL` for Azure-hosted connections

### Prisma Client Singleton Pattern
```
// api/shared/db.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Connection String Configuration
```
# .env (never commit this file)
DATABASE_URL="postgresql://user:password@host:5432/dbname?sslmode=require&connection_limit=2&pgbouncer=true"
```

### Schema and Migrations
- Define all database schema in `prisma/schema.prisma`
- Use **Prisma Migrate** for all schema changes — never alter the database manually
- Run migrations as part of the **CI/CD pipeline**, not at function startup
- Use **descriptive migration names** (e.g., `add_user_preferences_table`)
- Always commit the `prisma/migrations` directory to source control
- Use `prisma db pull` to introspect the existing PostgreSQL schema when migrating
  from the Sinatra app, then clean up the generated schema

### Query Best Practices
- Always use **typed Prisma queries** — avoid raw SQL unless necessary
- Use `select` to return **only the fields needed** — never return full records
  containing sensitive fields to the client
- Use **pagination** (`take` and `skip` or cursor-based) for all list queries
- Use Prisma **transactions** for operations that must succeed or fail together
- Use raw SQL with `prisma.$queryRaw` only for complex queries Prisma cannot express,
  and always use **tagged template literals** to prevent SQL injection

```
// Good — typed, minimal fields, paginated
const users = await prisma.user.findMany({
  select: { id: true, name: true, email: true },
  where: { active: true },
  orderBy: { createdAt: 'desc' },
  take: 20,
  skip: page * 20,
})

// Good — transaction
const result = await prisma.$transaction([
  prisma.order.create({ data: orderData }),
  prisma.inventory.update({
    where: { id: itemId },
    data: { stock: { decrement: 1 } },
  }),
])

// Avoid — returning full record with sensitive fields
const user = await prisma.user.findUnique({ where: { id } })
return user
```

### Security
- Store `DATABASE_URL` in **Azure Static Web Apps environment variables** or
  **Azure Key Vault** — never in source code or client bundle
- Always validate and sanitize inputs in the Azure Function **before** passing
  them to Prisma
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

### Testing Approach by Context
- Azure Function changes: Write Jest tests FIRST, then implement (RED-GREEN-REFACTOR)
- Frontend component features: Write React Testing Library tests FIRST for component
  behavior, then implement (RED-GREEN-REFACTOR). Follow with manual browser testing
  for full UI flows.
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
- **Always mock Prisma** in unit and integration tests — never connect to a real
  database in automated tests
- Use `jest.mock` or a Prisma mock library such as `prisma-mock` or `jest-mock-extended`
- Test the **function handler behavior** (status codes, response shape, error handling)
  separately from the **Prisma query logic**
- Use a dedicated **test database** with Prisma Migrate for end-to-end tests only,
  and reset it between test runs with `prisma migrate reset`

```
// api/users/index.test.ts
import { prisma } from '../shared/db'

jest.mock('../shared/db', () => ({
  prisma: {
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}))

test('returns paginated users', async () => {
  const mockUsers = [{ id: '1', name: 'Jane Doe', email: 'jane@example.com' }]
  ;(prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers)
  const context = createMockContext()
  const request = createMockRequest({ method: 'GET', query: { page: '0' } })
  await handler(context, request)
  expect(context.res.status).toBe(200)
  expect(context.res.body).toEqual(mockUsers)
})

test('returns 404 when user is not found', async () => {
  ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)
  const context = createMockContext()
  const request = createMockRequest({ method: 'GET', params: { id: '999' } })
  await handler(context, request)
  expect(context.res.status).toBe(404)
  expect(context.res.body).toEqual({ error: 'User not found' })
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
  - Prisma query logic and data transformation (high coverage)
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
- All schema changes must include a Prisma migration
- Keep Azure Functions modular — extract focused modules for connection config,
  query helpers, and validation logic

---

## Recent Learnings
- Database connectivity in containers: Do not rely on local PostgreSQL socket
  defaults in production containers. Prefer `DATABASE_URL` for runtime configuration.
- Azure PostgreSQL: Always include `?sslmode=require` in `DATABASE_URL` for
  Azure-hosted Postgres connections.
- Prisma in serverless: Use the singleton pattern for Prisma Client to avoid
  exhausting the PostgreSQL connection pool across Azure Function invocations.
- pgBouncer: Enable pgBouncer in the Azure PostgreSQL connection string
  (`pgbouncer=true`) and set `connection_limit` to 1 or 2 for serverless workloads.
- Maintainability and linting: Keep Azure Functions modular. Extracting focused
  modules (connection config, query helpers, validation logic) helps satisfy
  class-length lint rules without changing behavior.