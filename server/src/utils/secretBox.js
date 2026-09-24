import crypto from 'crypto';

// Authenticated symmetric encryption for third-party credentials held at rest
// (currently Xero OAuth tokens). The key is derived from JWT_SECRET so there is
// no second secret to distribute — rotating JWT_SECRET invalidates stored
// tokens, which forces a harmless reconnect rather than leaking anything.
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;

let cachedKey = null;

const getKey = () => {
  if (cachedKey) return cachedKey;
  const source = process.env.JWT_SECRET;
  if (!source) {
    throw new Error('JWT_SECRET is required to encrypt stored credentials');
  }
  cachedKey = crypto.createHash('sha256').update(`${source}::secret-box-v1`).digest();
  return cachedKey;
};

// Returns "iv.authTag.ciphertext", all base64url — safe for a TEXT column.
export const encryptSecret = (plainText) => {
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plainText), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('base64url'), authTag.toString('base64url'), ciphertext.toString('base64url')].join('.');
};

export const decryptSecret = (payload) => {
  const [ivPart, tagPart, dataPart] = String(payload).split('.');
  if (!ivPart || !tagPart || !dataPart) {
    throw new Error('Malformed encrypted payload');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivPart, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const plain = Buffer.concat([decipher.update(Buffer.from(dataPart, 'base64url')), decipher.final()]);
  return plain.toString('utf8');
};
