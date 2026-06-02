/**
 * @jest-environment node
 *
 * Sprint N.2 Phase 6 — env hardening helpers.
 */

import { requireEnv, requireEnvUrl, MissingEnvError, __test } from '../env';

const ORIG_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIG_ENV };
});

describe('requireEnv', () => {
  test('returns the value when set', () => {
    process.env.LN2_TEST_VAR = 'hello';
    expect(requireEnv('LN2_TEST_VAR')).toBe('hello');
  });

  test('returns the dev default when value is missing and not production', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LN2_TEST_VAR;
    expect(requireEnv('LN2_TEST_VAR', 'dev_default')).toBe('dev_default');
  });

  test('throws MissingEnvError when production and no value', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.LN2_TEST_VAR;
    expect(() => requireEnv('LN2_TEST_VAR', 'dev_default')).toThrow(MissingEnvError);
  });

  test('throws MissingEnvError when no value and no dev default', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.LN2_TEST_VAR;
    expect(() => requireEnv('LN2_TEST_VAR')).toThrow(MissingEnvError);
  });
});

describe('requireEnvUrl', () => {
  test('rejects loopback in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LN2_TEST_URL = 'http://localhost:8000';
    expect(() => requireEnvUrl('LN2_TEST_URL')).toThrow(MissingEnvError);
    process.env.LN2_TEST_URL = 'http://127.0.0.1:8000';
    expect(() => requireEnvUrl('LN2_TEST_URL')).toThrow(MissingEnvError);
  });

  test('allows non-loopback URL in production', () => {
    process.env.NODE_ENV = 'production';
    process.env.LN2_TEST_URL = 'https://api.example.com';
    expect(requireEnvUrl('LN2_TEST_URL')).toBe('https://api.example.com');
  });

  test('allows loopback in development', () => {
    process.env.NODE_ENV = 'development';
    process.env.LN2_TEST_URL = 'http://localhost:8000';
    expect(requireEnvUrl('LN2_TEST_URL')).toBe('http://localhost:8000');
  });

  test('rejects malformed URL', () => {
    process.env.NODE_ENV = 'development';
    process.env.LN2_TEST_URL = 'not a url at all';
    expect(() => requireEnvUrl('LN2_TEST_URL')).toThrow(MissingEnvError);
  });
});

describe('isLoopback', () => {
  test('detects all canonical loopback forms', () => {
    expect(__test.isLoopback('localhost')).toBe(true);
    expect(__test.isLoopback('127.0.0.1')).toBe(true);
    expect(__test.isLoopback('0.0.0.0')).toBe(true);
    expect(__test.isLoopback('::1')).toBe(true);
    expect(__test.isLoopback('api.example.com')).toBe(false);
  });
});
