#!/usr/bin/env node

/**
 * Generate a secure random token for MCP authentication
 */

const crypto = require('crypto');

// Generate a 32-byte (256-bit) random token
const generateToken = () => {
  return crypto.randomBytes(32).toString('base64url');
};

// Generate multiple token options
console.log('🔐 MCP Authentication Token Generator\n');
console.log('Choose one of these secure tokens for your MCP_AUTH_TOKEN:\n');

for (let i = 1; i <= 3; i++) {
  const token = generateToken();
  console.log(`Option ${i}: ${token}`);
}

console.log('\n📋 Instructions:');
console.log('1. Copy one of the tokens above');
console.log('2. Set it as MCP_AUTH_TOKEN in your Zeabur environment variables');
console.log('3. Use the same token in your Claude Desktop configuration');
console.log('\n⚠️  Keep this token secret and never commit it to version control!');