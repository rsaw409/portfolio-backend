import { vi, describe, test, expect } from 'vitest';
import * as nodeCrypto from 'node:crypto';

// The key is read when the module loads, so it must be set before the import.
vi.stubEnv('ENCRYPTION_KEY', 'tests');
const { default: crypto } = await import('../../../src/@rsaw409/crypto.js');

/** A token in the random-IV form invite IDs were issued in before. */
const legacyToken = (text: string) => {
  const key = nodeCrypto.createHash('sha256').update('tests').digest();
  const iv = nodeCrypto.randomBytes(12);
  const cipher = nodeCrypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  return [iv, encrypted, cipher.getAuthTag()]
    .map((part) => part.toString('base64'))
    .join(':');
};

describe('CRYPTO TESTS', () => {
  test('encryptDeterministic round-trips through decrypt', () => {
    const text = 'test Data';
    expect(crypto.decrypt(crypto.encryptDeterministic(text))).toEqual(text);
  });

  test('encryptDeterministic gives the same token for the same text', () => {
    expect(crypto.encryptDeterministic('42')).toEqual(
      crypto.encryptDeterministic('42')
    );
  });

  test('encryptDeterministic uses a different IV for different text', () => {
    const iv = (token: string) => token.split(':')[0];
    expect(iv(crypto.encryptDeterministic('42'))).not.toEqual(
      iv(crypto.encryptDeterministic('43'))
    );
  });

  test('invite IDs issued with a random IV still decrypt', () => {
    expect(crypto.decrypt(legacyToken('42'))).toEqual('42');
  });

  test('a tampered token is rejected', () => {
    const [iv, encrypted, tag] = crypto.encryptDeterministic('42').split(':');
    const forged = Buffer.from(tag, 'base64');
    forged[0] ^= 1;
    expect(() =>
      crypto.decrypt([iv, encrypted, forged.toString('base64')].join(':'))
    ).toThrow();
  });
});
