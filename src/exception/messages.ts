/**
 * Centralized exception messages.
 *
 * @internal These strings are an implementation detail and may change between
 *           minor versions. Do NOT assert against them in downstream test
 *           suites — match on the error class instead.
 */
export const Messages = {
  // ProfileRegistry
  PROFILE_NAME_INVALID: 'Profile name must be lowercase alphanumeric, starting with a letter',
  PROFILE_EXISTS: 'Profile "%s" already exists',
  RANDOM_LENGTH_INVALID: 'Random length must be between 6 and 128',
  NODE_LENGTH_INVALID: 'Node length must be between 0 and 10',
  LENGTH_CONFLICT: 'Length %d conflicts with existing profile "%s"',

  // MockHybridIdGenerator
  MOCK_EMPTY: 'MockHybridIdGenerator requires at least one ID',
  MOCK_PREFIX_MISMATCH:
    'MockHybridIdGenerator: generate() called with prefix "%s" but ID "%s" does not start with "%s_". %s',
  MOCK_BATCH_LIMIT: 'Batch count must be between 1 and 10,000, got %d',
  MOCK_EXHAUSTED: 'MockHybridIdGenerator exhausted: all %d IDs have been consumed',

  // UuidConverter
  UUID_UNRECOGNIZED_PROFILE: 'Unrecognized profile index in UUIDv8',
  UUID_PACK_UNSUPPORTED:
    'Profile "%s" cannot be losslessly packed into UUIDv8 (max 60 random bits)',
  UUID_NEGATIVE_TS: 'Timestamp must be non-negative',
  UUID_TS_OVERFLOW: 'Timestamp exceeds maximum encodable value (62^8 - 1)',
  UUID_NODE_INVALID: 'Node must be exactly 2 base62 characters',
  UUID_INVALID_FORMAT: 'Invalid UUID format',
  UUID_INVALID_VARIANT: 'Invalid UUID variant: expected RFC 4122 variant (10xx)',
  UUID_EXPECTED_VERSION: 'Expected UUID version %d, got %d',
  UUID_PROFILE_UNSUPPORTED: '%s() only supports compact and standard profiles (got "%s")',
  UUID_PREFIX_REJECTED:
    '%s() does not accept prefixed IDs — prefixes are lost during UUID conversion. Strip the prefix first with extractPrefix() and track it separately.',
  UUID_CONVERSION_INVALID: 'Invalid HybridId: cannot convert to %s',
  UUID_HEX_OVERFLOW: 'Hex value exceeds 64-bit integer range',
  UUID_TS_INVALID: 'timestampMs must be a non-negative integer or null',
  UUID_DECODE_OVERFLOW: 'UUID-encoded value does not fit the target profile',

  // HybridIdGenerator
  GEN_DRIFT_INVALID: 'maxDriftMs must be a positive integer, got %d',
  GEN_PROFILE_UNKNOWN: 'Unknown profile "%s"',
  GEN_BLIND_SECRET_LENGTH: 'blindSecret must be at least 32 bytes, got %d',
  GEN_NODE_INVALID: 'Node must be exactly 2 base62 characters (0-9, A-Z, a-z)',
  GEN_NODE_REQUIRED:
    'Explicit node is required (requireExplicitNode is enabled). Provide a 2-character base62 node identifier via the node parameter or HYBRID_ID_NODE env var.',
  GEN_NODE_MISSING_FOR_PROFILE:
    'Profile "%s" requires a node, but this generator was configured without one (profile "%s"). Construct the generator with a node to use this method.',
  GEN_MAX_LENGTH_INVALID: 'maxIdLength (%d) must be >= body length (%d) for profile "%s"',
  GEN_ENV_PROFILE_INVALID: 'Invalid HYBRID_ID_PROFILE: "%s"',
  GEN_ENV_NODE_INVALID: 'Invalid HYBRID_ID_NODE: "%s". Must be exactly 2 base62 characters.',
  GEN_ENV_BLIND_SECRET_INVALID: 'HYBRID_ID_BLIND_SECRET must be valid base64',
  GEN_ENV_MAX_LENGTH_INVALID: 'Invalid HYBRID_ID_MAX_LENGTH: "%s". Must be a positive integer.',
  GEN_BATCH_LIMIT: 'Batch count must be between 1 and 10,000, got %d',
  GEN_PREFIX_LENGTH: 'maxPrefixLength must be between 0 and %d',
  GEN_DATETIME_FAILED: 'Failed to create Date from HybridId (timestamp: %d ms)',
  GEN_DRIFT_EXCEEDED:
    'Monotonic timestamp drift exceeds %dms. Reduce generation rate or use multiple instances.',
  GEN_ID_LENGTH_EXCEEDED:
    'Generated ID length %d exceeds maxIdLength %d. Use a shorter prefix or increase maxIdLength',
  GEN_ENCODE_LENGTH: 'Length must be at least 1',
  GEN_ENCODE_NEGATIVE: 'Cannot encode negative value',
  GEN_ENCODE_OVERFLOW: 'Value exceeds maximum for %d base62 characters',
  GEN_DECODE_EMPTY: 'Cannot decode empty string',
  GEN_DECODE_OVERFLOW: 'Value exceeds 64-bit integer range',
  GEN_DECODE_INVALID_CHAR: 'Invalid base62 character: %s',
  GEN_FORMAT_INVALID: 'Invalid HybridId format',
  GEN_PREFIX_FORMAT:
    'Prefix must be 1-%d lowercase alphanumeric characters, starting with a letter',
  GEN_URANDOM_FAILED: 'Failed to generate cryptographically secure random bytes',
} as const;

/**
 * Minimal printf-style formatter for the message templates above.
 * Replaces `%s`, `%d` (and `%0Nd` width variants) sequentially with the given args.
 */
export function fmt(template: string, ...args: (string | number)[]): string {
  let i = 0;
  return template.replace(/%0?\d*d|%s/g, () => String(args[i++]));
}
