# WikiBot Implementation Plan

## Goal
Build the Slack-to-Notion wiki bot described in the blueprint, but with the minimum architectural changes needed to make the MVP reliable in production from day one.

## Required Architecture Fixes Before Coding

1. Slack must acknowledge the event immediately and hand off processing asynchronously.
2. Idempotency must be persistent, and workspace config must support multiple Slack workspaces.
3. Slack user profile resolution must be batched or cached to avoid N+1 lookups.
4. Claude output must be validated against a schema, retried on recoverable failures, and fail cleanly when the response is unusable.
5. Notion writes must detect renamed properties and revoked permissions explicitly, with actionable error states.

## Implementation Approach

### 1) Event Intake and Async Processing
- Accept `reaction_added` events and return a 2xx response immediately after validating the request signature and basic trigger conditions.
- Move all expensive work into an async execution path, using either Vercel background functions or a queue-backed worker.
- Keep the Slack-facing handler thin: authenticate, dedupe lightly, enqueue or dispatch work, and exit.
- Emit a clear internal job record so processing can be retried or observed later.

### 2) Persistent Idempotency and Multi-Workspace Configuration
- Replace the in-memory processed-thread Set with durable storage keyed by workspace ID + channel ID + thread timestamp + trigger event ID.
- Model workspace installation state explicitly so each Slack workspace can store its own bot token, trigger emoji, allowed users, Notion database ID, and integration state.
- Treat configuration as tenant-scoped data, not environment-only data, so the same codebase can serve multiple workspaces safely.
- Add idempotency checks before any external API calls and record terminal job status after completion.

### 3) Slack Thread Capture and User Resolution
- Fetch the thread replies once, then resolve all distinct Slack user IDs in the thread using a batched or cached profile lookup strategy.
- Cache user profiles for the duration of the job so multiple messages from the same author do not trigger repeated API requests.
- Preserve ordering, timestamps, and author attribution while avoiding per-message network calls.
- Keep the transcript format deterministic so downstream summarization and Notion rendering remain stable.

### 4) Claude Summarization Hardening
- Require Claude to emit a strict JSON schema for title, summary, decisions, action items, and tags.
- Validate the model output before proceeding; reject or repair only well-defined failure modes.
- Add retry logic for transient failures and malformed output, with a small bounded retry count.
- If the response still cannot be validated, stop the pipeline cleanly and post a clear Slack failure message.
- Do not rely on regex-only extraction as the primary parsing strategy.

### 5) Notion Integration Resilience
- Resolve the target database schema at startup or during onboarding and verify that required properties exist.
- If a property has been renamed or removed, surface a specific configuration error that identifies the missing mapping.
- Detect revoked Notion permissions distinctly from schema mismatches and return a clear operational status.
- Keep the Notion write path idempotent so retries do not create duplicate pages.
- Store enough context with each job to explain exactly why a Notion write failed.

## Work Phases

### Phase 0: Project Setup
- Initialize the Node.js project structure.
- Install Slack, Claude, Notion, and validation dependencies.
- Add environment and tenant configuration shape.

### Phase 1: Slack Event Handler
- Implement the Slack receiver with immediate acknowledgement.
- Add signature validation, trigger filtering, and enqueue/dispatch logic.
- Confirm the handler does not perform thread summarization inline.

### Phase 2: Persistence Layer
- Add storage for installations, workspace config, idempotency keys, and job state.
- Implement safe reads/writes for multi-workspace operation.

### Phase 3: Thread Capture Pipeline
- Fetch thread messages.
- Batch or cache user profile lookups.
- Build a clean transcript object for summarization.

### Phase 4: Claude Summarization
- Define the response schema.
- Implement validation and retry behavior.
- Add controlled failure handling and Slack error reporting.

### Phase 5: Notion Write Path
- Verify database schema and permissions.
- Create the page using validated output.
- Return precise error states for permission and property issues.

### Phase 6: End-to-End Hardening
- Add logging, observability, and retry-safe behavior.
- Test duplicate delivery, cold starts, malformed AI output, and Notion access failures.
- Verify the full pipeline across at least one workspace and one simulated multi-workspace configuration.

## Acceptance Criteria
- Slack events are acknowledged immediately and do not time out while processing.
- Duplicate Slack deliveries do not produce duplicate Notion pages.
- The same codebase can support more than one Slack workspace without config collisions.
- Thread processing does not perform per-message user lookups.
- Invalid Claude output does not reach Notion and results in a controlled failure.
- Notion property changes and revoked permissions produce explicit, actionable errors.

## Requirement Traceability
- Fix 1 maps to: async event intake and worker/queue execution.
- Fix 2 maps to: persistent idempotency and tenant-scoped configuration.
- Fix 3 maps to: batched/cached Slack profile resolution.
- Fix 4 maps to: schema validation, retries, and controlled AI failure handling.
- Fix 5 maps to: Notion schema verification and permission/error classification.

## Open Implementation Choice
- Decision: use a queue-backed worker instead of Vercel background functions.
- Rationale: the bot needs durable retries, persistent idempotency, and clear job state across cold starts and duplicate deliveries. A queue gives us a stable handoff boundary and keeps the Slack handler fast, while background functions would still leave us tied to ephemeral execution state.

## First Concrete Task Breakdown

### Task 1: Scaffold the runtime boundary
- Create the Node.js project structure.
- Add the Slack ingress handler as a thin HTTP entry point.
- Add a queue producer and a worker consumer as separate modules.
- Define the job payload shape for thread processing.

### Task 2: Add persistence primitives
- Create storage models for workspace installation data, idempotency keys, and job status.
- Wire the queue worker to read and write those records.
- Make all config tenant-scoped instead of process-scoped.

### Task 3: Implement safe Slack intake
- Validate the Slack signature and acknowledge immediately.
- Filter trigger emoji and authorized users before enqueueing.
- Enqueue only the minimum payload needed for downstream processing.

### Task 4: Implement thread capture and summarization
- Fetch Slack thread replies.
- Resolve user profiles with batching or caching.
- Validate Claude output against a schema and retry recoverable failures.

### Task 5: Implement Notion write and failure handling
- Verify the Notion database schema before writing.
- Create the page with validated content.
- Surface explicit errors for renamed properties and revoked permissions.
