# Patterns Discovered

Use this file to record recurring implementation and debugging patterns discovered over time.

## Pattern Template

### Pattern Name
- Context: <where this pattern appears>
- Problem: <what keeps failing or causing friction>
- Solution: <repeatable fix>
- Example: <short code or behavior example>
- Related Files: <file paths>

---

## Example Pattern

### Service Initialization: Empty Array vs Null
- Context: Service or view-model initialization where collections are rendered or iterated.
- Problem: Initializing lists as null causes conditional clutter and runtime errors when code assumes enumerable behavior.
- Solution: Initialize collection properties as empty arrays by default; treat null as exceptional only.
- Example: Use `items = []` instead of `null` so downstream render logic can iterate safely.
- Related Files: WorkoutsPage.tsx, api/functions/workouts.ts

---

Add new patterns below this line as they are discovered.

### Offline-First Sync Rollout Checklist
- Context: Mobile/PWA usage in low-connectivity areas with deferred sync to PostgreSQL.
- Problem: Network-only write paths fail offline, and reconnect retries can create duplicate records without idempotency.
- Solution: Implement local-first persistence plus operation-log replay with globally unique client IDs and server idempotency.
- Example: Create workout offline with `workoutId=uuidv7`, enqueue `operationId=uuid`, replay on reconnect, and dedupe by `(user_id, operation_id)`.
- Related Files: src/services/api.ts, src/context/AuthContext.tsx, src/types/domain.ts, api/functions/workouts.ts, api/functions/workoutById.ts, api/shared/repository.ts, api/shared/schema.ts

#### Implementation Checklist (Per File)
1. src/types/domain.ts
- Add sync metadata types: `SyncState`, `PendingOperation`, `ConflictPayload`.
- Add client identity fields for local records: `clientId`, `lastSyncedAt`, `pendingState`.

1. src/services/api.ts
- Add offline-aware mutation wrapper that writes to local queue when disconnected.
- Add idempotency headers/body fields (`operationId`, `deviceId`) for all write operations.
- Keep read operations resilient: local-first fallback when network calls fail.

1. src/context/AuthContext.tsx
- Gate offline writes to previously authenticated sessions on-device.
- Expose sync status to UI (`isOffline`, `pendingCount`, `lastSyncError`).

1. src/services/localStore.ts (new)
- Implement IndexedDB-backed local entity store for workouts and exercises.
- Store pending operation log durably across reloads.

1. src/services/syncEngine.ts (new)
- Replay queued operations in deterministic order with exponential backoff.
- Mark operations complete only after server acknowledgment.
- Trigger conflict resolution path for server conflict responses.

1. api/shared/schema.ts
- Add idempotency tracking table with unique `(user_id, operation_id)`.
- If numeric PKs stay, add unique `client_workout_id` and `client_exercise_id` mapping columns.

1. api/shared/repository.ts
- Add helpers: `isOperationProcessed`, `recordProcessedOperation`, and client-ID mapping lookups.
- Ensure create/update/delete paths are replay-safe and authorization-scoped.

1. api/functions/workouts.ts and api/functions/workoutById.ts
- Accept and validate `operationId`, `deviceId`, and client-generated IDs.
- Return conflict payload with enough metadata for field-level merge.

1. api/functions/workoutExercises.ts and api/functions/workoutExerciseById.ts
- Mirror workout replay/idempotency behavior for exercise create/update/delete.

1. src/services/api.test.ts
- Add tests for offline queueing, reconnect replay, and duplicate replay suppression.

1. tests/e2e/helpers/sqliteMockApi.ts
- Extend mock handlers to emulate reconnect behavior and conflict responses.

1. tests/e2e/mobile-user-workflows.spec.ts
- Add scenario: offline create/edit/delete, app reload while offline, reconnect, then verify server parity.

#### Acceptance Criteria
1. Two users creating workouts offline never collide on IDs.
1. Reconnect retries do not create duplicate rows.
1. Offline changes survive browser refresh/restart.
1. Field-level merge behavior is deterministic and test-covered.
