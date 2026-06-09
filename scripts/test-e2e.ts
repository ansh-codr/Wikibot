import { WebClient } from '@slack/web-api';
import { Pool } from 'pg';
import { processThreadJob } from '../lib/process-thread.js';

// 1. Verify required environment variables for real APIs
const requiredEnv = ['GROQ_API_KEY', 'NOTION_API_KEY', 'NOTION_DATABASE_ID'];
const missing = requiredEnv.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Error: Missing required environment variables for real API calls: ${missing.join(', ')}`);
  console.error('Please run the script with these variables set. Example:');
  console.error('  export GROQ_API_KEY="your-key"');
  console.error('  export NOTION_API_KEY="your-key"');
  console.error('  export NOTION_DATABASE_ID="your-db-id"');
  process.exit(1);
}

// Set up dummy environment variables for required Slack & DB configs to satisfy config checks
process.env.SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN || 'xoxb-dummy-token';
process.env.SLACK_SIGNING_SECRET = process.env.SLACK_SIGNING_SECRET || 'dummy-secret';
process.env.ALLOWED_SLACK_USERS = process.env.ALLOWED_SLACK_USERS || 'U12345,U67890';
process.env.TRIGGER_EMOJI = process.env.TRIGGER_EMOJI || 'books';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost:5432/dummy';

// 2. Mock PG Pool query responses to simulate idempotency database checks passing
Pool.prototype.query = async function (queryText: any, values: any) {
  const queryStr = String(queryText).toLowerCase();
  
  if (queryStr.includes('insert into idempotency_keys')) {
    // Return rowCount = 1 to indicate insertion succeeded (not a duplicate)
    return { rowCount: 1, rows: [{ status: 'started' }] };
  }
  
  if (queryStr.includes('select status from idempotency_keys')) {
    return { rowCount: 1, rows: [{ status: 'started' }] };
  }
  
  // Update queries (marking completed or failed)
  return { rowCount: 1, rows: [] };
} as any;

// 3. Mock Slack WebClient API responses
const mockUsers = [
  { id: 'U12345', profile: { display_name: 'alice_eng', real_name: 'Alice Smith' } },
  { id: 'U67890', profile: { display_name: 'bob_pm', real_name: 'Bob Jones' } }
];

const mockMessages = [
  {
    user: 'U12345',
    text: 'Hey team, we need to decide on our architecture for the SlackBOT event intake. Should we use Vercel background functions or a dedicated queue?',
    ts: '1717888800.000100'
  },
  {
    user: 'U67890',
    text: 'I think a dedicated queue (like BullMQ + Redis) is better. We need persistent idempotency to handle Slack duplicates and retry-safe behavior across cold starts.',
    ts: '1717888900.000200'
  },
  {
    user: 'U12345',
    text: 'Agreed. Vercel functions might timeout if Claude or Notion APIs are slow. Let\'s proceed with BullMQ.',
    ts: '1717889000.000300'
  },
  {
    user: 'U67890',
    text: 'Great. Let\'s set up the database migrations for idempotency keys, and build the queue worker.',
    ts: '1717889100.000400'
  }
];

// Patch conversations.replies
(WebClient.prototype as any).conversations = {
  replies: async () => {
    return {
      ok: true,
      messages: mockMessages,
      response_metadata: {}
    };
  }
} as any;

// Patch users.list
(WebClient.prototype as any).users = {
  list: async () => {
    return {
      ok: true,
      members: mockUsers,
      response_metadata: {}
    };
  }
} as any;

// Patch chat.postMessage
(WebClient.prototype as any).chat = {
  postMessage: async (options: any) => {
    console.log('\n[Slack Mock] Posted message to thread:', options.text);
    return { ok: true };
  }
} as any;

// 4. Run the Pipeline
async function runTest() {
  console.log('Starting end-to-end local test run...');
  console.log('Configured Database Mock: OK');
  console.log('Configured Slack Mock: OK');
  console.log('Connecting to real Claude and Notion APIs...');

  const mockJob = {
    workspaceId: 'T0001',
    channelId: 'C0001',
    threadTs: '1717888800.000100',
    eventId: 'Ev001',
    triggerUserId: 'U67890',
    triggerEmoji: 'books'
  };

  try {
    const result = await processThreadJob(mockJob);
    console.log('\nPipeline Run Result:', result);
    if (result.ok) {
      console.log('\n🎉 Success! Real Notion Page Created:', result.notionPageUrl);
    } else {
      console.log('\n❌ Pipeline failed:', result.message);
    }
  } catch (error) {
    console.error('\n❌ Unexpected error running test:', error);
  }
}

runTest();
