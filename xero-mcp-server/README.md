# Xero MCP Server

A Model Context Protocol (MCP) server that provides natural language interaction with Xero's accounting, payroll, and financial data APIs.

## Features

- Bank statement analysis and transaction categorization
- Financial report generation (Profit & Loss, Balance Sheet, Cash Flow)
- Payroll management 
- Tax calculations and return management
- Integration with all major Xero APIs:
  - Accounting API
  - Payroll API (AU, NZ, UK)
  - Bank Feeds API
  - Files API
  - Projects API
  - Finance API

## Prerequisites

- Node.js 18+
- Xero account with API access
- OAuth2 client credentials
- Required Xero API scopes:
  - accounting.transactions
  - payroll.employees
  - bankfeeds.read
  - finance.read
  - projects.read

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/mcp.git
cd mcp/xero-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Environment Variables

Create a `.env` file with:

```env
XERO_CLIENT_ID=your_client_id
XERO_CLIENT_SECRET=your_client_secret
```

## Available Tools

1. analyze-bank-statement
   - Analyze and categorize bank transactions
   - Parameters:
     - startDate: Start date for analysis (YYYY-MM-DD)
     - endDate: End date for analysis (YYYY-MM-DD)
     - accountId: Bank account ID
     - categories: Optional custom categories

2. generate-financial-report
   - Generate financial reports
   - Parameters:
     - reportType: "profit-loss" | "balance-sheet" | "cash-flow"
     - fromDate: Start date (YYYY-MM-DD)
     - toDate: End date (YYYY-MM-DD)
     - trackingCategories: Optional tracking categories

3. manage-payroll
   - Manage employee payroll
   - Parameters:
     - action: "create-payday" | "process-timesheets" | "update-leave" | "view-payslips"
     - employeeId: Employee identifier
     - payPeriod: { startDate, endDate }
     - details: Additional action-specific details

4. manage-tax
   - Handle tax calculations and returns
   - Parameters:
     - action: "calculate-vat" | "prepare-return" | "submit-return" | "view-status"
     - period: { startDate, endDate }
     - taxType: "VAT" | "GST" | "PAYG"
     - details: Tax-specific details

## Usage Examples

1. Analyzing bank statements:
```json
{
  "name": "analyze-bank-statement",
  "arguments": {
    "startDate": "2025-01-01",
    "endDate": "2025-05-21",
    "accountId": "your-account-id",
    "categories": ["Income", "Rent", "Utilities", "Marketing"]
  }
}
```

2. Generating a financial report:
```json
{
  "name": "generate-financial-report",
  "arguments": {
    "reportType": "profit-loss",
    "fromDate": "2025-01-01",
    "toDate": "2025-05-21",
    "trackingCategories": ["Department", "Project"]
  }
}
```

3. Managing payroll:
```json
{
  "name": "manage-payroll",
  "arguments": {
    "action": "create-payday",
    "employeeId": "emp-123",
    "payPeriod": {
      "startDate": "2025-05-01",
      "endDate": "2025-05-15"
    },
    "details": {
      "paymentDate": "2025-05-20"
    }
  }
}
```

4. Managing tax:
```json
{
  "name": "manage-tax",
  "arguments": {
    "action": "calculate-vat",
    "period": {
      "startDate": "2025-04-01",
      "endDate": "2025-06-30"
    },
    "taxType": "VAT",
    "details": {
      "amount": 1000,
      "taxRate": 20
    }
  }
}
```

## Testing

Run the tests using:
```bash
node test-runner.js
```

This will execute a series of tests for each tool.

## Error Handling

The server implements comprehensive error handling:
- API errors are caught and returned with descriptive messages
- Invalid parameters are validated before processing
- Network issues are handled gracefully
- Rate limiting is respected

## Security

- Uses OAuth 2.0 client credentials flow
- Implements Xero's security best practices
- Sensitive data is not logged
- Environment variables for credentials
- Input validation on all parameters

## Notes

- This server requires a Xero account with API access
- Some features may require specific Xero subscription levels
- Rate limits apply as per Xero's API guidelines
- Tax calculations should be verified with an accountant
- Keep your client credentials secure

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
