#!/usr/bin/env node
// Define types for modules that can't be found at compile time
// These will be resolved at runtime when the modules are available
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// @ts-ignore
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @ts-ignore
import { z } from "zod";
// @ts-ignore
import axios, { AxiosError } from "axios";

// Define custom types
interface TaxGuidanceResult {
  title: string;
  type: string;
  id: string;
  url: string;
  relevance?: string;
  lastUpdated?: string;
}

interface TaxManualSection {
  title: string;
  id: string;
  content?: string;
}

interface TaxFormResult {
  formNumber: string;
  title: string;
  description: string;
  url: string;
  lastUpdated?: string;
}

// Simple in-memory cache system for responses
interface CacheEntry {
  data: any;
  timestamp: number;
}

const responseCache: Record<string, CacheEntry> = {};
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Helper function to get/set cached data
function getCachedResponse(key: string): any | null {
  const entry = responseCache[key];
  if (!entry) return null;
  
  const now = Date.now();
  if (now - entry.timestamp > CACHE_TTL) {
    // Cache expired
    delete responseCache[key];
    return null;
  }
  
  return entry.data;
}

function setCachedResponse(key: string, data: any): void {
  responseCache[key] = {
    data,
    timestamp: Date.now()
  };
}

// For Node.js process
declare const process: {
  exit(code: number): never;
};

const API_BASE_URL = "https://www.gov.uk/api/content";
const HMRC_BASE_URL = "https://www.gov.uk";
const USER_AGENT = "HMRC-MCP-Server/1.0.0";

// Tax topics mapping
const TAX_TOPICS: Record<string, string[]> = {
  "income-tax": ["income tax", "paye", "self assessment", "personal allowance", "tax code", "tax return"],
  "corporation-tax": ["corporation tax", "company tax", "business tax", "profit tax", "capital allowances"],
  "capital-gains": ["capital gains", "asset disposal", "chargeable gains", "entrepreneurs relief"],
  "inheritance-tax": ["inheritance tax", "estate tax", "gift tax", "death duty", "probate"],
  "vat": ["vat", "value added tax", "input tax", "output tax", "vat registration", "vat return"],
  "property-tax": ["stamp duty", "sdlt", "land tax", "property tax", "annual tax on enveloped dwellings", "ated"],
  "pensions": ["pension tax", "pension relief", "lifetime allowance", "annual allowance", "tax-free lump sum"],
  "international": ["non-resident", "double taxation", "foreign income", "offshore", "tax treaty", "international tax"]
};

// Create server instance
const server = new McpServer({
  name: "hmrc-tax",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function to make API requests with caching
async function makeApiRequest<T>(url: string, useCache: boolean = true): Promise<T> {
  try {
    // Check cache first if caching is enabled
    if (useCache) {
      const cachedData = getCachedResponse(url);
      if (cachedData) {
        console.log(`Cache hit for URL: ${url}`);
        return cachedData as T;
      }
    }
    
    console.log(`Making API request to: ${url}`);
    const response = await axios.get(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
      timeout: 10000, // 10 second timeout
    });
    
    // Cache the response if caching is enabled
    if (useCache) {
      setCachedResponse(url, response.data);
    }
    
    return response.data as T;
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      // Using type assertion since the type guard doesn't seem to be working
      const axiosError = error as AxiosError;
      
      if (axiosError.code === 'ECONNABORTED') {
        console.error(`Request timeout for URL: ${url}`);
        throw new Error(`Request timed out. The HMRC API is not responding in a timely manner.`);
      } else if (axiosError.response) {
        const status = axiosError.response.status;
        const statusText = axiosError.response.statusText;
        console.error(`API error: ${status} - ${statusText}`);
        throw new Error(`HMRC API returned error ${status}: ${statusText}`);
      }
    }
    console.error("Error making API request:", error);
    throw new Error(`Error connecting to HMRC API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to identify tax topics from text
function identifyTaxTopics(text: string): string[] {
  const lowerText = text.toLowerCase();
  return Object.entries(TAX_TOPICS)
    .filter(([topic, keywords]) => 
      keywords.some(keyword => lowerText.includes(keyword.toLowerCase()))
    )
    .map(([topic]) => topic);
}

// Helper function to extract snippet from content
function extractSnippet(text: string, keyword: string, snippetLength: number = 200): string {
  if (!text || !keyword) return "";
  
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  const index = lowerText.indexOf(lowerKeyword);
  if (index === -1) return text.substring(0, Math.min(snippetLength, text.length));
  
  const startIndex = Math.max(0, index - snippetLength / 2);
  const endIndex = Math.min(text.length, index + keyword.length + snippetLength / 2);
  
  let snippet = text.substring(startIndex, endIndex);
  
  // Add ellipsis if we're not starting from the beginning or ending at the end
  if (startIndex > 0) snippet = "..." + snippet;
  if (endIndex < text.length) snippet = snippet + "...";
  
  return snippet;
}

// Tool: Search HMRC guidance by title
server.tool(
  "search-guidance",
  "Search HMRC tax guidance by title",
  {
    title: z.string().describe("Title or keywords to search for in tax guidance"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ title, limit }: { title: string; limit: number }) => {
    const url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(title)}&filter_organisations=hm-revenue-customs&count=${limit}`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tax guidance found matching "${title}".\n\nTry searching with different keywords or check these common tax guidance topics:\n- Self Assessment\n- VAT\n- Corporation Tax\n- Capital Gains Tax\n- Income Tax`,
            },
          ],
        };
      }

      const results = data.results.map((result: any) => {
        const relevantTopics = result.description ? identifyTaxTopics(result.description).join(", ") : "";
        
        return {
          title: result.title,
          type: result.content_store_document_type || "guidance",
          id: result.link.replace(/^\//, ""),
          url: `${HMRC_BASE_URL}${result.link}`,
          lastUpdated: result.public_timestamp,
          relevantTopics: relevantTopics,
          snippet: result.description ? extractSnippet(result.description, title) : ""
        };
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} tax guidance items matching "${title}":\n\n${
              results.map((r: any) => 
                `Title: ${r.title}\nType: ${r.type}\nURL: ${r.url}${
                  r.snippet ? `\nSummary: ${r.snippet}` : ""
                }${
                  r.relevantTopics ? `\nTopics: ${r.relevantTopics}` : ""
                }\nLast updated: ${r.lastUpdated || "Unknown"}`
              ).join("\n\n")
            }\n\nTo view specific guidance, use the get-guidance tool with the ID or use the URL directly.`
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching for tax guidance: ${(error as Error).message}\n\nPlease try again with different search terms or check if the HMRC service is currently available.`,
          },
        ],
      };
    }
  }
);

// Tool: Search HMRC tax forms
server.tool(
  "search-tax-forms",
  "Search HMRC tax forms and returns",
  {
    query: z.string().describe("Form number or description to search for"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ query, limit }: { query: string; limit: number }) => {
    // First try to match common form patterns directly
    const formPattern = /^([A-Z]{1,3}[0-9]{1,4}[A-Z]?)$/i;
    let url = "";
    
    if (formPattern.test(query)) {
      // If the query appears to be a form number, search more specifically
      url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(query)}&filter_organisations=hm-revenue-customs&count=${limit}`;
    } else {
      // Otherwise do a more general search
      url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(query)} form&filter_organisations=hm-revenue-customs&count=${limit}`;
    }
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tax forms found matching "${query}".\n\nTry using common form numbers like SA100, P60, CT600, or search with more general terms like "Self Assessment form".`,
            },
          ],
        };
      }

      const results = data.results
        .filter((result: any) => result.title.toLowerCase().includes("form") || 
                               result.description?.toLowerCase().includes("form"))
        .map((result: any) => {
          // Extract form number if present (common formats: SA100, P60, CT600, etc.)
          const formNumberMatch = result.title.match(/\b([A-Z]{1,3}[0-9]{1,4}[A-Z]?)\b/);
          
          return {
            formNumber: formNumberMatch ? formNumberMatch[1] : "Unknown",
            title: result.title,
            description: result.description || "No description available",
            url: `${HMRC_BASE_URL}${result.link}`,
            lastUpdated: result.public_timestamp,
            snippet: result.description ? extractSnippet(result.description, query) : ""
          };
        });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} tax forms matching "${query}":\n\n${
              results.map((r: any) => 
                `Form: ${r.formNumber}\nTitle: ${r.title}\nDescription: ${r.snippet || r.description}\nURL: ${r.url}\nLast updated: ${r.lastUpdated || "Unknown"}`
              ).join("\n\n")
            }\n\nTo download or view a specific form, use the URL provided.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching for tax forms: ${(error as Error).message}\n\nPlease try again with different search terms or check if the HMRC service is currently available.`,
          },
        ],
      };
    }
  }
);

// Tool: Get tax guidance by ID/path
server.tool(
  "get-guidance",
  "Get specific tax guidance by its ID/path",
  {
    id: z.string().describe("ID (path) of the guidance document"),
  },
  async ({ id }: { id: string }) => {
    let guidancePath = id;
    
    // If the ID doesn't start with a slash, add one
    if (!guidancePath.startsWith("/")) {
      guidancePath = `/${guidancePath}`;
    }
    
    const url = `${API_BASE_URL}${guidancePath}`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data || !data.title) {
        return {
          content: [
            {
              type: "text",
              text: `No tax guidance found with ID "${id}"`,
            },
          ],
        };
      }

      // Extract the content
      let contentText = "";
      
      if (data.details && data.details.body) {
        // Remove HTML tags for plain text
        contentText = data.details.body.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (data.details && data.details.parts) {
        // For multi-part documents, extract text from parts
        contentText = data.details.parts
          .map((part: any) => part.title + ": " + (part.body || "").replace(/<[^>]+>/g, ' '))
          .join("\n\n")
          .replace(/\s+/g, ' ')
          .trim();
      }

      // Extract related topics if available
      const relatedTopics = data.links?.related_guides?.map((guide: any) => guide.title).join(", ") || "None";
      
      return {
        content: [
          {
            type: "text",
            text: `Title: ${data.title}\nPublished: ${data.public_updated_at || "Unknown"}\n\nContent:\n${contentText}\n\nRelated topics: ${relatedTopics}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving tax guidance: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Search within guidance
server.tool(
  "search-within-guidance",
  "Search for specific keywords within tax guidance document",
  {
    id: z.string().describe("ID (path) of the guidance document"),
    keywords: z.string().describe("Keywords to search for in the guidance"),
  },
  async ({ id, keywords }: { id: string; keywords: string }) => {
    let guidancePath = id;
    
    // If the ID doesn't start with a slash, add one
    if (!guidancePath.startsWith("/")) {
      guidancePath = `/${guidancePath}`;
    }
    
    const url = `${API_BASE_URL}${guidancePath}`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data || !data.title) {
        return {
          content: [
            {
              type: "text",
              text: `No tax guidance found with ID "${id}"`,
            },
          ],
        };
      }

      // Extract the content
      let contentText = "";
      
      if (data.details && data.details.body) {
        // Remove HTML tags for plain text
        contentText = data.details.body.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (data.details && data.details.parts) {
        // For multi-part documents, combine text from parts
        contentText = data.details.parts
          .map((part: any) => part.title + ": " + (part.body || "").replace(/<[^>]+>/g, ' '))
          .join("\n\n")
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      const keywordList = keywords.split(",").map(k => k.trim());
      const matches: {keyword: string, snippets: string[]}[] = [];
      
      for (const keyword of keywordList) {
        const lowerContentText = contentText.toLowerCase();
        const lowerKeyword = keyword.toLowerCase();
        let lastIndex = 0;
        const snippets: string[] = [];
        
        while (lastIndex !== -1) {
          const index = lowerContentText.indexOf(lowerKeyword, lastIndex);
          if (index === -1) break;
          
          const snippet = extractSnippet(contentText, keyword);
          snippets.push(snippet);
          
          lastIndex = index + lowerKeyword.length;
          
          // Limit to first 5 matches for each keyword
          if (snippets.length >= 5) break;
        }
        
        if (snippets.length > 0) {
          matches.push({
            keyword,
            snippets
          });
        }
      }
      
      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No matches found for "${keywords}" in "${data.title}"`,
            },
          ],
        };
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Found matches for "${keywords}" in "${data.title}":\n\n${
              matches.map(match => 
                `Keyword: ${match.keyword}\n${match.snippets.map((s, i) => `  Match ${i+1}: ${s}`).join("\n")}`
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
            text: `Error searching within tax guidance: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Search by tax topic
server.tool(
  "search-by-tax-topic",
  "Search for guidance related to specific tax topics",
  {
    topic: z.string().describe("Tax topic to search for (e.g., income-tax, vat, corporation-tax)"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ topic, limit }: { topic: string; limit: number }) => {
    // Handle both kebab-case topics and regular text
    const normalizedTopic = topic.toLowerCase().replace(/\s+/g, '-');
    
    // First check if this is a known topic
    let searchTerms: string[] = [];
    if (TAX_TOPICS[normalizedTopic]) {
      searchTerms = TAX_TOPICS[normalizedTopic];
    } else {
      // Check if it's a known topic with different formatting
      const matchedTopic = Object.keys(TAX_TOPICS).find(key => 
        key.toLowerCase().replace(/-/g, ' ') === topic.toLowerCase()
      );
      
      if (matchedTopic) {
        searchTerms = TAX_TOPICS[matchedTopic];
      } else {
        // Just use the topic as a search term
        searchTerms = [topic];
      }
    }
    
    const searchQuery = searchTerms[0]; // Use the first search term
    const url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(searchQuery)}&filter_organisations=hm-revenue-customs&count=${limit}`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No guidance found for tax topic "${topic}"`,
            },
          ],
        };
      }

      const results = data.results.map((result: any) => {
        return {
          title: result.title,
          type: result.content_store_document_type || "guidance",
          id: result.link.replace(/^\//, ""),
          url: `${HMRC_BASE_URL}${result.link}`,
          lastUpdated: result.public_timestamp,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} guidance items for tax topic "${topic}":\n\n${
              results.map((r: any) => 
                `Title: ${r.title}\nType: ${r.type}\nURL: ${r.url}\nLast updated: ${r.lastUpdated || "Unknown"}`
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
            text: `Error searching for tax topic guidance: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Get tax rates and thresholds
server.tool(
  "get-tax-rates",
  "Get current UK tax rates and thresholds",
  {
    taxType: z.string().describe("Type of tax (income-tax, corporation-tax, capital-gains, vat, etc.)"),
    taxYear: z.string().optional().describe("Tax year in format YYYY-YY (e.g., 2023-24), defaults to current tax year"),
  },
  async ({ taxType, taxYear }: { taxType: string; taxYear?: string }) => {
    // Normalize the tax type
    const normalizedTaxType = taxType.toLowerCase().replace(/\s+/g, '-');
    
    // If no tax year specified, search for current rates
    let searchQuery = normalizedTaxType;
    if (taxYear) {
      searchQuery = `${normalizedTaxType} ${taxYear}`;
    } else {
      searchQuery = `${normalizedTaxType} rates`;
    }
    
    const url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(searchQuery)}&filter_organisations=hm-revenue-customs&count=5`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tax rate information found for "${taxType}" ${taxYear ? `(${taxYear})` : ''}`,
            },
          ],
        };
      }

      // Get the most relevant result
      const relevantResult = data.results[0];
      const resultUrl = `${API_BASE_URL}${relevantResult.link}`;
      
      // Fetch the content of the most relevant result
      const detailedData = await makeApiRequest<any>(resultUrl);
      
      let contentText = "";
      
      if (detailedData.details && detailedData.details.body) {
        // Remove HTML tags for plain text
        contentText = detailedData.details.body.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (detailedData.details && detailedData.details.parts) {
        // For multi-part documents, combine text from parts
        contentText = detailedData.details.parts
          .map((part: any) => part.title + ": " + (part.body || "").replace(/<[^>]+>/g, ' '))
          .join("\n\n")
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      return {
        content: [
          {
            type: "text",
            text: `Tax rates and thresholds for ${taxType} ${taxYear ? `(${taxYear})` : ''}:\nSource: ${detailedData.title}\nURL: ${HMRC_BASE_URL}${relevantResult.link}\n\n${contentText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving tax rates: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Analyze financial scenario for tax implications
server.tool(
  "analyze-tax-scenario",
  "Analyze a financial scenario to determine tax implications",
  {
    scenario: z.string().describe("Description of the financial scenario to analyze"),
    taxYear: z.string().optional().describe("Tax year in format YYYY-YY (e.g., 2023-24), defaults to current tax year"),
  },
  async ({ scenario, taxYear }: { scenario: string; taxYear?: string }) => {
    // Identify tax topics relevant to the scenario
    const relevantTopics = identifyTaxTopics(scenario);
    
    if (relevantTopics.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `Could not identify specific tax topics in your scenario. Please provide more details about the tax situation.`,
          },
        ],
      };
    }
    
    // Search for guidance related to each tax topic
    const searchResults: TaxGuidanceResult[] = [];
    
    for (const topic of relevantTopics) {
      const topicKeywords = TAX_TOPICS[topic][0]; // Use the first keyword as search term
      
      const url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(topicKeywords)}&filter_organisations=hm-revenue-customs&count=3`;
      
      try {
        const data = await makeApiRequest<any>(url);
        
        if (data.results && data.results.length > 0) {
          data.results.forEach((result: any) => {
            searchResults.push({
              title: result.title,
              type: result.content_store_document_type || "guidance",
              id: result.link.replace(/^\//, ""),
              url: `${HMRC_BASE_URL}${result.link}`,
              relevance: topic
            });
          });
        }
      } catch (error) {
        console.error(`Error searching for topic ${topic}:`, error);
      }
    }
    
    // Further analyze the scenario for specific amounts, dates, or other relevant information
    const amountMatches = scenario.match(/£([0-9,]+(\.[0-9]{2})?)/g);
    const amounts = amountMatches ? amountMatches.map(m => m.replace(/,/g, '')) : [];
    
    const yearMatches = scenario.match(/\b20[0-9]{2}(-[0-9]{2})?\b/g);
    const years = yearMatches || [];
    
    return {
      content: [
        {
          type: "text",
          text: `Tax Analysis for Scenario: "${scenario}"\n\n` +
                `Identified tax topics: ${relevantTopics.join(", ")}\n` +
                `${amounts.length > 0 ? `Amounts mentioned: ${amounts.join(", ")}\n` : ""}` +
                `${years.length > 0 ? `Years mentioned: ${years.join(", ")}\n` : ""}` +
                `\nRelevant HMRC guidance:\n\n` +
                searchResults.map(result => 
                  `Title: ${result.title}\nType: ${result.type}\nRelevant to: ${result.relevance}\nURL: ${result.url}`
                ).join("\n\n")
        },
      ],
    };
  }
);

// Tool: Get VAT calculator
server.tool(
  "vat-calculator",
  "Calculate VAT for a given amount",
  {
    amount: z.number().describe("The amount to calculate VAT for"),
    vatRate: z.number().optional().default(20).describe("VAT rate as percentage (e.g., 20 for standard rate)"),
    includesVat: z.boolean().optional().default(false).describe("Whether the amount already includes VAT"),
  },
  async ({ amount, vatRate, includesVat }: { amount: number; vatRate: number; includesVat: boolean }) => {
    // Validate input
    if (amount <= 0) {
      return {
        content: [
          {
            type: "text",
            text: "Amount must be greater than zero.",
          },
        ],
      };
    }

    if (vatRate <= 0) {
      return {
        content: [
          {
            type: "text",
            text: "VAT rate must be greater than zero.",
          },
        ],
      };
    }

    let netAmount: number;
    let vatAmount: number;
    let grossAmount: number;

    if (includesVat) {
      // Calculate net amount and VAT from gross amount
      netAmount = amount / (1 + (vatRate / 100));
      vatAmount = amount - netAmount;
      grossAmount = amount;
    } else {
      // Calculate VAT and gross amount from net amount
      netAmount = amount;
      vatAmount = amount * (vatRate / 100);
      grossAmount = netAmount + vatAmount;
    }

    return {
      content: [
        {
          type: "text",
          text: `VAT Calculation (${vatRate}% rate):\n\n` +
                `Net amount: £${netAmount.toFixed(2)}\n` +
                `VAT amount: £${vatAmount.toFixed(2)}\n` +
                `Gross amount: £${grossAmount.toFixed(2)}`,
        },
      ],
    };
  }
);

// Tool: Get tax calendar
server.tool(
  "get-tax-deadlines",
  "Get important UK tax deadlines and dates",
  {
    taxYear: z.string().optional().describe("Tax year in format YYYY-YY (e.g., 2023-24)"),
    taxType: z.string().optional().describe("Type of tax (income-tax, corporation-tax, vat, etc.)"),
  },
  async ({ taxYear, taxType }: { taxYear?: string; taxType?: string }) => {
    let searchQuery = "tax deadlines";
    
    if (taxYear) {
      searchQuery += ` ${taxYear}`;
    }
    
    if (taxType) {
      searchQuery += ` ${taxType}`;
    }
    
    const url = `${HMRC_BASE_URL}/api/search.json?q=${encodeURIComponent(searchQuery)}&filter_organisations=hm-revenue-customs&count=5`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.results || data.results.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No tax deadline information found for ${taxType || "general tax"} ${taxYear || "(current tax year)"}`,
            },
          ],
        };
      }

      // Get the most relevant result
      const relevantResult = data.results[0];
      const resultUrl = `${API_BASE_URL}${relevantResult.link}`;
      
      // Fetch the content of the most relevant result
      const detailedData = await makeApiRequest<any>(resultUrl);
      
      let contentText = "";
      
      if (detailedData.details && detailedData.details.body) {
        // Remove HTML tags for plain text
        contentText = detailedData.details.body.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      } else if (detailedData.details && detailedData.details.parts) {
        // For multi-part documents, combine text from parts
        contentText = detailedData.details.parts
          .map((part: any) => part.title + ": " + (part.body || "").replace(/<[^>]+>/g, ' '))
          .join("\n\n")
          .replace(/\s+/g, ' ')
          .trim();
      }
      
      // Extract dates using regex if possible
      const dateMatches = contentText.match(/\b\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}\b/g);
      const dates = dateMatches ? dateMatches.join(", ") : "No specific dates found";
      
      return {
        content: [
          {
            type: "text",
            text: `Tax deadlines for ${taxType || "all taxes"} ${taxYear || "(current tax year)"}:\n` +
                  `Source: ${detailedData.title}\n` +
                  `URL: ${HMRC_BASE_URL}${relevantResult.link}\n\n` +
                  `Key dates: ${dates}\n\n` +
                  contentText,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving tax deadlines: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }
);
