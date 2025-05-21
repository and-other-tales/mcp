#!/usr/bin/env node

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// Tool definitions to test
const tools = [
  {
    name: "analyze-bank-statement",
    params: {
      startDate: "2025-01-01",
      endDate: "2025-05-21",
      accountId: "test-account-id",
      categories: ["Income", "Expenses", "Transfers"]
    },
    description: "Test bank statement analysis"
  },
  {
    name: "generate-financial-report",
    params: {
      reportType: "profit-loss",
      fromDate: "2025-01-01",
      toDate: "2025-05-21",
      trackingCategories: ["Department", "Project"]
    },
    description: "Test financial report generation"
  },
  {
    name: "manage-payroll",
    params: {
      action: "create-payday",
      employeeId: "test-employee-id",
      payPeriod: {
        startDate: "2025-05-01",
        endDate: "2025-05-15"
      },
      details: {
        paymentDate: "2025-05-20"
      }
    },
    description: "Test payroll management"
  },
  {
    name: "manage-tax",
    params: {
      action: "calculate-vat",
      period: {
        startDate: "2025-04-01",
        endDate: "2025-06-30"
      },
      taxType: "VAT",
      details: {
        amount: 1000,
        taxRate: 20,
        reference: "VAT-Q2-2025"
      }
    },
    description: "Test tax management"
  }
];

console.log("Xero MCP Server Test Runner");
console.log("==========================");
console.log("This script will test the Xero MCP server by invoking several tools.");
console.log("Make sure to build the server first with 'npm run build'.\n");

// Start the MCP server process
const serverProcess = spawn('node', ['build/index.js'], {
  stdio: ['pipe', 'pipe', process.stderr],
  env: {
    ...process.env,
    XERO_CLIENT_ID: process.env.XERO_CLIENT_ID || 'test-client-id',
    XERO_CLIENT_SECRET: process.env.XERO_CLIENT_SECRET || 'test-client-secret'
  }
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
