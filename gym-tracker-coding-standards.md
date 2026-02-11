# Gym Tracker - Coding Standards

## Python (Backend - FastAPI)

### Formatting & Linting
- **Formatter**: Black (line length 88)
- **Linter**: Ruff
- Run both before every commit

### Code Style
- **Type hints**: Required on all function signatures and return types
- **Naming**: `snake_case` for functions/variables, `PascalCase` for classes
- **Imports**: Group by stdlib -> third-party -> local, separated by blank lines
- **Docstrings**: Required for public API route functions (one-liner is fine)

### FastAPI Patterns
- **API responses**: Always use Pydantic schemas for request/response, never return raw dicts
- **Error handling**: Use `HTTPException` with proper status codes (400, 401, 403, 404, 422, 500)
- **Dependencies**: Use FastAPI's `Depends()` for DB sessions and auth (`get_current_user`, `get_db`)
- **Route organization**: One router per resource in `routes/` directory
- **Validation**: Pydantic handles input validation; add custom validators for business rules

### Database
- **ORM**: SQLAlchemy ORM for all queries; avoid raw SQL unless needed for performance
- **Migrations**: Every schema change goes through Alembic; never modify the DB directly
- **UUIDs**: Use UUID primary keys for all tables (enables offline ID generation)
- **Transactions**: Use `db.commit()` explicitly; rollback on error

### Security
- **Secrets**: Never hardcode; use `.env` + `pydantic-settings` for configuration
- **Passwords**: Hash with bcrypt via `passlib`; never store plaintext
- **JWT**: Short-lived access tokens (15min), long-lived refresh tokens (7 days)
- **CORS**: Explicitly whitelist allowed origins; never use `allow_origins=["*"]` in production

---

## TypeScript (Frontend - React + Vite)

### Formatting & Linting
- **Formatter**: Prettier (default config)
- **Linter**: ESLint with `recommended` + `react-hooks` rules
- **Strict mode**: TypeScript `strict: true` in `tsconfig.json`

### Code Style
- **Naming**: `camelCase` for functions/variables, `PascalCase` for components/types/interfaces
- **File naming**: `PascalCase.tsx` for components, `camelCase.ts` for utilities/hooks
- **No `any` type**: Always define proper types; use `unknown` if truly unknown
- **Enums**: Prefer `as const` objects over TypeScript enums

### React Patterns
- **Components**: Functional components only, with explicit prop types via interfaces
- **State**: `useState` for local state; React Context + `useReducer` for global state
- **Custom hooks**: Extract reusable logic into `hooks/` (e.g., `useAuth`, `useWorkout`, `useSync`)
- **Effects**: Minimize `useEffect`; prefer event handlers and derived state
- **Memoization**: Use `useMemo`/`useCallback` only when there's a measurable performance need

### Data & API
- **API calls**: Centralized in `api/` directory; components never call `fetch` directly
- **Offline-first**: All data writes go through Dexie.js (IndexedDB); never write directly to API
- **Error handling**: API client should handle auth errors (401 -> refresh token) globally
- **Loading states**: Show skeleton/spinner for async operations; never leave blank screens

### Styling
- **Tailwind CSS**: Utility classes only; no custom CSS files unless absolutely necessary
- **shadcn/ui**: Use for base components (buttons, inputs, modals, etc.)
- **Mobile-first**: Design for phone screens first; responsive breakpoints for larger screens
- **Spacing**: Use Tailwind's spacing scale consistently (p-2, p-4, etc.)

---

## General Standards

### Git
- **Commits**: Conventional commits format
  - `feat:` new feature
  - `fix:` bug fix
  - `refactor:` code restructuring (no behavior change)
  - `docs:` documentation
  - `chore:` build/tooling changes
  - `test:` adding or updating tests
- **Branch naming**: `feature/`, `fix/`, `chore/` prefixes (e.g., `feature/workout-logging`)
- **PRs**: Descriptive title, bullet-point summary of changes

### Testing
- **Backend**: `pytest` + `httpx` for API testing
- **Frontend**: `Vitest` + `React Testing Library`
- **Coverage**: Focus on business logic and API endpoints; don't test framework behavior

### Logging & Debugging
- **Python**: Use the `logging` module; never `print()` in production code
- **JavaScript**: Remove or guard `console.log`; no console statements in committed code
- **Errors**: Log errors with context (user ID, request details) for debugging

### File Organization
- **One concern per file**: Don't mix API calls, UI, and business logic in the same file
- **Index files**: Use `index.ts` for clean re-exports from directories
- **Constants**: Centralize magic numbers and strings in a constants file

### Environment & Secrets
- `.env` is always in `.gitignore`
- Use `.env.example` with placeholder values for documentation
- Required env vars: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`
