import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Client } from 'pg';
import { validateDatabaseTestTarget } from './database-target.mjs';

// These checks only construct clients and inspect parsed parameters. They never
// connect to PostgreSQL or perform a network request.
void test('accepted URLs give pg the validated loopback host, database and explicit user', () => {
  for (const [host, expectedHost] of [
    ['localhost', '127.0.0.1'],
    ['127.0.0.1', '127.0.0.1'],
    ['[::1]', '::1'],
  ]) {
    const safe = validateDatabaseTestTarget(
      `postgresql://test%2Duser:test%40password@${host}:55438/rally_test_guard`,
    );
    const client = new Client({ connectionString: safe });
    assert.equal(client.connectionParameters.host, expectedHost);
    assert.equal(client.connectionParameters.database, 'rally_test_guard');
    assert.equal(client.connectionParameters.user, 'test-user');
    assert.equal(client.connectionParameters.port, 55438);
    assert.equal(client.connectionParameters.password, 'test@password');
  }
  assert.doesNotThrow(() =>
    validateDatabaseTestTarget(
      'postgres://postgres@127.0.0.1/rally_test_guard',
    ),
  );
});

void test('query overrides cannot redirect a seemingly local test URL', () => {
  const prefix = 'postgresql://postgres@127.0.0.1/rally_test_guard';
  const override = `${prefix}?host=remote.example.invalid`;
  // Reproduce the driver behavior that made the original hostname check unsafe.
  assert.equal(
    new Client({ connectionString: override }).connectionParameters.host,
    'remote.example.invalid',
  );
  for (const suffix of [
    '?host=remote.example.invalid',
    '?%68ost=remote.example.invalid',
    '?host=%2Ftmp',
    '?user=other_user',
    '?port=5433',
    '?options=-csearch_path%3Dother',
    '?sslmode=require',
    '#ignored-fragment',
  ]) {
    assert.throws(
      () => validateDatabaseTestTarget(prefix + suffix),
      /query parameters and fragments are refused/,
    );
  }
});

void test('remote hosts, other databases, schemes and implicit users are refused', () => {
  for (const value of [
    'postgresql://postgres@remote.example.invalid/rally_test_guard',
    'postgresql://postgres@127.0.0.1.example.invalid/rally_test_guard',
    'postgresql://postgres@127.0.0.1/production',
    'postgresql://postgres@127.0.0.1/rally_test_',
    'postgresql://postgres@127.0.0.1/rally_test_guard/extra',
    'postgresql://postgres@127.0.0.1/rally_test_%67uard',
    'https://postgres@127.0.0.1/rally_test_guard',
    'socket://postgres@127.0.0.1/rally_test_guard',
    'postgresql://127.0.0.1/rally_test_guard',
    'postgresql://%20@127.0.0.1/rally_test_guard',
    'postgresql://postgres@127.0.0.1:0/rally_test_guard',
  ]) {
    assert.throws(() => validateDatabaseTestTarget(value));
  }
});

void test('missing or malformed URLs fail without disclosing supplied credentials', () => {
  for (const value of [undefined, '', 'not a URL']) {
    assert.throws(() => validateDatabaseTestTarget(value));
  }
  const secret = 'private-test-password';
  for (const value of [
    `postgresql://postgres:${secret}@127.0.0.1:invalid/rally_test_guard`,
    `postgresql://postgres:${secret}%ZZ@127.0.0.1/rally_test_guard`,
  ]) {
    assert.throws(
      () => validateDatabaseTestTarget(value),
      (error) => {
        assert.equal(error.message, 'Invalid PostgreSQL test URL.');
        assert.ok(!String(error).includes(secret));
        assert.equal(error.input, undefined);
        return true;
      },
    );
  }
});
