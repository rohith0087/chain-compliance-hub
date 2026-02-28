/**
 * Development-only logger utility.
 * debug() and info() are silenced in production to prevent PII leakage in browser DevTools.
 * warn() and error() always log (appropriate for production).
 */

const isDev = import.meta.env.DEV;

const noop = (..._args: unknown[]) => {};

const logger = {
  debug: isDev ? console.log.bind(console) : noop,
  info: isDev ? console.info.bind(console) : noop,
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

export default logger;
