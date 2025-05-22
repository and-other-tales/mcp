#!/usr/bin/env node

// Complete test of MCP server
import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let responses = [];

server.stdout.on('data', (data) => {
  const lines = data.toString().split('\n').filter(line => line.trim());
  lines.forEach(line => {
    if (line.includes('"jsonrpc"')) {
      try {
        const response = JSON.parse(line);
        responses.push(response);
        console.log('Response received:', JSON.stringify(response, null, 2));
      } catch (e) {
        console.log('Raw output:', line);
      }
    } else if (line.trim()) {
      console.log('Server log:', line);
    }
  });
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

// Test sequence
async function runTests() {
  console.log('=== Testing MCP Server ===\n');
  
  // 1. Initialize
  console.log('1. Initializing...');
  const initMsg = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test", version: "1.0.0" }
    }
  };
  server.stdin.write(JSON.stringify(initMsg) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 2. Send initialized notification
  console.log('2. Sending initialized notification...');
  const initializedMsg = {
    jsonrpc: "2.0",
    method: "notifications/initialized"
  };
  server.stdin.write(JSON.stringify(initializedMsg) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // 3. List tools
  console.log('3. Listing tools...');
  const listToolsMsg = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {}
  };
  server.stdin.write(JSON.stringify(listToolsMsg) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 4. Test HTML to markdown tool
  console.log('4. Testing html_to_markdown tool...');
  const toolCallMsg = {
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "html_to_markdown",
      arguments: {
        html: "<h1>Test</h1><p>This is a test HTML content.</p>",
        clean: true
      }
    }
  };
  server.stdin.write(JSON.stringify(toolCallMsg) + '\n');
  
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  console.log('\n=== Test Summary ===');
  console.log(`Total responses received: ${responses.length}`);
  server.kill();
}

runTests().catch(console.error);