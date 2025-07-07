#!/usr/bin/env node

import { EventSource } from 'eventsource';

const URL = 'https://caissa-mcp-airtable.zeabur.app/mcp';
const TOKEN = 'c74fcaec04bf90aa7bf2ad35c52d0f95289bf0889e3bfa00c9a79c09fe390f1a';

console.log('Testing SSE connection to:', URL);
console.log('Using token:', TOKEN.substring(0, 10) + '...');

// Test 1: Direct EventSource with headers
console.log('\n1. Testing with EventSource library:');
const es = new EventSource(URL, {
  headers: {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'text/event-stream'
  },
  withCredentials: false
});

es.onopen = () => {
  console.log('✅ Connection opened!');
};

es.onmessage = (event) => {
  console.log('📨 Message:', event);
  console.log('   Event:', event.event);
  console.log('   Data:', event.data);
};

es.onerror = (error) => {
  console.log('❌ Error:', error);
  if (error.status) {
    console.log('   Status:', error.status);
    console.log('   Status Text:', error.statusText);
  }
  es.close();
  
  // Test 2: Using fetch to debug
  console.log('\n2. Testing with fetch (for comparison):');
  testWithFetch();
};

async function testWithFetch() {
  try {
    const response = await fetch(URL, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'text/event-stream'
      }
    });
    
    console.log('Fetch status:', response.status);
    console.log('Fetch headers:', Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const text = await response.text();
      console.log('Response body:', text);
    } else {
      console.log('✅ Fetch successful! Starting to read stream...');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      let count = 0;
      while (count < 5) { // Read first 5 chunks
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        console.log('Chunk:', chunk);
        count++;
      }
      
      reader.cancel();
    }
  } catch (error) {
    console.log('Fetch error:', error);
  }
}

// Keep process alive for 10 seconds
setTimeout(() => {
  console.log('\nClosing connection...');
  es.close();
  process.exit(0);
}, 10000);