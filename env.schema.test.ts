import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkEnv, envSchema } from './env.schema';

// covers: spec 0010 AC-4, AC-7, AC-10

const errorOf = (env: Record<string, string | undefined>, mode: string): string => {
  try {
    checkEnv(env, mode);
  } catch (error) {
    return (error as Error).message;
  }
  throw new Error('expected the environment check to fail');
};

const LOCAL = { VITE_API_BASE_URL: 'http://localhost:3000' };
const HOSTED = { VITE_API_BASE_URL: 'https://api.welinc.test' };

describe('checkEnv', () => {
  it('passes the local address in development and a real one in production', () => {
    expect(checkEnv(LOCAL, 'development')).toEqual(LOCAL);
    expect(checkEnv(HOSTED, 'production')).toEqual(HOSTED);
  });

  it('refuses a missing or blank address (AC-7)', () => {
    expect(errorOf({}, 'development')).toContain('VITE_API_BASE_URL: is required');
    expect(errorOf({ VITE_API_BASE_URL: '  ' }, 'development')).toContain(
      'VITE_API_BASE_URL: is required',
    );
  });

  it('refuses a malformed address (AC-7)', () => {
    expect(errorOf({ VITE_API_BASE_URL: 'api' }, 'development')).toContain(
      'VITE_API_BASE_URL: must be an http or https URL',
    );
  });

  it('refuses http and localhost only in production (AC-4)', () => {
    expect(errorOf(LOCAL, 'production')).toContain(
      'VITE_API_BASE_URL: must use https in production',
    );
    expect(errorOf({ VITE_API_BASE_URL: 'https://127.0.0.1' }, 'production')).toContain(
      'VITE_API_BASE_URL: must not point at localhost in production',
    );
  });

  it('never puts a value in the message', () => {
    for (const value of ['SENTINEL-77', 'http://SENTINEL-77.test']) {
      expect(errorOf({ VITE_API_BASE_URL: value }, 'production')).not.toContain('SENTINEL-77');
    }
  });
});

describe('the env files and the schema stay in step (AC-10)', () => {
  /** Lines like `NAME=` or `# NAME=`: commented names count as documented. */
  const namesIn = (file: string) =>
    readFileSync(join(import.meta.dirname, file), 'utf8')
      .split(/\r?\n/)
      .map((line) => /^#?\s*([A-Z][A-Z0-9_]*)=/.exec(line)?.[1])
      .filter((name): name is string => Boolean(name))
      .sort();
  const schemaNames = Object.keys(envSchema.shape).sort();

  it('.env.example names exactly the schema', () => {
    expect(namesIn('.env.example')).toEqual(schemaNames);
  });

  it('.env.development names exactly the schema', () => {
    expect(namesIn('.env.development')).toEqual(schemaNames);
  });
});
