// Public API surface — populated as phases land.
export const VERSION = '1.0.0';

export { BASE62, encodeBase62, decodeBase62, isBase62String } from './base62.js';

export {
  HybridIdError,
  IdOverflowError,
  InvalidIdError,
  InvalidPrefixError,
  InvalidProfileError,
  NodeRequiredError,
} from './exception/errors.js';
