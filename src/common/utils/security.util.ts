import * as crypto from 'crypto';

const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'token',
  'authorization',
  'api_key',
  'apiKey',
  'secret',
];

export function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export function redactSensitiveData<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveData(item)) as T;
  }

  if (value && typeof value === 'object') {
    const clone: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (SENSITIVE_KEYS.includes(key)) {
        clone[key] = '[REDACTED]';
        continue;
      }
      clone[key] = redactSensitiveData(nested);
    }
    return clone as T;
  }

  return value;
}
