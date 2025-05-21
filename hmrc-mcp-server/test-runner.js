#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Tool definitions to test
const tools = [
  {
    name: "search-guidance",
    params: { title: "Capital Gains Tax", limit: 3 },
    description: "Search for tax guidance by title"
  },
  {
    name: "search-tax-forms",
    params: { query: "Self Assessment" },
    description: "Search for tax forms and returns"
  },
  {
    name: "search-by-tax-topic",
    params: { topic: "income-tax" },
    description: "Search for guidance by tax topic"
  },
  {
    name: "vat-calculator",
    params: { amount: 1000, vatRate: 20, includesVat: false },
    description: "Calculate VAT for a given amount"
  }
];

console.log("HMRC MCP Server Test Runner");
console.log("==========================");
console.log("This script will test the HMRC MCP server by invoking several tools.");
console.log("Make sure to build the server first with 'npm run build'.\n");

// Start the MCP server process
const serverProcess = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', process.stderr]
});

// Create readline interface for input/output
const rl = createInterface({
  input: serverProcess.stdout,
  output: serverProcess.stdin,
  terminal: false
});

// Wait for server to be ready
rl.once('line', (line) => {
  console.log("Server started, beginning tests...\n");
  
  // Run tests sequentially
  runNextTest(0);
});

// Function to run tests one by one
function runNextTest(index) {
  if (index >= tools.length) {
    console.log("\nAll tests completed!");
    serverProcess.kill();
    process.exit(0);
    return;
  }
  
  const tool = tools[index];
  console.log(`Testing tool: ${tool.name} - ${tool.description}`);
  
  // Create tool invocation message
  const message = {
    type: "invoke",
    id: `test-${index + 1}`,
    name: tool.name,
    params: tool.params
  };
  
  // Send the message to the server
  serverProcess.stdin.write(JSON.stringify(message) + "\n");
  
  // Wait for response
  rl.once('line', (line) => {
    try {
      const response = JSON.parse(line);
      console.log(`Result: ${response.status === "success" ? "SUCCESS" : "FAILED"}`);
      
      if (response.status === "success") {
        // Print truncated content (first 150 chars)
        const content = response.content[0].text;
        console.log(`Content snippet: ${content.substring(0, 150)}${content.length > 150 ? '...' : ''}\n`);
      } else {
        console.log(`Error: ${response.error}\n`);
      }
      
      // Run next test
      setTimeout(() => runNextTest(index + 1), 500);
    } catch (error) {
      console.error("Error parsing response:", error);
      serverProcess.kill();
      process.exit(1);
    }
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log("\nTest runner terminated.");
  serverProcess.kill();
  process.exit(0);
}); 