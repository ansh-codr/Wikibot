export class ClaudeParseError extends Error {
  readonly name = 'ClaudeParseError';
}

export class ClaudeValidationError extends Error {
  readonly name = 'ClaudeValidationError';
}

export class NotionSchemaError extends Error {
  readonly name = 'NotionSchemaError';
}

export class NotionPermissionError extends Error {
  readonly name = 'NotionPermissionError';
}

export class NotionWriteError extends Error {
  readonly name = 'NotionWriteError';
}
