#!/usr/bin/env node

import { spawn } from 'child_process';

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

let output = '';
server.stdout.on('data', (data) => {
  output += data.toString();
});

server.stderr.on('data', (data) => {
  console.log('STDERR:', data.toString());
});

// Initialize first
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

setTimeout(() => {
  // Send initialized notification
  const initializedMsg = {
    jsonrpc: "2.0",
    method: "notifications/initialized"
  };
  server.stdin.write(JSON.stringify(initializedMsg) + '\n');
  
  setTimeout(() => {
    // Test tool call
    const toolMsg = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "html_to_markdown",
        arguments: {
          html: "<h1>Test</h1><p>Hello world</p>",
          clean: true
        }
      }
    };
    
    server.stdin.write(JSON.stringify(toolMsg) + '\n');
    
    setTimeout(() => {
      console.log('OUTPUT:', output);
      server.kill();
    }, 2000);
  }, 500);
}, 500);