/**
 * Xero MCP Server
 * A Model Context Protocol server that provides access to Xero's accounting, payroll,
 * and financial data APIs through natural language interactions.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { XeroClient } from 'xero-node';
import { BankTransaction, Contact, ManualJournal, TrackingCategory } from 'xero-node';

// Define custom interfaces
interface XeroConfig {
  clientId: string;
  clientSecret: string;
  grantType: string;
  redirectUris?: string[];
  scopes?: string[];
}

interface TrackingOption {
  name: string;
  status?: 'ACTIVE' | 'ARCHIVED';
}

interface JournalLine {
  description: string;
  accountCode: string;
  amount: number;
  isCredit: boolean;
  tracking?: {
    name: string;
    option: string;
  }[];
}

interface TransactionLineItem {
  description: string;
  quantity: number;
  unitAmount: number;
  accountCode: string;
  taxType?: string;
  tracking?: {
    name: string;
    option: string;
  }[];
}

interface Period {
  startDate: string;
  endDate: string;
}

interface TaxDetails {
  amount?: number;
  taxRate?: number;
  reference?: string;
}

interface Transaction {
  date: string;
  reference: string;
  amount: number;
  tax: number;
}

interface TaxSummary {
  [key: string]: {
    totalAmount: number;
    taxAmount: number;
    transactions: Transaction[];
  };
}

interface TaxReturnSubmission {
  period: Period;
  taxType: string;
  summary: TaxSummary;
  submittedAt: string;
  reference: string;
  journalReference: string;
  status: string;
}

interface TaxAccountCodes {
  VAT: string;
  GST: string;
  PAYG: string;
}

interface XeroTransaction {
  date: string;
  reference: string;
  total: number;
  taxAmount: number;
  taxType: string;
}

interface XeroTaxRate {
  taxRateID?: string;
  name: string;
  taxType: string;
  reportTaxType: string;
  status: string;
  totalTaxAmount: number;
  effectiveDate: string;
}

interface BankStatement {
  date: string;
  description: string;
  amount: number;
  balance: number;
  categories?: string[];
}

interface ContactGroup {
  groupID?: string;
  name: string;
  status: string;
  contacts?: Array<{ contactID: string }>;
}

interface PayrollDetails {
  employeeId: string;
  payPeriod: {
    startDate: string;
    endDate: string;
  };
  leaveHours?: number;
  payAmount?: number;
}

interface TrackingCategory {
  name: string;
  status: 'ACTIVE' | 'ARCHIVED';
  options?: Array<{
    name: string;
    status: 'ACTIVE' | 'ARCHIVED';
  }>;
}

// In-memory storage for tax returns (replace with database in production)
const taxReturnStorage: TaxReturnSubmission[] = [];

async function storeTaxReturn(submission: TaxReturnSubmission): Promise<void> {
  taxReturnStorage.push(submission);
}

async function getTaxReturnByReference(reference: string): Promise<TaxReturnSubmission | undefined> {
  return taxReturnStorage.find(sub => sub.reference === reference);
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
  "Analyze bank statement transactions",
  {
    startDate: z.string(),
    endDate: z.string(),
    accountId: z.string(),
    categories: z.array(z.string()).optional()
  },
  async ({ startDate, endDate, accountId, categories }: {
    startDate: string;
    endDate: string;
    accountId: string;
    categories?: string[];
  }) => {
    try {
      const tenant = xeroClient.tenants[0];
      const transactions = await xeroClient.accountingApi.getBankTransactions(
        tenant.tenantId,
        undefined,
        `AccountID=guid("${accountId}") && Date >= DateTime("${startDate}") && Date <= DateTime("${endDate}")`,
        "Date"
      );

      const categorizedTransactions = transactions.body.statements.map((transaction: BankStatement) => ({
        date: transaction.date,
        description: transaction.description,
        amount: transaction.amount,
        balance: transaction.balance,
        categories: transaction.categories || []
      }));

      return {
        content: [{
          type: "text",
          text: JSON.stringify(categorizedTransactions, null, 2)
        }]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return {
        content: [{
          type: "text",
          text: `Error analyzing bank statement: ${errorMessage}`
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
          if (!details?.amount || !details?.taxRate) {
            throw new Error("Amount and tax rate are required for VAT calculation");
          }
          result = await calculateTax(details.amount, details.taxRate);
          break;
          
        case "prepare-return":
          result = await prepareTaxReturn(period, taxType);
          break;
          
        case "submit-return":
          result = await submitTaxReturn(period, taxType, details || {});
          break;
          
        case "view-status":
          if (!details?.reference) {
            throw new Error("Reference is required to view tax return status");
          }
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
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      return {
        content: [{
          type: "text",
          text: `Error managing tax: ${errorMessage}`
        }],
        isError: true
      };
    }
  }
);

// Tool for Tracking Categories
server.tool(
  "manage-tracking-categories",
  "Manage tracking categories for expense and revenue tracking",
  {
    action: z.enum(["list", "create", "update", "delete"]),
    name: z.string().optional().describe("Name of the tracking category"),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
    categoryId: z.string().optional().describe("ID of the tracking category"),
    options: z.array(
      z.object({
        name: z.string(),
        status: z.enum(["ACTIVE", "ARCHIVED"]).optional()
      })
    ).optional().describe("Options to add to the tracking category")
  },
  async ({ action, name, status, categoryId, options }) => {
    try {
      let result;
      const tenantId = xeroClient.tenants[0].tenantId;

      switch(action) {
        case "list":
          result = await xeroClient.accountingApi.getTrackingCategories(tenantId);
          break;

        case "create":
          result = await xeroClient.accountingApi.createTrackingCategory(tenantId, {
            name,
            status: status || "ACTIVE",
            options: options?.map(opt => ({
              name: opt.name,
              status: opt.status || "ACTIVE"
            }))
          });
          break;

        case "update":
          result = await xeroClient.accountingApi.updateTrackingCategory(tenantId, categoryId, {
            name,
            status
          });
          break;

        case "delete":
          result = await xeroClient.accountingApi.deleteTrackingCategory(tenantId, categoryId);
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
          text: `Error managing tracking categories: ${error.message}`
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

async function prepareTaxReturn(period: Period, taxType: string): Promise<Omit<TaxReturnSubmission, 'submittedAt' | 'reference' | 'journalReference' | 'status'>> {
  const tenant = xeroClient.tenants[0];
  
  try {
    // Get all relevant transactions for the period
    const transactions = await xeroClient.accountingApi.getBankTransactions(
      tenant.tenantId,
      undefined,
      `Date >= DateTime(${period.startDate}) && Date <= DateTime(${period.endDate})`,
      "Date"
    );

    // Calculate tax totals with proper types
    const taxableTransactions = transactions.body.bankTransactions
      .filter((t: XeroTransaction) => t.taxType === taxType);

    const taxTotals = taxableTransactions.reduce<TaxSummary>((acc: TaxSummary, curr: XeroTransaction) => {
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    throw new Error(`Failed to prepare tax return: ${errorMessage}`);
  }
}

async function submitTaxReturn(period: Period, taxType: string, details: TaxDetails): Promise<TaxReturnSubmission> {
  const tenant = xeroClient.tenants[0];
  
  try {
    // Prepare return data
    const returnData = await prepareTaxReturn(period, taxType);
    
    // Create tax return line items from the calculated totals
    const lineItems = Object.entries(returnData.summary).map(([type, data]) => ({
      taxType: type,
      totalAmount: data.totalAmount,
      taxAmount: data.taxAmount
    }));

    // Create tax assessment/return using Xero Accounting API
    const taxReturn = await xeroClient.accountingApi.createTaxRates(tenant.tenantId, {
      taxRates: [{
        name: `${taxType} Return ${period.startDate} to ${period.endDate}`,
        taxType: taxType,
        reportTaxType: taxType,
        status: "ACTIVE",
        totalTaxAmount: lineItems.reduce((sum, item) => sum + item.taxAmount, 0),
        effectiveDate: period.startDate
      }]
    });

    // Create associated manual journal entry for the tax return
    const manualJournal = await xeroClient.accountingApi.createManualJournals(tenant.tenantId, {
      manualJournals: [{
        date: new Date().toISOString(),
        status: "POSTED",
        narration: `${taxType} Tax Return for period ${period.startDate} to ${period.endDate}`,
        journalLines: lineItems.map(item => ({
          lineAmount: item.taxAmount,
          accountCode: getTaxAccountCode(taxType),
          taxType: item.taxType,
          tracking: []
        }))
      }]
    });

    // Store submission details with proper references
    const submission: TaxReturnSubmission = {
      ...returnData,
      submittedAt: new Date().toISOString(),
      reference: taxReturn.body.taxRates[0].taxRateID,
      journalReference: manualJournal.body.manualJournals[0].manualJournalID,
      status: "Submitted"
    };

    // Store the submission details for status tracking
    await storeTaxReturn(submission);

    return submission;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to submit tax return: ${error.message}`);
    }
    throw new Error('Failed to submit tax return: An unknown error occurred');
  }
}

// Helper function to get the appropriate account code for tax entries
function getTaxAccountCode(taxType: string): string {
  const accountCodes: TaxAccountCodes = {
    "VAT": "420", // Example VAT liability account
    "GST": "425", // Example GST liability account
    "PAYG": "430", // Example PAYG withholding account
  };
  
  return accountCodes[taxType as keyof TaxAccountCodes] || "420"; // Default to VAT account if type not found
}

async function getTaxReturnStatus(period: Period, taxType: string, reference: string): Promise<any> {
  try {
    // First check our local storage
    const storedReturn = await getTaxReturnByReference(reference);
    if (!storedReturn) {
      throw new Error(`Tax return with reference ${reference} not found`);
    }

    const tenant = xeroClient.tenants[0];
    
    // Check the manual journal status
    const journal = await xeroClient.accountingApi.getManualJournal(
      tenant.tenantId,
      storedReturn.journalReference
    );

    // Check the tax rate status
    const taxRate = await xeroClient.accountingApi.getTaxRate(
      tenant.tenantId,
      storedReturn.reference
    );

    return {
      reference,
      period,
      taxType,
      status: journal.body.manualJournals[0].status,
      taxRateStatus: taxRate.body.taxRates[0].status,
      lastUpdated: new Date().toISOString()
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to get tax return status: ${error.message}`);
    }
    throw new Error('Failed to get tax return status: An unknown error occurred');
  }
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
async function main(): Promise<void> {
  try {
    const config: XeroConfig = {
      clientId: process.env.XERO_CLIENT_ID || '',
      clientSecret: process.env.XERO_CLIENT_SECRET || '',
      grantType: "client_credentials",
      scopes: ['accounting.transactions', 'payroll.employees', 'bankfeeds.read']
    };

    if (!config.clientId || !config.clientSecret) {
      throw new Error('Xero client credentials are required');
    }

    await initializeXeroClient(config);
    console.error("Xero MCP Server running on stdio");
  } catch (error) {
    console.error("Fatal error in main():", error instanceof Error ? error.message : 'Unknown error');
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
