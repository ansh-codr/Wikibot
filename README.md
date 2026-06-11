# Archify (WikiBot)

Archify saves important Slack threads to Notion automatically — one emoji, zero effort.

## How it works

1. **One emoji trigger**: React with 🧠 (or your configured emoji) on any Slack thread.
2. **AI-powered summaries**: The app intercepts the reaction, fetches the entire thread, and uses Groq (Llama 3) to extract decisions, action items, and context automatically.
3. **Searchable forever**: Every saved thread becomes a clean, tagged Notion page, and a confirmation link is posted back into the Slack thread.

## Tech Stack

- **Framework**: Vercel Serverless Functions (`@vercel/node`)
- **Language**: TypeScript
- **AI/LLM**: Groq API (`llama-3.3-70b-versatile`)
- **Database**: PostgreSQL (for idempotency)
- **Integrations**: Slack Web API, Notion API

## Setup Guide

### 1. Slack App Creation
1. Create a new app at [api.slack.com](https://api.slack.com/apps).
2. Go to **OAuth & Permissions** and add the following Bot Token Scopes:
   - `channels:history`
   - `chat:write`
   - `groups:history`
   - `reactions:read`
   - `users:read`
3. Install the app to your workspace to get the **Bot User OAuth Token** (`SLACK_BOT_TOKEN_`).
4. Go to **Basic Information** to get your **Signing Secret** (`SLACK_SIGNING_SECRET`).
5. Under **Event Subscriptions**, enable events and input your Vercel deployment URL (e.g., `https://your-app.vercel.app/api/slack`).
6. Subscribe to the `reaction_added` bot event.

### 2. Notion Setup
1. Create a Notion integration at [Notion Developers](https://www.notion.so/my-integrations).
2. Copy the **Internal Integration Secret** (`NOTION_API_KEY_`).
3. Create a Notion Database with the following properties (case-sensitive):
   - `Title` (Title)
   - `Status` (Select: "Action Required", "Resolved", "Informational")
   - `Participants` (Multi-select)
   - `Thread Link` (URL)
4. Click the `...` menu on your database page and **Add Connections** to invite your new integration.
5. Extract the **Database ID** from the URL (`NOTION_DATABASE_ID_`).

### 3. Database (PostgreSQL)
1. Create a free PostgreSQL database (e.g., Supabase or Neon).
2. Get the connection string (`DATABASE_URL`).
3. Run the migrations to create the idempotency table:
   ```bash
   npm run migrate
   ```

### 4. Environment Variables
Copy `.env.example` to `.env` and fill in the values. See `.env.example` for detailed instructions on each variable.

### 5. Vercel Deployment
1. Push your repository to GitHub.
2. Import the project into Vercel.
3. Ensure the Build Command is `npm run build` (or `echo ok`).
4. Add all environment variables in the Vercel dashboard.
5. Deploy!
