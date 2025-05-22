declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export interface McpRequest {
    id: string;
    method: string;
    params: any;
  }

  export interface McpResponse {
    id: string;
    result?: any;
    error?: {
      code: number;
      message: string;
      data?: any;
    };
  }

  export class McpServer {
    constructor();
    handle(request: McpRequest): Promise<McpResponse>;
    setRequestHandler(method: string, handler: (params: any) => Promise<any>): void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
  
  export function runStdioServer(server: McpServer): Promise<void>;
}