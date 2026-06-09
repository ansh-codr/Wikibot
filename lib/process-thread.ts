import { WebClient } from '@slack/web-api';

import type { JobResult, SlackThreadMessage, ThreadJob } from './types.js';
import { summarizeThread } from './claude.js';
import { loadWorkspaceConfig } from './config.js';
import {
  ClaudeParseError,
  ClaudeValidationError,
  NotionPermissionError,
  NotionSchemaError,
  NotionWriteError
} from './errors.js';
import { markJobCompleted, markJobFailed, tryStartIdempotentJob } from './idempotency.js';
import { createNotionPage } from './notion.js';

export async function processThreadJob(job: ThreadJob): Promise<JobResult> {
  const idempotencyKey = `${job.workspaceId}:${job.channelId}:${job.threadTs}:${job.eventId}`;
  const gate = await tryStartIdempotentJob(idempotencyKey);

  if (!gate.allowed) {
    return {
      ok: false,
      code: 'DUPLICATE',
      message: `Duplicate job ignored with status ${gate.status}`
    };
  }

  let slack: WebClient | null = null;

  try {
    const config = loadWorkspaceConfig(process.env, job.workspaceId);
    slack = new WebClient(config.botToken);

    const messages = await fetchThreadMessages(slack, job.channelId, job.threadTs);
    const userMap = await fetchAllUsers(slack);
    const transcript = formatTranscript(messages, userMap);
    const summary = await summarizeThread({
      apiKey: config.groqApiKey,
      transcript
    });

    const notionUrl = await createNotionPage({
      apiKey: config.notionApiKey,
      databaseId: config.notionDatabaseId,
      summary: summary.output,
      sourceThreadUrl: buildSlackThreadUrl(job.channelId, job.threadTs)
    });

    await safePostSlackThreadReply(slack, job.channelId, job.threadTs, `Notion page: ${notionUrl}`);

    await markJobCompleted(idempotencyKey);
    return {
      ok: true,
      notionPageUrl: notionUrl
    };
  } catch (error) {
    await markJobFailed(idempotencyKey);

    const typedMessage = formatTypedErrorMessage(error);
    if (typedMessage && slack) {
      await safePostSlackThreadReply(slack, job.channelId, job.threadTs, typedMessage);
    } else if (typedMessage) {
      console.error('Slack client unavailable for error reply:', typedMessage);
    }

    return {
      ok: false,
      code: error instanceof Error ? error.name : 'UNHANDLED_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

type SlackMessage = {
  user?: string;
  bot_id?: string;
  text?: string;
  ts?: string;
};

type SlackUser = {
  id: string;
  profile?: {
    display_name?: string;
    real_name?: string;
  };
};

async function fetchThreadMessages(
  slack: WebClient,
  channelId: string,
  threadTs: string
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor: string | undefined;

  do {
    const response = await slack.conversations.replies({
      channel: channelId,
      ts: threadTs,
      cursor,
      limit: 200
    });

    if (!response.ok) {
      throw new Error(response.error ?? 'Failed to fetch Slack thread');
    }

    messages.push(...((response.messages ?? []) as SlackMessage[]));
    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return messages;
}

async function fetchAllUsers(slack: WebClient): Promise<Map<string, SlackUser>> {
  const users = new Map<string, SlackUser>();
  let cursor: string | undefined;

  do {
    const response = await slack.users.list({
      cursor,
      limit: 200
    });

    if (!response.ok) {
      throw new Error(response.error ?? 'Failed to fetch Slack users');
    }

    for (const user of (response.members ?? []) as SlackUser[]) {
      users.set(user.id, user);
    }

    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return users;
}

function formatTranscript(
  messages: SlackMessage[],
  userMap: Map<string, SlackUser>
): SlackThreadMessage[] {
  return messages
    .filter((message) => message.user || message.bot_id)
    .map((message) => {
      const userId = message.user ?? message.bot_id ?? 'unknown';
      const user = userMap.get(userId);
      const authorName = user?.profile?.display_name || user?.profile?.real_name || 'Unknown';
      const timestamp = formatTimestamp(message.ts);

      return {
        authorId: userId,
        authorName,
        timestamp,
        text: message.text ?? ''
      };
    });
}

function formatTimestamp(ts?: string): string {
  if (!ts) {
    return '';
  }

  const millis = Number(ts) * 1000;
  if (!Number.isFinite(millis)) {
    return ts;
  }

  return new Date(millis).toISOString();
}

function buildSlackThreadUrl(channelId: string, threadTs: string): string {
  const sanitized = threadTs.replace('.', '');
  return `https://slack.com/archives/${channelId}/p${sanitized}`;
}

function formatTypedErrorMessage(error: unknown): string | null {
  if (error instanceof ClaudeParseError || error instanceof ClaudeValidationError) {
    return `Claude could not summarize this thread. ${error.message}`;
  }

  if (error instanceof NotionSchemaError) {
    return `Notion database schema issue: ${error.message}`;
  }

  if (error instanceof NotionPermissionError) {
    return 'Notion permission error: the integration lacks access to this database.';
  }

  if (error instanceof NotionWriteError) {
    return `Notion write failed: ${error.message}`;
  }

  return null;
}

async function safePostSlackThreadReply(
  slack: WebClient,
  channelId: string,
  threadTs: string,
  text: string
): Promise<void> {
  try {
    const response = await slack.chat.postMessage({
      channel: channelId,
      thread_ts: threadTs,
      text
    });

    if (!response.ok) {
      throw new Error(response.error ?? 'Failed to post Slack reply');
    }
  } catch (error) {
    console.error('Slack reply failed:', error);
  }
}
