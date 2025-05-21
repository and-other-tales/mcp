#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Tool definitions to test
const tools = [
  {
    name: "create_dataset_from_legislation",
    params: { type: "ukpga", maxItems: 3, datasetName: "test-legislation-dataset" },
    description: "Create dataset from UK legislation"
  },
  {
    name: "create_dataset_from_hmrc",
    params: { searchTerm: "Capital Gains Tax", datasetName: "test-hmrc-dataset" },
    description: "Create dataset from HMRC documentation"
  },
  {
    name: "create_dataset_from_urls",
    params: { 
      urls: ["https://example.com"],
      datasetName: "test-url-dataset"
    },
    description: "Create dataset from URLs"
  },
  {
    name: "convert_html_to_markdown",
    params: { html: "<h1>Test</h1><p>Content</p>" },
    description: "Convert HTML to Markdown"
  }
];

console.log("Dataset Creation MCP Server Test Runner");
console.log("=====================================");
console.log("This script will test the Dataset Creation MCP server by invoking several tools.");
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

  const test = tools[index];
  console.log(`Running test ${index + 1}: ${test.description}`);
  
  const request = {
    id: `test-${index + 1}`,
    type: "call_tool",
    params: {
      name: test.name,
      arguments: test.params
    }
  };

  // Send request to server
  serverProcess.stdin.write(JSON.stringify(request) + "\n");

  // Wait for response
  rl.once('line', (line) => {
    try {
      const response = JSON.parse(line);
      console.log(`Test ${index + 1} response:`, JSON.stringify(response, null, 2));
      console.log(`Test ${index + 1} ${response.error ? 'FAILED ❌' : 'PASSED ✓'}\n`);
    } catch (error) {
      console.error(`Test ${index + 1} failed to parse response:`, error);
    }
    
    // Run next test after a short delay
    setTimeout(() => runNextTest(index + 1), 1000);
  });
}

// Handle process termination
process.on('SIGINT', () => {
  console.log("\nTest runner terminated.");
  serverProcess.kill();
  process.exit(0);
});
