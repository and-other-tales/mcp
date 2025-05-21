# UK Legislation MCP Server

A Model Context Protocol (MCP) server that provides access to UK legislation from legislation.gov.uk.

## Features

- Search UK legislation by title, year, and type
- Get specific legislation by ID
- Search within legislation for specific keywords
- Get specific sections of legislation
- View table of contents for legislation
- Get information about changes to legislation over time
- Search legislation by subject matter
- Find related legislation based on a given legislation ID
- Browse legislation by legal topic 
- Analyze legal scenarios to find applicable legislation
- Analyze legal issues using sequential thinking approach

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/uk-legislation-mcp-server.git
cd uk-legislation-mcp-server
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
uk-legislation-mcp
```

3. In your conversation with Claude Opus, you can now use the UK legislation tools.

### Available Tools

The server provides the following tools:

1. `search-legislation`: Search for legislation by title
   - Parameters: `title` (required), `year` (optional), `type` (optional)

2. `search-by-subject`: Search for legislation by subject matter
   - Parameters: `subject` (required), `limit` (optional, default: 10)

3. `get-legislation`: Get specific legislation by ID
   - Parameters: `id` (required), `version` (optional), `format` (optional)

4. `search-sections`: Search within legislation for specific keywords
   - Parameters: `id` (required), `keywords` (required), `version` (optional)

5. `get-section`: Get a specific section from legislation
   - Parameters: `id` (required), `section` (required), `version` (optional)

6. `get-table-of-contents`: Get the table of contents for legislation
   - Parameters: `id` (required), `version` (optional)

7. `get-legislation-changes`: Get information about how legislation has changed over time
   - Parameters: `id` (required)

8. `find-related-legislation`: Find legislation that is related to a specific legislation
   - Parameters: `id` (required), `limit` (optional, default: 5)

9. `find-by-legal-topic`: Find legislation related to specific legal topics
   - Parameters: `topic` (required), `limit` (optional, default: 10)
   - Available topics: housing, employment, family, immigration, consumer, benefits, criminal, tax

10. `analyze-legal-scenario`: Analyze a legal scenario to find applicable legislation
    - Parameters: `scenario` (required), `detail` (optional)

11. `analyze-legal-issue-sequentially`: Analyze a legal issue step-by-step using reflective thinking
    - Parameters: `thought` (required), `thoughtNumber` (required), `totalThoughts` (required), `nextThoughtNeeded` (required), `isRevision` (optional), `revisesThought` (optional)

### Examples

```
Tool: search-legislation
Parameters: 
  - title: "Transport Act"
  - year: 1985

Tool: search-by-subject
Parameters:
  - subject: "landlord tenant eviction"

Tool: get-legislation
Parameters:
  - id: "ukpga/1985/67"

Tool: search-sections
Parameters:
  - id: "ukpga/1985/67"
  - keywords: "passenger transport"

Tool: get-section
Parameters:
  - id: "ukpga/1985/67"
  - section: "1"

Tool: get-table-of-contents
Parameters:
  - id: "ukpga/1985/67"

Tool: get-legislation-changes
Parameters:
  - id: "ukpga/1985/67"

Tool: find-related-legislation
Parameters:
  - id: "ukpga/1988/50"

Tool: find-by-legal-topic
Parameters:
  - topic: "housing"

Tool: analyze-legal-scenario
Parameters:
  - scenario: "My landlord has issued a Section 21 eviction notice with only 1 month's notice"
  - detail: "I've been living in the property for 3 years with an assured shorthold tenancy agreement"

Tool: analyze-legal-issue-sequentially
Parameters:
  - thought: "The Housing Act 2004 c.34 introduced the Housing Health and Safety Rating System (HHSRS) which is relevant to this disrepair case."
  - thoughtNumber: 1
  - totalThoughts: 5
  - nextThoughtNeeded: true
```

## Use Cases for Legal Scenario Analysis

The `analyze-legal-scenario` tool can handle complex legal queries such as:

1. **Landlord-tenant disputes**:
   - "My landlord has issued an eviction order under section 21"
   - "My landlord hasn't protected my deposit and is now trying to evict me"

2. **Employment issues**:
   - "I was dismissed without proper notice after working for the company for 5 years"
   - "My employer is refusing to pay my statutory sick pay"

3. **Consumer problems**:
   - "I purchased a faulty product and the retailer refuses to refund me"
   - "My flight was canceled but the airline won't compensate me"

4. **Immigration questions**:
   - "My visa is expiring and I need to know what options are available"
   - "I want to apply for settled status in the UK"

## Use Cases for Sequential Legal Analysis

The `analyze-legal-issue-sequentially` tool is ideal for:

1. **Complex legal reasoning**:
   - Breaking down multi-faceted legal arguments
   - Exploring different interpretations of legislation
   - Analyzing competing legal precedents

2. **Case preparation**:
   - Building a structured legal argument step-by-step
   - Identifying potential counterarguments
   - Revising reasoning as new facts arise

3. **Legislation interpretation**:
   - Analyzing how different acts and sections interact
   - Tracing the evolution of legal thinking on an issue
   - Identifying gaps or conflicts in legal frameworks

4. **Legal education**:
   - Demonstrating structured legal thinking to students
   - Showing how legal conclusions are reached methodically
   - Highlighting when revision of initial assumptions is needed

## Notes

- This server uses the publicly available API from legislation.gov.uk but is not affiliated with or endorsed by the UK Government.
- The API responses are parsed using basic regex techniques for demonstration purposes. A production version would use proper XML parsing libraries.
- When retrieving large legislation documents, the content may be truncated to avoid exceeding response size limits.
- The legal scenario analysis provides relevant legislation but does not constitute legal advice.
- The sequential thinking tools maintain state within the server process and will reset if the server restarts.