export type SlackThreadMessage = {
  authorId: string;
  authorName: string;
  timestamp: string;
  text: string;
};

export type ThreadJob = {
  workspaceId: string;
  channelId: string;
  threadTs: string;
  eventId: string;
  triggerUserId: string;
  triggerEmoji: string;
};

export type WorkspaceConfig = {
  workspaceId: string;
  botToken: string;
  signingSecret: string;
  triggerEmoji: string;
  allowedUserIds: string[];
  notionApiKey: string;
  notionDatabaseId: string;
  groqApiKey: string;
};

export type JobResult =
  | { ok: true; notionPageUrl: string }
  | { ok: false; code: string; message: string };
