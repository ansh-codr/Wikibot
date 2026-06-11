# Contributing to Archify (WikiBot)

Welcome! This guide explains the project structure and how to run it locally.

## Project Structure

- `/api` - Vercel Serverless Functions. The entry point is `api/slack.ts`, which receives webhook events.
- `/lib` - Core business logic:
  - `claude.ts` - LLM interaction via Groq SDK.
  - `config.ts` - Environment variable parsing.
  - `db.ts` & `idempotency.ts` - PostgreSQL connection and deduplication logic.
  - `notion.ts` - Notion API integration.
  - `process-thread.ts` - The main pipeline orchestrator (Slack -> AI -> Notion -> Slack).
  - `slack-webhook.ts` - Webhook verification and event parsing.
- `/public` - Static landing page files.
- `/scripts` - Utility scripts (e.g., database migration).
- `/sql` - SQL migration files.

## Running Locally

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup environment:**
   Copy `.env.example` to `.env` and fill in the credentials.

3. **Run database migrations:**
   ```bash
   npm run migrate
   ```

4. **Start the local dev server:**
   ```bash
   npm run dev
   ```
   *Note: This uses `vercel dev` to simulate the serverless environment locally.*

5. **Type Checking:**
   To run TypeScript checks without building:
   ```bash
   npm run check
   ```
