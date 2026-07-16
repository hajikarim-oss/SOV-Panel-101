import crypto from 'crypto'

const ALGORITHM = 'aes-256-cbc'
const IV_LENGTH = 16 // bytes

function getSecret(): Buffer {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET
  if (!secret) throw new Error('API_KEY_ENCRYPTION_SECRET env var is not set')
  // Pad / truncate to exactly 32 bytes for AES-256
  return Buffer.from(secret.padEnd(32).slice(0, 32), 'utf8')
}

/**
 * Encrypts a plaintext API key string.
 * Returns a hex string: `<iv_hex>:<ciphertext_hex>`
 * Safe to store in SQLite.
 */
export function encryptApiKey(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, getSecret(), iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a value stored by `encryptApiKey`.
 * Returns the original plaintext key string.
 */
export function decryptApiKey(stored: string): string {
  const [ivHex, encHex] = stored.split(':')
  if (!ivHex || !encHex) throw new Error('Invalid encrypted key format')
  const iv = Buffer.from(ivHex, 'hex')
  const encrypted = Buffer.from(encHex, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, getSecret(), iv)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return decrypted.toString('utf8')
}

/**
 * Masks a plaintext key for safe display.
 * Shows first 8 chars then ••••••••••••••••••••••••
 */
export function maskApiKey(plaintext: string): string {
  return plaintext.slice(0, 8) + '•'.repeat(24)
}
