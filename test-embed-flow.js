/**
 * Test script to verify the embed token flow.
 */

const crypto = require('crypto');

const TOKEN_BYTES = 24;
const TOKEN_PREFIX = 'dlf_';

function generateToken() {
  const random = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  const plaintext = `${TOKEN_PREFIX}${random}`;
  const hash = hashToken(plaintext);
  return { plaintext, hash };
}

function hashToken(plaintext) {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

console.log('=== Embed Token Flow Test ===\n');

// Step 1: Generate token
const { plaintext, hash } = generateToken();
console.log('1. Generated token:');
console.log('   plaintext:', plaintext);
console.log('   plaintext length:', plaintext.length, '(expected: 4 + 48 = 52)');
console.log('   hash:', hash);

// Step 2: Verify format
const isWellFormed =
  typeof plaintext === 'string' &&
  plaintext.startsWith(TOKEN_PREFIX) &&
  plaintext.length === TOKEN_PREFIX.length + TOKEN_BYTES * 2 &&
  /^[a-z0-9_]+$/.test(plaintext);

console.log('\n2. Token format validation:');
console.log('   Well-formed:', isWellFormed);

// Step 3: Hash validation
const receivedToken = plaintext;
const calculatedHash = hashToken(receivedToken);

console.log('\n3. Hash validation:');
console.log('   Calculated hash:', calculatedHash);
console.log('   Stored hash:', hash);
console.log('   Hashes match:', calculatedHash === hash);

// Step 4: Consistency test
console.log('\n4. Consistency test (10 tokens):');
let allMatch = true;
for (let i = 0; i < 10; i++) {
  const { plaintext: pt, hash: h } = generateToken();
  const recalc = hashToken(pt);
  const matches = recalc === h;
  if (!matches) allMatch = false;
  console.log(`   Token ${i + 1}: ${matches ? '✓' : '✗'}`);
}
console.log('   All match:', allMatch);

console.log('\n=== Test Complete ===');
