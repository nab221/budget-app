const { encryptData, decryptData } = require('./src/utils/security.js');

// Mock browser globals for Node.js if needed
if (typeof crypto === 'undefined') {
  global.crypto = require('crypto').webcrypto;
}
if (typeof btoa === 'undefined') {
  global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
}
if (typeof atob === 'undefined') {
  global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
}

async function testSecurity() {
  const password = 'my-secret-password';
  const data = {
    test: 'message',
    nested: {
      key: 'value'
    },
    array: [1, 2, 3]
  };

  try {
    console.log('Encrypting...');
    const encrypted = await encryptData(data, password);
    console.log('Encrypted Base64:', encrypted);

    console.log('Decrypting...');
    const decrypted = await decryptData(encrypted, password);
    console.log('Decrypted data:', JSON.stringify(decrypted, null, 2));

    const identity = JSON.stringify(data) === JSON.stringify(decrypted);
    console.log('Identity Test Passed:', identity);

    if (!identity) {
      throw new Error('Decrypted data does not match original data');
    }

    console.log('Testing wrong password...');
    try {
      await decryptData(encrypted, 'wrong-password');
      console.error('FAIL: Decrypted with wrong password!');
      process.exit(1);
    } catch (err) {
      console.log('Correctly failed with wrong password:', err.message);
    }

    console.log('All security tests passed!');
  } catch (err) {
    console.error('Security test failed:', err);
    process.exit(1);
  }
}

// Since security.js uses ES modules (export), I need to handle that.
// But security.js is written as ESM. Node might not like it if it's not .mjs or type: module.
// I'll just run it with a quick check.
testSecurity();
