// Validate before constructing a pg client: pg accepts connection overrides in
// URL query parameters, so checking URL.hostname alone is not sufficient.
export function validateDatabaseTestTarget(connectionString) {
  if (typeof connectionString !== 'string' || connectionString.length === 0) {
    throw new Error(
      'Set RALLY_DATABASE_TEST_URL to an EMPTY disposable local PostgreSQL database.',
    );
  }

  let target;
  try {
    target = new URL(connectionString);
    // pg decodes these fields. Reject malformed escapes without echoing secrets.
    decodeURIComponent(target.username);
    decodeURIComponent(target.password);
  } catch {
    throw new Error('Invalid PostgreSQL test URL.');
  }

  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Only postgres:// or postgresql:// test URLs are allowed.');
  }
  if (target.search || target.hash) {
    throw new Error('Test URL query parameters and fragments are refused.');
  }
  if (!['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)) {
    throw new Error('Remote databases are refused. Use a loopback host.');
  }
  if (!/^\/rally_test_[a-z0-9_]+$/.test(target.pathname)) {
    throw new Error('Database name must start with rally_test_.');
  }
  if (!target.username || !decodeURIComponent(target.username).trim()) {
    throw new Error('An explicit test database user is required.');
  }
  if (target.port && Number(target.port) === 0) {
    throw new Error('The test database port must be between 1 and 65535.');
  }

  // Avoid DNS/hosts-file resolution for the friendly localhost spelling.
  if (target.hostname === 'localhost') target.hostname = '127.0.0.1';
  return target.toString();
}
