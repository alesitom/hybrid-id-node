// Public API surface — populated as phases land.
export const VERSION = '1.0.0';

export { BASE62, encodeBase62, decodeBase62, isBase62String } from './base62.js';

export { Profile } from './profile.js';
export type { ProfileConfig, BuiltInProfile, ProfileInput } from './profile.js';

export { ProfileRegistry } from './profile-registry.js';
export type { ProfileRegistryInterface } from './profile-registry.js';

export {
  HybridIdGenerator,
  DEFAULT_MAX_DRIFT_MS,
  type HybridIdGeneratorOptions,
} from './hybrid-id-generator.js';

export {
  PREFIX_SEPARATOR,
  PREFIX_MAX_LENGTH,
  isValidPrefix,
  validatePrefix,
  applyPrefix,
  extractPrefix,
  stripPrefix,
} from './prefix.js';

export {
  parse,
  detectProfile,
  isValid,
  extractTimestamp,
  extractDate,
  extractNode,
  compare,
  recommendedColumnSize,
  entropy,
  profileConfig,
  profiles,
  MAX_ID_LENGTH,
  type ParsedHybridId,
} from './metadata.js';

export {
  HybridIdError,
  IdOverflowError,
  InvalidIdError,
  InvalidPrefixError,
  InvalidProfileError,
  NodeRequiredError,
} from './exception/errors.js';
