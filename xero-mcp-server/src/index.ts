/**
 * Xero MCP Server
 * A Model Context Protocol server that provides access to Xero's accounting, payroll,
 * and financial data APIs through natural language interactions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { XeroClient } from 'xero-node';

// Define custom types
interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUris?: string[];
  grantType?: string;
  scopes?: string[];
}

// Xero client instance
let xeroClient: XeroClient;

// Create server instance 
const server = new McpServer({
  name: "xero-mcp",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Tools for Bank Statement Analysis
server.tool(
  "analyze-bank-statement",
  "Analyze bank statements and categorize transactions",
  {
    startDate: z.string().describe("Start date for transaction analysis (YYYY-MM-DD)"),
    endDate: z.string().describe("End date for transaction analysis (YYYY-MM-DD)"),
    accountId: z.string().describe("Bank account ID to analyze"),
    categories: z.array(z.string()).optional().describe("Custom categories to use for classification")
  },
  async ({ startDate, endDate, accountId, categories }) => {
    try {
      const transactions = await xeroClient.bankFeedsApi.getStatements(accountId, undefined, 100);
      
      // Analyze and categorize transactions
      const categorizedTransactions = transactions.body.statements.map(transaction => {
        return {
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category: determineCategory(transaction, categories)  
        };
      });

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            totalTransactions: transactions.length,
            categorizedData: categorizedTransactions,
            summary: generateTransactionSummary(categorizedTransactions)
          }, null, 2)
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: "text", 
          text: `Error analyzing bank statement: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Tool for Contact Group Management
server.tool(
  "manage-contact-groups",
  "Manage contact groups including creation, updates, and listing",
  {
    action: z.enum(["list", "create", "update", "delete"]),
    groupName: z.string().optional().describe("Name of the contact group"),
    groupId: z.string().optional().describe("ID of the contact group"),
    contacts: z.array(z.string()).optional().describe("Contact IDs to add/remove from group"),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
  },
  async ({ action, groupName, groupId, contacts, status }) => {
    try {
      let result;
      const tenantId = xeroClient.tenants[0].tenantId;

      switch(action) {
        case "list":
          result = await xeroClient.accountingApi.getContactGroups(tenantId);
          break;

        case "create":
          result = await xeroClient.accountingApi.createContactGroup(tenantId, {
            name: groupName,
            status: status || "ACTIVE",
            contacts: contacts?.map(id => ({ contactID: id }))
          });
          break;

        case "update":
          result = await xeroClient.accountingApi.updateContactGroup(tenantId, groupId, {
            name: groupName,
            status,
            contacts: contacts?.map(id => ({ contactID: id }))
          });
          break;

        case "delete":
          result = await xeroClient.accountingApi.deleteContactGroup(tenantId, groupId);
          break;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result?.body || { status: "success" }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error managing contact groups: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Tool for Financial Reports 
server.tool(
  "generate-financial-report",
  "Generate financial reports and analysis",
  {
    reportType: z.enum(["profit-loss", "balance-sheet", "cash-flow"]).describe("Type of financial report to generate"),
    fromDate: z.string().describe("Start date for report (YYYY-MM-DD)"),
    toDate: z.string().describe("End date for report (YYYY-MM-DD)"),
    trackingCategories: z.array(z.string()).optional().describe("Tracking categories to include")
  },
  async ({ reportType, fromDate, toDate, trackingCategories }) => {
    try {
      let reportData;
      
      switch(reportType) {
        case "profit-loss":
          const plReport = await xeroClient.accountingApi.getReportProfitAndLoss(
            xeroClient.tenants[0].tenantId,
            fromDate,
            toDate,
            trackingCategories?.join(",")
          );
          reportData = plReport.body;
          break;
          
        case "balance-sheet":
          const bsReport = await xeroClient.accountingApi.getReportBalanceSheet(
            xeroClient.tenants[0].tenantId,
            fromDate,
            toDate
          );
          reportData = bsReport.body;
          break;
          
        case "cash-flow":
          const cfReport = await xeroClient.financeApi.getCashflow(
            xeroClient.tenants[0].tenantId,
            fromDate,
            toDate
          );
          reportData = cfReport.body;
          break;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            reportType,  
            period: { fromDate, toDate },
            data: reportData
          }, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error generating ${reportType} report: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Tool for Payroll Management
server.tool(
  "manage-payroll", 
  "Manage employee payroll and payments",
  {
    action: z.enum(["create-payday", "process-timesheets", "update-leave", "view-payslips"]),
    employeeId: z.string().describe("Employee ID"),
    payPeriod: z.object({
      startDate: z.string(),
      endDate: z.string()
    }).optional(),
    details: z.object({
      hoursWorked: z.number().optional(),
      leaveHours: z.number().optional(),
      leaveType: z.string().optional(),
      paymentDate: z.string().optional()
    }).optional()
  },
  async ({ action, employeeId, payPeriod, details }) => {
    try {
      let result;
      
      switch(action) {
        case "create-payday":
          result = await xeroClient.payrollAUApi.createPayRun(
            xeroClient.tenants[0].tenantId,
            {
              payRun: {
                payrollCalendarID: employeeId,
                periodStartDate: payPeriod.startDate,
                periodEndDate: payPeriod.endDate,
                paymentDate: details.paymentDate
              }
            }
          );
          break;

        case "process-timesheets":
          result = await xeroClient.payrollAUApi.createTimesheet(
            xeroClient.tenants[0].tenantId,
            {
              employeeID: employeeId,
              startDate: payPeriod.startDate,
              endDate: payPeriod.endDate,
              numberOfUnits: details.hoursWorked
            }
          );
          break;

        case "update-leave":
          result = await xeroClient.payrollAUApi.createLeaveApplication(
            xeroClient.tenants[0].tenantId,
            {
              leaveTypeID: details.leaveType,
              employeeID: employeeId,
              startDate: payPeriod.startDate,
              endDate: payPeriod.endDate,
              periods: [{
                periodStartDate: payPeriod.startDate,
                periodEndDate: payPeriod.endDate,
                numberOfUnits: details.leaveHours
              }]
            }
          );
          break;

        case "view-payslips":
          result = await xeroClient.payrollAUApi.getPayslip(
            xeroClient.tenants[0].tenantId,
            employeeId
          );
          break;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result.body, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error managing payroll: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Tool for Tax Management
server.tool(
  "manage-tax",
  "Manage tax calculations and returns",
  {
    action: z.enum(["calculate-vat", "prepare-return", "submit-return", "view-status"]),
    period: z.object({
      startDate: z.string(),
      endDate: z.string()
    }),
    taxType: z.enum(["VAT", "GST", "PAYG"]),
    details: z.object({
      amount: z.number().optional(),
      taxRate: z.number().optional(),
      reference: z.string().optional()
    }).optional()
  },
  async ({ action, period, taxType, details }) => {
    try {
      let result;
      
      switch(action) {
        case "calculate-vat":
          result = await calculateTax(details.amount, details.taxRate);
          break;
          
        case "prepare-return":
          result = await prepareTaxReturn(period, taxType);
          break;
          
        case "submit-return":
          result = await submitTaxReturn(period, taxType, details);
          break;
          
        case "view-status":
          result = await getTaxReturnStatus(period, taxType, details.reference);
          break;
      }

      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2)
        }]
      };

    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Error managing tax: ${error.message}`
        }],
        isError: true
      };
    }
  }
);

// Helper Functions
function determineCategory(transaction: any, customCategories?: string[]) {
  // Implement transaction categorization logic
  // Could use ML/AI here for better categorization
  const description = transaction.description.toLowerCase();
  
  if (customCategories) {
    // Use custom categories if provided
    return customCategories.find(cat => description.includes(cat.toLowerCase())) || "Uncategorized";
  }

  // Default categories
  if (description.includes("salary") || description.includes("payroll")) return "Income";
  if (description.includes("rent") || description.includes("lease")) return "Rent";
  if (description.includes("aws") || description.includes("azure")) return "Cloud Services";
  // Add more categories as needed
  
  return "Uncategorized";
}

function generateTransactionSummary(transactions: any[]) {
  // Group transactions by category and calculate totals
  const summary = transactions.reduce((acc, curr) => {
    const category = curr.category;
    if (!acc[category]) {
      acc[category] = {
        count: 0,
        total: 0
      };
    }
    acc[category].count++;
    acc[category].total += curr.amount;
    return acc;
  }, {});

  return summary;
}

async function calculateTax(amount: number, rate: number) {
  const taxAmount = amount * (rate / 100);
  return {
    originalAmount: amount,
    taxRate: rate,
    taxAmount: taxAmount,
    totalAmount: amount + taxAmount
  };
}

async function prepareTaxReturn(period: any, taxType: string) {
  const tenant = xeroClient.tenants[0];
  
  // Get all relevant transactions for the period
  const transactions = await xeroClient.accountingApi.getBankTransactions(
    tenant.tenantId,
    undefined,
    `Date >= DateTime(${period.startDate}) && Date <= DateTime(${period.endDate})`,
    "Date"
  );

  // Calculate tax totals
  const taxableTransactions = transactions.body.bankTransactions.filter(t => t.taxType);
  const taxTotals = taxableTransactions.reduce((acc, curr) => {
    if (!acc[curr.taxType]) {
      acc[curr.taxType] = {
        totalAmount: 0,
        taxAmount: 0,
        transactions: []
      };
    }
    acc[curr.taxType].totalAmount += curr.total;
    acc[curr.taxType].taxAmount += curr.taxAmount;
    acc[curr.taxType].transactions.push({
      date: curr.date,
      reference: curr.reference,
      amount: curr.total,
      tax: curr.taxAmount
    });
    return acc;
  }, {});

  return {
    period,
    taxType,
    summary: taxTotals
  };
}

async function submitTaxReturn(period: any, taxType: string, details: any) {
  // Prepare return data
  const returnData = await prepareTaxReturn(period, taxType);
  
  // Store submission details
  const submission = {
    ...returnData,
    submittedAt: new Date().toISOString(),
    reference: details.reference,
    status: "Submitted"
  };

  // In a real implementation, this would integrate with the relevant tax authority's API
  return submission;
}

async function getTaxReturnStatus(period: any, taxType: string, reference: string) {
  // In a real implementation, this would check the status with the tax authority
  return {
    reference,
    period,
    taxType,
    status: "Processed", // This would be dynamic in real implementation
    lastUpdated: new Date().toISOString()
  };
}

// Initialize Xero client with OAuth2 credentials
async function initializeXeroClient(config: XeroConfig) {
  xeroClient = new XeroClient({
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    grantType: config.grantType || 'client_credentials',
    redirectUris: config.redirectUris,
    scopes: config.scopes || ['accounting.transactions', 'payroll.employees', 'bankfeeds.read']
  });

  await xeroClient.initialize();
  
  // For client credentials flow
  if (config.grantType === 'client_credentials') {
    await xeroClient.getClientCredentialsToken();
  }

  return xeroClient;
}

// Main function to run the server
async function main() {
  try {
    const config = {
      clientId: process.env.XERO_CLIENT_ID,
      clientSecret: process.env.XERO_CLIENT_SECRET,
      grantType: 'client_credentials'
    };

    await initializeXeroClient(config);
    
    const transport = new StdioServerTransport();
    await server.connect(transport);
    
    console.error("Xero MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error);
    process.exit(1);
  }
}

// Handle process termination
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  process.exit(0);
});

process.stdin.on("close", () => {
  console.error("Xero MCP Server closed");
  server.close();
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
