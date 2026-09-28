import * as crypto from 'node:crypto';

class MyCrypto {
  #algorithm = 'aes-256-gcm';
  #ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
  #IV_LENGTH = 12;

  #key = crypto
    .createHash('sha256')
    .update(String(this.#ENCRYPTION_KEY))
    .digest()
    .slice(0, 32);

  // Separate from #key, so the IV derivation and the cipher never share a key.
  #ivKey = Buffer.from(
    crypto.hkdfSync('sha256', this.#key, '', 'deterministic-iv', 32)
  );

  /**
   * The IV is an HMAC of the text, so the same text always gives the same
   * token (used for invite IDs, which must not change for a group). Different
   * texts get different IVs, so GCM never reuses an IV across plaintexts; the
   * only thing this reveals is whether two tokens hold the same text. Tokens
   * issued earlier with a random IV share the format, so decrypt() reads both.
   */
  encryptDeterministic(text: string): string {
    const iv = crypto
      .createHmac('sha256', this.#ivKey)
      .update(text, 'utf8')
      .digest()
      .subarray(0, this.#IV_LENGTH);

    const cipher = crypto.createCipheriv(
      this.#algorithm,
      this.#key,
      iv
    ) as crypto.CipherGCM;

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('base64')}:${encrypted}:${authTag.toString('base64')}`;
  }

  decrypt(encryptedText: string): string {
    const [iv, encrypted, authTag] = encryptedText
      .split(':')
      .map((part) => Buffer.from(part, 'base64'));

    const decipher = crypto.createDecipheriv(
      this.#algorithm,
      this.#key,
      iv
    ) as crypto.DecipherGCM;
    decipher.setAuthTag(authTag);

    // Call update with Buffer directly and specify output encoding as 'utf8'
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }
}

export default new MyCrypto();
