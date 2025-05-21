# HMRC MCP Server

A Model Context Protocol (MCP) server that provides access to UK tax documentation from hmrc.gov.uk.

## Features

- Search HMRC tax guidance documents
- Search for specific tax forms and returns
- Get detailed tax guidance documents
- Search within guidance documents for specific information
- Browse tax guidance by topic
- Get current tax rates and thresholds
- Analyze financial scenarios for tax implications
- Calculate VAT for given amounts
- Access tax deadlines and important dates
- Analyze tax issues with sequential thinking approach

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/hmrc-mcp-server.git
cd hmrc-mcp-server
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Usage

### Running the server

```bash
npm start
```

This will start the MCP server using stdio transport, which can be connected to by MCP clients.

### Setting up with Claude Opus

To use this server with Claude Opus:

1. Install the MCP server globally:
```bash
npm install -g ./
```

2. Register the server with the MCP client:
```bash
hmrc-mcp
```

3. In your conversation with Claude Opus, you can now use the HMRC tax documentation tools.

### Available Tools

The server provides the following tools:

1. `search-guidance`: Search for tax guidance by title or keywords
   - Parameters: `title` (required), `limit` (optional, default: 10)

2. `search-tax-forms`: Search for HMRC tax forms and returns
   - Parameters: `query` (required), `limit` (optional, default: 10)

3. `get-guidance`: Get specific tax guidance by its ID/path
   - Parameters: `id` (required)

4. `search-within-guidance`: Search for specific keywords within a tax guidance document
   - Parameters: `id` (required), `keywords` (required)

5. `search-by-tax-topic`: Search for guidance related to specific tax topics
   - Parameters: `topic` (required), `limit` (optional, default: 10)
   - Available topics: income-tax, corporation-tax, capital-gains, inheritance-tax, vat, property-tax, pensions, international

6. `get-tax-rates`: Get current UK tax rates and thresholds
   - Parameters: `taxType` (required), `taxYear` (optional)

7. `analyze-tax-scenario`: Analyze a financial scenario to determine tax implications
   - Parameters: `scenario` (required), `taxYear` (optional)

8. `vat-calculator`: Calculate VAT for a given amount
   - Parameters: `amount` (required), `vatRate` (optional, default: 20), `includesVat` (optional, default: false)

9. `get-tax-deadlines`: Get important UK tax deadlines and dates
   - Parameters: `taxYear` (optional), `taxType` (optional)

10. `analyze-tax-issue-sequentially`: Analyze a tax issue step-by-step using reflective thinking
    - Parameters: `thought` (required), `thoughtNumber` (required), `totalThoughts` (required), `nextThoughtNeeded` (required), `isRevision` (optional), `revisesThought` (optional)

### Examples

```
Tool: search-guidance
Parameters: 
  - title: "Capital Gains Tax"
  - limit: 5

Tool: search-tax-forms
Parameters:
  - query: "Self Assessment"

Tool: get-guidance
Parameters:
  - id: "guidance/self-assessment-tax-returns"

Tool: search-within-guidance
Parameters:
  - id: "guidance/self-assessment-tax-returns"
  - keywords: "deadline,penalty"

Tool: search-by-tax-topic
Parameters:
  - topic: "inheritance-tax"

Tool: get-tax-rates
Parameters:
  - taxType: "income-tax"
  - taxYear: "2023-24"

Tool: analyze-tax-scenario
Parameters:
  - scenario: "I sold a rental property for £250,000 which I originally purchased for £180,000 five years ago"
  - taxYear: "2023-24"

Tool: vat-calculator
Parameters:
  - amount: 1000
  - vatRate: 20
  - includesVat: false

Tool: get-tax-deadlines
Parameters:
  - taxYear: "2023-24"
  - taxType: "self-assessment"

Tool: analyze-tax-issue-sequentially
Parameters:
  - thought: "A UK taxpayer with £65,000 annual income would be in the higher rate tax band for 2023/24, paying 40% on income above £50,271."
  - thoughtNumber: 1
  - totalThoughts: 5
  - nextThoughtNeeded: true
```

## Use Cases for Tax Scenario Analysis

The `analyze-tax-scenario` tool can handle complex tax queries such as:

1. **Property Transactions**:
   - "I sold my second home and made a profit of £50,000"
   - "I'm planning to rent out my property for £1,200 per month"

2. **Business Tax Issues**:
   - "My small business made £75,000 profit last year"
   - "I want to claim capital allowances on £10,000 of equipment purchases"

3. **Individual Tax Planning**:
   - "I earn £60,000 per year and want to maximize my pension contributions"
   - "I received an inheritance of £400,000 from my parent"

4. **VAT Questions**:
   - "My business turnover has reached £80,000 this year"
   - "I want to claim back VAT on a company vehicle purchase"

## Notes

- This server uses the publicly available API from gov.uk and hmrc.gov.uk but is not affiliated with or endorsed by HMRC or the UK Government.
- The information provided through this server is for informational purposes only and does not constitute professional tax advice.
- Tax rates and regulations change frequently. Always verify information with official HMRC sources. 