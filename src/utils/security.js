/**
 * Security Service
 * 
 * Provides AES-GCM encryption and decryption using the Web Crypto API.
 * Uses PBKDF2 for key derivation from a password.
 */

const ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;
const KEY_ALGO = { name: 'PBKDF2' };
const ENCRYPTION_ALGO = { name: 'AES-GCM', length: 256 };

/**
 * Derives an encryption key from a password and salt.
 * @param {string} password 
 * @param {Uint8Array} salt 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKey(password, salt) {
  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    KEY_ALGO,
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      ...KEY_ALGO,
      salt,
      iterations: ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    ENCRYPTION_ALGO,
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts data using AES-GCM.
 * @param {any} data - Data to encrypt (must be JSON-serializable)
 * @param {string} password - Password for encryption
 * @returns {Promise<string>} Base64-encoded [salt][iv][ciphertext]
 */
export async function encryptData(data, password) {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(JSON.stringify(data));
  
  const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
  
  const key = await deriveKey(password, salt);
  
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  // Combine salt, iv, and ciphertext into one buffer
  const combined = new Uint8Array(SALT_SIZE + IV_SIZE + ciphertext.byteLength);
  combined.set(salt, 0);
  combined.set(iv, SALT_SIZE);
  combined.set(new Uint8Array(ciphertext), SALT_SIZE + IV_SIZE);

  // Convert to Base64
  return btoa(String.fromCharCode(...combined));
}

/**
 * Decrypts data using AES-GCM.
 * @param {string} base64Data - Base64-encoded [salt][iv][ciphertext]
 * @param {string} password - Password for decryption
 * @returns {Promise<any>} Decrypted data
 */
export async function decryptData(base64Data, password) {
  try {
    const combined = new Uint8Array(
      atob(base64Data).split('').map(char => char.charCodeAt(0))
    );

    const salt = combined.slice(0, SALT_SIZE);
    const iv = combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
    const ciphertext = combined.slice(SALT_SIZE + IV_SIZE);

    const key = await deriveKey(password, salt);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    return JSON.parse(decoder.decode(decrypted));
  } catch (err) {
    console.error('Decryption failed:', err);
    throw new Error('Failed to decrypt data. Incorrect password or corrupted data.');
  }
}
