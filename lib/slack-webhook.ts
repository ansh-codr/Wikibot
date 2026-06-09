import crypto from 'node:crypto';

import type { ThreadJob, WorkspaceConfig } from './types.js';

export type SlackReactionAddedEvent = {
  type: 'reaction_added';
  user: string;
  reaction: string;
  item: {
    type: 'message';
    channel: string;
    ts: string;
  };
  event_ts: string;
  item_user?: string;
  bot_id?: string;
};

export type SlackEventEnvelope = {
  type: 'event_callback';
  team_id: string;
  event_id: string;
  event: SlackReactionAddedEvent;
};

export function verifySlackSignature(options: {
  signingSecret: string;
  rawBody: string;
  timestamp: string;
  signature: string;
}): boolean {
  const { signingSecret, rawBody, timestamp, signature } = options;
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));

  if (!Number.isFinite(Number(timestamp)) || ageSeconds > 60 * 5) {
    return false;
  }

  const baseString = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex')}`;

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export function shouldProcessReaction(event: SlackReactionAddedEvent, config: WorkspaceConfig): boolean {
  if (event.type !== 'reaction_added') {
    return false;
  }

  if (event.reaction !== config.triggerEmoji) {
    return false;
  }

  if (event.user === event.bot_id) {
    return false;
  }

  return config.allowedUserIds.includes(event.user);
}

export function buildThreadJob(envelope: SlackEventEnvelope): ThreadJob {
  return {
    workspaceId: envelope.team_id,
    channelId: envelope.event.item.channel,
    threadTs: envelope.event.item.ts,
    eventId: envelope.event_id,
    triggerUserId: envelope.event.user,
    triggerEmoji: envelope.event.reaction
  };
}
