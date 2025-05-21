/**
 * UK Legislation MCP Server - Test Script
 * 
 * This script tests the functionality of the UK Legislation MCP server
 * by simulating client requests to the various tools.
 */

// Add declaration for Node.js global object
declare const globalThis: any;

// Mock implementation of the MCP SDK for testing purposes
class MockMcpClient {
  private handlers: Map<string, (params: any) => Promise<any>> = new Map();
  
  registerHandler(name: string, handler: (params: any) => Promise<any>) {
    this.handlers.set(name, handler);
  }
  
  async callTool(name: string, params: any) {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Tool "${name}" not found`);
    }
    
    try {
      const result = await handler(params);
      return result;
    } catch (error) {
      console.error(`Error calling tool "${name}":`, error);
      throw error;
    }
  }
}

// Create a mock client
const mockClient = new MockMcpClient();

// Mock the McpServer class that our server uses
class MockServer {
  public name: string;
  private client: MockMcpClient;
  
  constructor(config: any, client: MockMcpClient) {
    this.name = config.name;
    this.client = client;
  }
  
  tool(name: string, description: string, parameters: any, handler: (params: any) => Promise<any>) {
    console.log(`Registering tool: ${name} - ${description}`);
    this.client.registerHandler(name, handler);
  }
  
  async connect(_transport: any): Promise<void> {
    console.log(`Server "${this.name}" connected`);
    return Promise.resolve();
  }
}

// Mock StdioServerTransport
class MockStdioTransport {
  constructor() {
    // Nothing needed for the mock
  }
}

// Define responses for the mock API
interface MockApiResponse {
  searchResults?: Array<{
    title: string;
    type: string;
    year: number;
    number: string;
  }>;
}

// Fixed mock for Zod with proper chains
const mockZ = {
  string: () => ({
    describe: (desc: string) => ({ description: desc }),
    optional: () => ({
      describe: (desc: string) => ({ description: desc, optional: true })
    })
  }),
  number: () => ({
    optional: () => ({
      default: (val: number) => ({
        describe: (desc: string) => ({ description: desc, default: val })
      }),
      describe: (desc: string) => ({ description: desc, optional: true })
    })
  }),
  enum: (values: any[]) => ({
    optional: () => ({
      default: (val: string) => ({
        describe: (desc: string) => ({ description: desc, default: val, enum: values })
      })
    })
  })
};

// Mock for axios with typed responses
const mockAxios = {
  get: async (url: string): Promise<{ data: string | MockApiResponse }> => {
    console.log(`Making API request to: ${url}`);
    
    // For testing, we'll simulate responses for a few specific URLs
    if (url.includes('search?title=Housing%20Act')) {
      return {
        data: {
          searchResults: [
            {
              title: "Housing Act 1988",
              type: "ukpga",
              year: 1988,
              number: "50"
            },
            {
              title: "Housing Act 1996",
              type: "ukpga",
              year: 1996,
              number: "52"
            }
          ]
        }
      };
    } else if (url.includes('search?text=eviction')) {
      return {
        data: {
          searchResults: [
            {
              title: "Protection from Eviction Act 1977",
              type: "ukpga",
              year: 1977,
              number: "43"
            }
          ]
        }
      };
    } else if (url.includes('ukpga/1988/50/data.xml')) {
      return {
        data: `<Legislation>
          <Title>Housing Act 1988</Title>
          <Section Number="21">
            <Title>Recovery of possession on termination of assured shorthold tenancy</Title>
            <Content>
              <Para>(1) A court shall make an order for possession of a dwelling-house let on an assured shorthold tenancy...</Para>
            </Content>
          </Section>
        </Legislation>`
      };
    } else {
      return {
        data: {
          searchResults: []
        }
      };
    }
  }
};

// Mock global process
const mockProcess = {
  exit: (code: number) => {
    console.log(`Process exiting with code: ${code}`);
  }
};

// Set up the global mocks using globalThis instead of global
globalThis.McpServer = MockServer;
globalThis.StdioServerTransport = MockStdioTransport;
globalThis.z = mockZ;
globalThis.axios = mockAxios;
globalThis.process = mockProcess;

// Load the server module but inject our mocks
// Note: In a real test environment, we'd use proper mocking libraries
async function runTests() {
  console.log("=== UK Legislation MCP Server - Test Script ===");
  console.log("Initializing mock environment...");
  
  // Create a new mock server instance
  const server = new MockServer({
    name: "uk-legislation-test",
    version: "1.0.0",
    capabilities: {
      resources: {},
      tools: {},
    }
  }, mockClient);
  
  // Import the server module to register all tools
  // Note: In a real environment, we'd properly import the module
  console.log("\nRegistering server tools...");
  
  // We'll define some of the key functions from our server:
  
  // Helper function to convert legislation types to human-readable format
  function getLegislationTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      "ukpga": "UK Public General Acts",
      "ukla": "UK Local Acts"
      // Other types abbreviated for the test
    };

    return typeMap[type] || type;
  }
  
  // Tool: Search UK legislation by title
  server.tool(
    "search-legislation",
    "Search UK legislation by title",
    {
      title: mockZ.string().describe("Title of the legislation to search for"),
      year: mockZ.number().optional().describe("Year of the legislation (optional)"),
      type: mockZ.string().optional().describe("Type of legislation (e.g., 'ukpga' for UK Public General Acts)"),
    },
    async ({ title, year, type }: { title: string; year?: number; type?: string }) => {
      let url = `https://www.legislation.gov.uk/search?title=${encodeURIComponent(title)}`;
      
      if (year) {
        url += `&year=${year}`;
      }
      
      if (type) {
        url += `&type=${type}`;
      }

      url += "&format=json";

      try {
        const response = await mockAxios.get(url);
        const data = response.data as MockApiResponse; // Cast to our interface
        
        if (!data.searchResults || data.searchResults.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No legislation found matching the title "${title}"`,
              },
            ],
          };
        }

        const results = data.searchResults.map((result) => {
          return {
            title: result.title,
            type: getLegislationTypeName(result.type),
            year: result.year,
            number: result.number,
            id: `${result.type}/${result.year}/${result.number}`,
          };
        });

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} legislation items matching "${title}":\n\n${
                results.map((r) => 
                  `Title: ${r.title}\nType: ${r.type}\nYear: ${r.year}\nNumber: ${r.number}\nID: ${r.id}`
                ).join("\n\n")
              }`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching for legislation: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
  
  // Tool: Search legislation by subject/keywords
  server.tool(
    "search-by-subject",
    "Search UK legislation by subject or keywords",
    {
      subject: mockZ.string().describe("Subject matter or keywords to search for"),
      limit: mockZ.number().optional().default(10).describe("Maximum number of results to return"),
    },
    async ({ subject, limit }: { subject: string; limit: number }) => {
      let url = `https://www.legislation.gov.uk/search?text=${encodeURIComponent(subject)}&format=json`;
      
      try {
        const response = await mockAxios.get(url);
        const data = response.data as MockApiResponse; // Cast to our interface
        
        if (!data.searchResults || data.searchResults.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No legislation found related to the subject "${subject}"`,
              },
            ],
          };
        }

        const results = data.searchResults
          .slice(0, limit)
          .map((result) => {
            return {
              title: result.title,
              type: getLegislationTypeName(result.type),
              year: result.year,
              number: result.number,
              id: `${result.type}/${result.year}/${result.number}`,
              relevance: "Direct match to your search terms"
            };
          });

        return {
          content: [
            {
              type: "text",
              text: `Found ${results.length} legislation items related to "${subject}":\n\n${
                results.map((r) => 
                  `Title: ${r.title}\nType: ${r.type}\nYear: ${r.year}\nNumber: ${r.number}\nID: ${r.id}\nRelevance: ${r.relevance}`
                ).join("\n\n")
              }`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error searching for legislation by subject: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
  
  // Connect the server
  await server.connect(new MockStdioTransport());
  
  // Run tests
  console.log("\n=== Running Tests ===");
  
  // Test 1: Search for legislation by title
  console.log("\nTest 1: Search for legislation by title");
  try {
    const result = await mockClient.callTool("search-legislation", { title: "Housing Act" });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test 1 failed:", error);
  }
  
  // Test 2: Search for legislation by subject
  console.log("\nTest 2: Search for legislation by subject");
  try {
    const result = await mockClient.callTool("search-by-subject", { subject: "eviction" });
    console.log("Result:", JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Test 2 failed:", error);
  }
  
  console.log("\n=== Tests Complete ===");
}

// Run the tests
runTests().catch(error => {
  console.error("Test execution failed:", error);
}); 