#!/usr/bin/env node

// Simple test script to verify the MCP server is working
import { spawn } from 'child_process';

console.log('Testing MCP Server...');

const server = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', 'pipe']
});

// Test initialization
const initMessage = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: {
      name: "test-client",
      version: "1.0.0"
    }
  }
};

let responseData = '';
server.stdout.on('data', (data) => {
  responseData += data.toString();
  console.log('Server response:', data.toString());
});

server.stderr.on('data', (data) => {
  console.error('Server error:', data.toString());
});

server.on('close', (code) => {
  console.log(`Server exited with code ${code}`);
});

// Send initialization message
setTimeout(() => {
  console.log('Sending initialization message...');
  server.stdin.write(JSON.stringify(initMessage) + '\n');
  
  // Test list tools after init
  setTimeout(() => {
    const listToolsMessage = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list",
      params: {}
    };
    
    console.log('Sending list tools message...');
    server.stdin.write(JSON.stringify(listToolsMessage) + '\n');
    
    // End test after 2 seconds
    setTimeout(() => {
      console.log('Test completed. Closing server...');
      server.kill();
    }, 2000);
  }, 1000);
}, 500);