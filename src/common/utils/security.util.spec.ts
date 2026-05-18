import { redactSensitiveData, sha256 } from './security.util';

describe('security.util', () => {
  it('hashes input with sha256', () => {
    const hashed = sha256('sample-token');
    expect(hashed).toHaveLength(64);
    expect(hashed).toMatch(/^[a-f0-9]+$/);
  });

  it('redacts sensitive keys recursively', () => {
    const payload = {
      email: 'user@example.com',
      password: 'secret',
      nested: {
        token: 'abc',
        safe: 'ok',
      },
    };

    const redacted = redactSensitiveData(payload);

    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.nested.token).toBe('[REDACTED]');
    expect(redacted.nested.safe).toBe('ok');
  });
});
