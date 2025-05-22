# Model Context Protocol (MCP) Servers

A collection of complementary MCP servers that provide access to UK legislation, tax documentation, dataset creation capabilities, and story analysis tools.

## Overview

This repository contains four MCP servers:

1. **UK Legislation MCP Server**
   - Access and analyze UK legislation
   - Search by title, subject, or legal topic
   - Retrieve specific legislation sections and changes
   - Analyze legal scenarios
   - Sequential legal thinking tools

2. **HMRC MCP Server**
   - Access UK tax documentation and guidance
   - Search tax forms and returns
   - Get current tax rates and thresholds
   - Calculate VAT
   - Tax scenario analysis tools

3. **Dataset Creation MCP Server**
   - Create datasets from UK legislation
   - Create datasets from HMRC documentation
   - Web scraping and content processing
   - Upload to HuggingFace Hub
   - HTML to Markdown conversion

4. **Storybook MCP Server**
   - Analyze story manuscripts and narratives
   - Emotional content analysis
   - Character and dialogue analysis
   - Scene breakdown and analysis
   - Sequential story thinking tools
   - Reader engagement analysis
   - Repetition detection
   - Writing style suggestions

## Architecture

The servers are designed to work independently or together, each running in its own container:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  UK Legislation │    │      HMRC       │    │Dataset Creation │    │   Storybook    │
│  MCP Server     │    │   MCP Server    │    │   MCP Server    │    │   MCP Server   │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Port: 8080      │    │ Port: 8081      │    │ Port: 8082      │    │ Port: 8083      │
└─────────────────┘    └─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Prerequisites

- Node.js 18+
- Docker
- Google Cloud SDK (for deployment)

## Environment Variables

Create a `.env` file in the root directory with:

```env
HF_TOKEN=your_huggingface_token
GOOGLE_PROJECT_ID=your_project_id
```

## Local Development

1. Install dependencies for all servers:
```powershell
Get-ChildItem -Directory -Filter "*-mcp-server" | ForEach-Object {
    Set-Location $_.FullName
    npm install
    npm run build
    Set-Location ..
}
```

2. Run tests:
```powershell
Get-ChildItem -Directory -Filter "*-mcp-server" | ForEach-Object {
    Set-Location $_.FullName
    node test-runner.js
    Set-Location ..
}
```

## Docker Local Build

Build and run all servers locally:

```powershell
docker compose up --build
```

## Deployment to Google Cloud Run

1. Configure Google Cloud SDK:
```powershell
gcloud auth login
gcloud config set project $env:GOOGLE_PROJECT_ID
```

2. Deploy using Cloud Build:
```powershell
gcloud builds submit
```

## Testing

Each server has its own test runner. To run all tests:

```powershell
./run-all-tests.ps1
```

## Documentation

Individual server documentation:
- [UK Legislation MCP Server](./uk-legislation-mcp-server/README.md)
- [HMRC MCP Server](./hmrc-mcp-server/README.md)
- [Dataset Creation MCP Server](./dataset-creation-mcp-server/README.md)

## Container Resources

Each container is configured with:
- Memory: 512Mi
- CPU: 1 core
- Concurrent requests: 80

## Health Checks

Each server implements a health check endpoint at `/health` that returns:
```json
{
  "status": "ok",
  "version": "1.0.0",
  "timestamp": "2025-05-21T12:00:00Z"
}
```

## License

This project is licensed under the terms of the LICENSE file included in this repository.

## Contributing

See individual server documentation for specific contribution guidelines.
