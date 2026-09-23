/**
 * No-op stand-in for the `server-only` package.
 *
 * That package exists to make the bundler fail if a server module is pulled
 * into a client bundle. Unit tests import server modules deliberately, in
 * Node, so the guard has nothing to protect and only gets in the way —
 * vitest.config.mts aliases it here.
 */
export {};
