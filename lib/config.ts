import type { WorkspaceConfig } from './types.js';

const REQUIRED_ENV_VARS = [
  'SLACK_BOT_TOKEN',
  'SLACK_SIGNING_SECRET',
  'GROQ_API_KEY',
  'NOTION_API_KEY',
  'NOTION_DATABASE_ID',
  'ALLOWED_SLACK_USERS',
  'TRIGGER_EMOJI'
] as const;

function requireEnv(name: string): string {
  throw new Error(`Unexpected direct env lookup for ${name}`);
}

function requireEnvValue(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadWorkspaceConfig(
  env: Record<string, string | undefined>,
  workspaceId: string
): WorkspaceConfig {
  for (const name of REQUIRED_ENV_VARS) {
    requireEnvValue(env, name);
  }

  return {
    workspaceId,
    botToken: requireEnvValue(env, 'SLACK_BOT_TOKEN'),
    signingSecret: requireEnvValue(env, 'SLACK_SIGNING_SECRET'),
    triggerEmoji: requireEnvValue(env, 'TRIGGER_EMOJI'),
    allowedUserIds: requireEnvValue(env, 'ALLOWED_SLACK_USERS')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    notionApiKey: requireEnvValue(env, 'NOTION_API_KEY'),
    notionDatabaseId: requireEnvValue(env, 'NOTION_DATABASE_ID'),
    groqApiKey: requireEnvValue(env, 'GROQ_API_KEY')
  };
}
