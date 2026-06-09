import { Client, APIResponseError } from '@notionhq/client';
import type { CreatePageParameters } from '@notionhq/client/build/src/api-endpoints.js';

import { NotionPermissionError, NotionSchemaError, NotionWriteError } from './errors.js';
import type { ClaudeSummary } from './claude.js';

const REQUIRED_PROPERTIES = {
  Title: 'title',
  Date: 'date',
  'Source Thread': 'url',
  Summary: 'rich_text',
  Decisions: 'rich_text',
  Tags: 'multi_select'
} as const;

type PropertySchema = {
  id: string;
  type: string;
};

type DatabaseSchema = Record<string, PropertySchema>;

export async function createNotionPage(options: {
  apiKey: string;
  databaseId: string;
  summary: ClaudeSummary;
  sourceThreadUrl: string;
}): Promise<string> {
  const { apiKey, databaseId, summary, sourceThreadUrl } = options;
  const client = new Client({ auth: apiKey });

  try {
    const schema = await loadDatabaseSchema(client, databaseId);
    const properties = buildProperties(schema, summary, sourceThreadUrl);
    const children = buildBlocks(summary);

    const response = await client.pages.create({
      parent: { database_id: databaseId },
      properties: properties as CreatePageParameters['properties'],
      children: children as CreatePageParameters['children']
    });

    const page = response as { url?: string };
    return page.url ?? '';
  } catch (error) {
    const mapped = mapNotionError(error);
    console.error('Notion error:', mapped);
    throw mapped;
  }
}

async function loadDatabaseSchema(client: Client, databaseId: string): Promise<DatabaseSchema> {
  const response = await client.databases.retrieve({ database_id: databaseId });
  const properties = response.properties ?? {};
  const schema: DatabaseSchema = {};

  for (const [name, property] of Object.entries(properties)) {
    schema[name] = { id: property.id, type: property.type };
  }

  return schema;
}

function buildProperties(
  schema: DatabaseSchema,
  summary: ClaudeSummary,
  sourceThreadUrl: string
): Record<string, unknown> {
  const missing: string[] = [];

  for (const [name, type] of Object.entries(REQUIRED_PROPERTIES)) {
    const property = schema[name];
    if (!property || property.type !== type) {
      missing.push(`${name} (${type})`);
    }
  }

  if (missing.length > 0) {
    throw new NotionSchemaError(`Notion database schema mismatch. Missing: ${missing.join(', ')}`);
  }

  return {
    Title: {
      title: [{ text: { content: summary.title } }]
    },
    Date: {
      date: { start: new Date().toISOString() }
    },
    'Source Thread': {
      url: sourceThreadUrl
    },
    Summary: {
      rich_text: [{ text: { content: summary.summary } }]
    },
    Decisions: {
      rich_text: [{ text: { content: summary.decisions.join('\n') } }]
    },
    Tags: {
      multi_select: summary.tags.map((tag) => ({ name: tag }))
    }
  };
}

function buildBlocks(summary: ClaudeSummary): Array<Record<string, unknown>> {
  const blocks: Array<Record<string, unknown>> = [];

  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Summary' } }] }
  });

  for (const paragraph of splitParagraphs(summary.summary)) {
    blocks.push({
      object: 'block',
      type: 'paragraph',
      paragraph: { rich_text: [{ text: { content: paragraph } }] }
    });
  }

  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Decisions Made' } }] }
  });

  for (const decision of summary.decisions) {
    blocks.push({
      object: 'block',
      type: 'bulleted_list_item',
      bulleted_list_item: { rich_text: [{ text: { content: decision } }] }
    });
  }

  blocks.push({
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [{ text: { content: 'Action Items' } }] }
  });

  for (const item of summary.actionItems) {
    blocks.push({
      object: 'block',
      type: 'to_do',
      to_do: { rich_text: [{ text: { content: item } }], checked: false }
    });
  }

  return blocks;
}

function splitParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function mapNotionError(error: unknown): Error {
  if (error instanceof NotionSchemaError) {
    return error;
  }

  if (error instanceof APIResponseError) {
    if (error.code === 'unauthorized' || error.code === 'restricted_resource') {
      return new NotionPermissionError(`Notion permission error: ${error.code}`);
    }

    return new NotionWriteError(`Notion API error: ${error.code} - ${error.message}`);
  }

  return new NotionWriteError(`Notion write failed: ${String(error)}`);
}
