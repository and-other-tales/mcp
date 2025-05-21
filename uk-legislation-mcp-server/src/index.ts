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
interface LegislationResult {
  title: string;
  type: string;
  year: number;
  number: string;
  id: string;
  searchTerm?: string;
  keyword?: string;
  relevance?: string;
}

interface SectionMatch {
  number: string;
  title: string;
  snippet: string;
}

interface LegislationChange {
  date: string;
  text: string;
  affected: string;
}

interface TOCEntry {
  title: string;
  number: string;
  id: string;
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

const API_BASE_URL = "https://www.legislation.gov.uk";
const USER_AGENT = "UK-Legislation-MCP-Server/1.0.0";

// Legal topics mapping
const LEGAL_TOPICS: Record<string, string[]> = {
  "housing": ["rent", "tenant", "landlord", "eviction", "section 21", "housing act", "homelessness", "accommodation", "lease", "tenancy"],
  "employment": ["employee", "employer", "workplace", "dismissal", "redundancy", "wages", "salary", "discrimination", "harassment"],
  "family": ["divorce", "custody", "adoption", "marriage", "children", "parental", "guardian"],
  "immigration": ["asylum", "visa", "citizenship", "deportation", "refugee", "immigration status"],
  "consumer": ["consumer rights", "refund", "warranty", "purchase", "faulty goods", "services", "contract"],
  "benefits": ["universal credit", "welfare", "disability benefits", "pension", "jobseeker", "income support"],
  "criminal": ["crime", "offense", "prosecution", "sentence", "parole", "prison", "arrest"],
  "tax": ["taxation", "income tax", "vat", "capital gains", "inheritance tax", "tax relief", "hmrc"]
};

// Common legal citation patterns
const CITATION_PATTERNS = [
  /\[([0-9]{4})\]\s+([A-Z]+)\s+([0-9]+)/i, // [2018] UKSC 25
  /\[([0-9]{4})\]\s+([0-9]+)\s+([A-Za-z\s]+)\s+([0-9]+)/i, // [2015] 1 WLR 1234
  /\(([0-9]{4})\)\s+([0-9]+)\s+([A-Za-z\s]+)\s+([0-9]+)/i, // (2016) 2 All ER 123
  /([A-Za-z\s]+)\s+v\s+([A-Za-z\s]+)/i, // Smith v Jones
];

// Create server instance
const server = new McpServer({
  name: "uk-legislation",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  },
});

// Helper function to make API requests to legislation.gov.uk with caching
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
      timeout: 15000, // 15 second timeout - legislation.gov.uk API can be slow
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
        throw new Error(`Request timed out. The legislation.gov.uk API is not responding in a timely manner.`);
      } else if (axiosError.response) {
        const status = axiosError.response.status;
        const statusText = axiosError.response.statusText;
        console.error(`API error: ${status} - ${statusText}`);
        throw new Error(`legislation.gov.uk API returned error ${status}: ${statusText}`);
      }
    }
    console.error("Error making API request:", error);
    throw new Error(`Error connecting to legislation.gov.uk API: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Helper function to convert legislation types to human-readable format
function getLegislationTypeName(type: string): string {
  const typeMap: Record<string, string> = {
    "ukpga": "UK Public General Acts",
    "ukla": "UK Local Acts",
    "ukppa": "UK Private and Personal Acts",
    "gbla": "Local Acts of the Parliament of Great Britain",
    "apgb": "Acts of the Parliament of Great Britain",
    "gbppa": "Private and Personal Acts of the Parliament of Great Britain",
    "aep": "Acts of the English Parliament",
    "aosp": "Acts of the Old Scottish Parliament",
    "asp": "Acts of the Scottish Parliament",
    "aip": "Acts of the Old Irish Parliament",
    "apni": "Acts of the Northern Ireland Parliament",
    "mnia": "Measures of the Northern Ireland Assembly",
    "nia": "Acts of the Northern Ireland Assembly",
    "ukcm": "UK Church Measures",
    "mwa": "Measures of the Welsh Assembly",
    "anaw": "Acts of the Welsh Assembly",
    "asc": "Acts of Senedd Cymru",
    "uksi": "UK Statutory Instruments",
    "ssi": "Scottish Statutory Instruments",
    "wsi": "Wales Statutory Instruments", 
    "nisr": "Northern Ireland Statutory Rules",
    "ukci": "UK Church Instruments",
    "nisi": "Northern Ireland Orders in Council",
    "ukmo": "UK Ministerial Orders",
    "nisro": "Northern Ireland Statutory Rules and Orders",
    "ukdsi": "UK Draft Statutory Instruments",
    "sdsi": "Scottish Draft Statutory Instruments",
    "nidsr": "Northern Ireland Statutory Rules",
    "nidsi": "Northern Ireland Draft Orders in Council",
    "wdsi": "Welsh Draft Statutory Instruments",
  };

  return typeMap[type] || type;
}

// Helper function to identify legal topics from text
function identifyLegalTopics(text: string): string[] {
  const lowerText = text.toLowerCase();
  return Object.entries(LEGAL_TOPICS)
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

// Tool: Search UK legislation by title
server.tool(
  "search-legislation",
  "Search UK legislation by title",
  {
    title: z.string().describe("Title of the legislation to search for"),
    year: z.number().optional().describe("Year of the legislation (optional)"),
    type: z.string().optional().describe("Type of legislation (e.g., 'ukpga' for UK Public General Acts)"),
  },
  async ({ title, year, type }: { title: string; year?: number; type?: string }) => {
    let url = `${API_BASE_URL}/search?title=${encodeURIComponent(title)}`;
    
    if (year) {
      url += `&year=${year}`;
    }
    
    if (type) {
      url += `&type=${type}`;
    }

    url += "&format=json";

    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.searchResults || data.searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No legislation found matching the title "${title}".\n\nTry using more general keywords, or specify a year if you know when the legislation was passed. Common legislation types include:\n- ukpga: UK Public General Acts\n- uksi: UK Statutory Instruments\n- asp: Acts of the Scottish Parliament\n- nia: Acts of the Northern Ireland Assembly\n- anaw: Acts of the Welsh Assembly`,
            },
          ],
        };
      }

      const results = data.searchResults.map((result: any) => {
        // Identify relevant legal topics
        const relevantTopics = result.title ? identifyLegalTopics(result.title).join(", ") : "";
        
        return {
          title: result.title,
          type: getLegislationTypeName(result.type),
          year: result.year,
          number: result.number,
          id: `${result.type}/${result.year}/${result.number}`,
          relevantTopics: relevantTopics
        };
      });

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} legislation items matching "${title}":\n\n${
              results.map((r: any) => 
                `Title: ${r.title}\nType: ${r.type}\nYear: ${r.year}\nNumber: ${r.number}\nID: ${r.id}${
                  r.relevantTopics ? `\nTopics: ${r.relevantTopics}` : ""
                }`
              ).join("\n\n")
            }\n\nTo view specific legislation, use the get-legislation tool with the ID.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching for legislation: ${error instanceof Error ? error.message : String(error)}\n\nPlease try again with different search terms or check if the legislation.gov.uk service is currently available.`,
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
    subject: z.string().describe("Subject matter or keywords to search for"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ subject, limit }: { subject: string; limit: number }) => {
    // First try a direct search with the subject
    let url = `${API_BASE_URL}/search?text=${encodeURIComponent(subject)}&format=json`;
    
    try {
      const data = await makeApiRequest<any>(url);
      
      if (!data.searchResults || data.searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No legislation found related to the subject "${subject}".\n\nTry using more general keywords or consider using the search-legislation-scenario tool to analyze a specific legal scenario.`,
            },
          ],
        };
      }

      const results = data.searchResults
        .slice(0, limit)
        .map((result: any) => {
          return {
            title: result.title,
            type: getLegislationTypeName(result.type),
            year: result.year,
            number: result.number,
            id: `${result.type}/${result.year}/${result.number}`,
            relevance: "Directly related to search terms"
          };
        });

      // Add a hint about related legal topics
      const relatedTopics = identifyLegalTopics(subject);
      let topicHint = "";
      if (relatedTopics.length > 0) {
        topicHint = `\n\nYour query relates to the following legal topics: ${relatedTopics.join(", ")}. Consider adding these terms to narrow your search.`;
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${results.length} legislation items related to "${subject}":\n\n${
              results.map((r: any) => 
                `Title: ${r.title}\nType: ${r.type}\nYear: ${r.year}\nNumber: ${r.number}\nID: ${r.id}`
              ).join("\n\n")
            }${topicHint}\n\nTo view specific legislation, use the get-legislation tool with the ID.`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error searching for legislation by subject: ${error instanceof Error ? error.message : String(error)}\n\nPlease try again with different search terms or check if the legislation.gov.uk service is currently available.`,
          },
        ],
      };
    }
  }
);

// Tool: Get specific legislation by ID
server.tool(
  "get-legislation",
  "Get specific legislation by its ID",
  {
    id: z.string().describe("ID of the legislation (e.g., 'ukpga/1985/67')"),
    version: z.string().optional().describe("Version of the legislation (e.g., 'enacted', '2021-04-01', 'prospective')"),
    format: z.enum(["data.xml", "data.rdf", "data.htm", "data.pdf"]).optional().default("data.xml").describe("Format to retrieve the legislation in"),
  },
  async ({ id, version, format }: { id: string; version?: string; format?: string }) => {
    let url = `${API_BASE_URL}/${id}`;
    
    if (version) {
      url += `/${version}`;
    }
    
    if (format) {
      url += `/${format}`;
    }

    try {
      const data = await makeApiRequest<any>(url);
      
      const content = typeof data === "string" 
        ? data 
        : JSON.stringify(data, null, 2);

      return {
        content: [
          {
            type: "text",
            text: `Legislation for ID "${id}":\n\n${content.slice(0, 10000)}${content.length > 10000 ? "...\n\n[Content truncated due to length]" : ""}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving legislation: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Search legislation sections by keyword
server.tool(
  "search-sections",
  "Search for sections within legislation containing specific keywords",
  {
    id: z.string().describe("ID of the legislation (e.g., 'ukpga/1985/67')"),
    keywords: z.string().describe("Keywords to search for within the legislation"),
    version: z.string().optional().describe("Version of the legislation (e.g., 'enacted', '2021-04-01', 'prospective')"),
  },
  async ({ id, keywords, version }: { id: string; keywords: string; version?: string }) => {
    let url = `${API_BASE_URL}/${id}`;
    
    if (version) {
      url += `/${version}`;
    }
    
    url += `/data.xml`;

    try {
      const data = await makeApiRequest<string>(url);
      
      // Simple keyword search in the XML (a more sophisticated approach would use XML parsing)
      const lowerData = data.toLowerCase();
      const lowerKeywords = keywords.toLowerCase();
      const matches: SectionMatch[] = [];
      
      // Find sections containing keywords (simplistic approach)
      const sectionMatches = data.match(/<Section[^>]*>[\s\S]*?<\/Section>/g);
      
      if (sectionMatches) {
        for (const section of sectionMatches) {
          if (section.toLowerCase().includes(lowerKeywords)) {
            // Extract section number and title
            const numberMatch = section.match(/Number="([^"]+)"/);
            const titleMatch = section.match(/<Title>([^<]+)<\/Title>/);
            
            if (numberMatch && titleMatch) {
              matches.push({
                number: numberMatch[1],
                title: titleMatch[1],
                // Extract a snippet of text around the keyword
                snippet: extractSnippet(section, lowerKeywords, 200),
              });
            }
          }
        }
      }

      if (matches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No sections found containing keywords "${keywords}" in legislation "${id}"`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Found ${matches.length} sections containing keywords "${keywords}" in legislation "${id}":\n\n${
              matches.map(m => 
                `Section ${m.number}: ${m.title}\n${m.snippet}`
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
            text: `Error searching sections: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Get a specific section from legislation
server.tool(
  "get-section",
  "Get a specific section from legislation",
  {
    id: z.string().describe("ID of the legislation (e.g., 'ukpga/1985/67')"),
    section: z.string().describe("Section number or identifier"),
    version: z.string().optional().describe("Version of the legislation (e.g., 'enacted', '2021-04-01', 'prospective')"),
  },
  async ({ id, section, version }: { id: string; section: string; version?: string }) => {
    let url = `${API_BASE_URL}/${id}/section/${section}`;
    
    if (version) {
      url += `/${version}`;
    }
    
    url += `/data.xml`;

    try {
      const data = await makeApiRequest<string>(url);
      
      // Extract the main content from the XML (simplistic approach)
      const contentMatch = data.match(/<Content[^>]*>([\s\S]*?)<\/Content>/);
      const content = contentMatch ? contentMatch[1] : data;
      
      // Convert XML content to more readable text (simplistic)
      const readableText = content
        .replace(/<Para[^>]*>([\s\S]*?)<\/Para>/g, "$1\n\n")
        .replace(/<Emphasis[^>]*>([\s\S]*?)<\/Emphasis>/g, "$1")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        content: [
          {
            type: "text",
            text: `Section ${section} of legislation "${id}":\n\n${readableText}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving section: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Get the table of contents for legislation
server.tool(
  "get-table-of-contents",
  "Get the table of contents for legislation",
  {
    id: z.string().describe("ID of the legislation (e.g., 'ukpga/1985/67')"),
    version: z.string().optional().describe("Version of the legislation (e.g., 'enacted', '2021-04-01', 'prospective')"),
  },
  async ({ id, version }: { id: string; version?: string }) => {
    let url = `${API_BASE_URL}/${id}`;
    
    if (version) {
      url += `/${version}`;
    }
    
    url += `/contents/data.xml`;

    try {
      const data = await makeApiRequest<string>(url);
      
      // Simple TOC extraction (a more sophisticated approach would use XML parsing)
      const entries: TOCEntry[] = [];
      
      // Extract items from table of contents
      const itemMatches = data.match(/<ContentsItem[^>]*>[\s\S]*?<\/ContentsItem>/g);
      
      if (itemMatches) {
        for (const item of itemMatches) {
          const titleMatch = item.match(/<Title>([^<]+)<\/Title>/);
          const numberMatch = item.match(/Number="([^"]+)"/);
          const idMatch = item.match(/Id="([^"]+)"/);
          
          if (titleMatch) {
            entries.push({
              title: titleMatch[1],
              number: numberMatch ? numberMatch[1] : "",
              id: idMatch ? idMatch[1] : "",
            });
          }
        }
      }

      if (entries.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Could not extract table of contents for legislation "${id}"`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Table of contents for legislation "${id}":\n\n${
              entries.map(entry => 
                `${entry.number ? entry.number + " - " : ""}${entry.title}`
              ).join("\n")
            }`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error retrieving table of contents: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// Tool: Get changes to legislation over time
server.tool(
  "get-legislation-changes",
  "Get information about how legislation has changed over time",
  {
    id: z.string().describe("ID of the legislation (e.g., 'ukpga/1985/67')"),
  },
  async ({ id }: { id: string }) => {
    let url = `${API_BASE_URL}/${id}/changes/data.xml`;

    try {
      const data = await makeApiRequest<string>(url);
      
      // Extract changes from the XML (simplistic approach)
      const changeMatches = data.match(/<Change[^>]*>[\s\S]*?<\/Change>/g);
      
      if (!changeMatches || changeMatches.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No recorded changes found for legislation "${id}"`,
            },
          ],
        };
      }
      
      const changes = changeMatches.map(change => {
        const dateMatch = change.match(/Date="([^"]+)"/);
        const textMatch = change.match(/<Text>([^<]+)<\/Text>/);
        const affectedMatch = change.match(/<AffectedProvision>([^<]+)<\/AffectedProvision>/);
        
        return {
          date: dateMatch ? dateMatch[1] : "Unknown date",
          text: textMatch ? textMatch[1] : "Unknown change",
          affected: affectedMatch ? affectedMatch[1] : "Unknown provision",
        };
      });

      return {
        content: [
          {
            type: "text",
            text: `Changes to legislation "${id}":\n\n${
              changes.map(change => 
                `Date: ${change.date}\nAffected: ${change.affected}\nChange: ${change.text}`
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
            text: `Error retrieving legislation changes: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// NEW TOOL: Find related legislation
server.tool(
  "find-related-legislation",
  "Find legislation that is related to the specified legislation",
  {
    id: z.string().describe("ID of the legislation to find related items for (e.g., 'ukpga/1985/67')"),
    limit: z.number().optional().default(5).describe("Maximum number of related items to return"),
  },
  async ({ id, limit }: { id: string; limit: number }) => {
    try {
      // First get the legislation to extract keywords
      let url = `${API_BASE_URL}/${id}/data.xml`;
      const data = await makeApiRequest<string>(url);
      
      // Extract title to use for related search
      const titleMatch = data.match(/<Title>([^<]+)<\/Title>/);
      if (!titleMatch) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find title for legislation "${id}"`,
            },
          ],
        };
      }
      
      // Extract main topic keywords
      const title = titleMatch[1];
      const keywordMatch = title.match(/\b(Act|Regulations?|Order|Scheme|Rules)\b/);
      const legislationType = keywordMatch ? keywordMatch[1] : "Act";
      
      // Extract potential subject matter
      const words = title.split(/\s+/).filter(word => 
        word.length > 3 && 
        !["act", "regulation", "order", "scheme", "rules", "the", "and", "for"].includes(word.toLowerCase())
      );
      
      // Get related legislation
      const searchUrl = `${API_BASE_URL}/search?text=${encodeURIComponent(words.join(" "))}&format=json`;
      const searchData = await makeApiRequest<any>(searchUrl);
      
      if (!searchData.searchResults || searchData.searchResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No related legislation found for "${id}" (${title})`,
            },
          ],
        };
      }
      
      // Filter out the original legislation
      const relatedResults = searchData.searchResults
        .filter((result: any) => `${result.type}/${result.year}/${result.number}` !== id)
        .slice(0, limit)
        .map((result: any) => {
          return {
            title: result.title,
            type: getLegislationTypeName(result.type),
            year: result.year,
            number: result.number,
            id: `${result.type}/${result.year}/${result.number}`,
          };
        });
        
      if (relatedResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No related legislation found for "${id}" (${title})`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: `Related legislation for "${title}" (${id}):\n\n${
              relatedResults.map((r: LegislationResult) => 
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
            text: `Error finding related legislation: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// NEW TOOL: Find legislation by legal topic
server.tool(
  "find-by-legal-topic",
  "Find legislation related to specific legal topics",
  {
    topic: z.string().describe("Legal topic (e.g., 'housing', 'employment', 'immigration', 'family')"),
    limit: z.number().optional().default(10).describe("Maximum number of results to return"),
  },
  async ({ topic, limit }: { topic: string; limit: number }) => {
    try {
      // Get keywords for the selected legal topic
      const topicLower = topic.toLowerCase();
      const topicKeywords = Object.entries(LEGAL_TOPICS)
        .find(([t]) => t.toLowerCase() === topicLower)?.[1] || [];
        
      if (topicKeywords.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Unknown legal topic: "${topic}". Available topics are: ${Object.keys(LEGAL_TOPICS).join(", ")}`,
            },
          ],
        };
      }
      
      // Perform searches for each keyword and collect results
      const allResults: LegislationResult[] = [];
      
      // Use the first 3 keywords for better results
      const searchKeywords = topicKeywords.slice(0, 3);
      for (const keyword of searchKeywords) {
        const searchUrl = `${API_BASE_URL}/search?text=${encodeURIComponent(keyword)}&format=json`;
        const searchData = await makeApiRequest<any>(searchUrl);
        
        if (searchData.searchResults && searchData.searchResults.length > 0) {
          const results = searchData.searchResults.map((result: any) => ({
            title: result.title,
            type: getLegislationTypeName(result.type),
            year: result.year,
            number: result.number,
            id: `${result.type}/${result.year}/${result.number}`,
            keyword
          }));
          
          allResults.push(...results);
        }
      }
      
      if (allResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `No legislation found related to the topic "${topic}"`,
            },
          ],
        };
      }
      
      // Filter out duplicates based on ID
      const uniqueResults = Array.from(
        allResults.reduce((map, item) => {
          if (!map.has(item.id)) {
            map.set(item.id, item);
          }
          return map;
        }, new Map<string, LegislationResult>()).values()
      );
      
      // Sort by year (newest first) and take the limit
      const sortedResults = uniqueResults
        .sort((a, b) => b.year - a.year)
        .slice(0, limit);

      return {
        content: [
          {
            type: "text",
            text: `Found ${sortedResults.length} legislation items related to the topic "${topic}":\n\n${
              sortedResults.map((r: LegislationResult) => 
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
            text: `Error searching for legislation by topic: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// NEW TOOL: Legal scenario analysis
server.tool(
  "analyze-legal-scenario",
  "Analyze a legal scenario to find applicable legislation",
  {
    scenario: z.string().describe("Description of the legal scenario (e.g., 'landlord eviction section 21')"),
    detail: z.string().optional().describe("Additional details about the scenario"),
  },
  async ({ scenario, detail }: { scenario: string; detail?: string }) => {
    try {
      const fullScenario = detail ? `${scenario} ${detail}` : scenario;
      
      // 1. Identify the legal topics in the scenario
      const topics = identifyLegalTopics(fullScenario);
      
      if (topics.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: "Could not identify specific legal topics in your scenario. Please provide more details or specific legal terms.",
            },
          ],
        };
      }
      
      // 2. Extract specific legal terms that might indicate legislation
      const lowerScenario = fullScenario.toLowerCase();
      
      // Look for section references
      const sectionMatches = lowerScenario.match(/section\s+(\d+[a-z]?)/gi) || [];
      const sections = sectionMatches.map((match: string) => match.replace(/section\s+/i, ""));
      
      // Look for act references
      const actMatches = lowerScenario.match(/([a-z\s]+)\s+act\s+(\d{4})/gi) || [];
      const acts = actMatches.map((match: string) => match.trim());
      
      // Look for specific legal phrases
      const phrases = ["notice to quit", "eviction notice", "possession order", "housing benefit", 
                      "tenancy agreement", "employment contract", "universal credit"];
      const foundPhrases = phrases.filter(phrase => lowerScenario.includes(phrase.toLowerCase()));
      
      // 3. Look for citations
      const citations = CITATION_PATTERNS.flatMap(pattern => {
        const matches = fullScenario.match(pattern) || [];
        return matches.map((m: string) => m.trim());
      });
      
      // 4. Perform searches based on the identified topics, terms, acts, and sections
      const searchTerms: string[] = [];
      
      // Start with acts if found
      if (acts.length > 0) {
        searchTerms.push(...acts);
      }
      
      // Next add topic-specific keywords
      topics.forEach(topic => {
        const keywords = LEGAL_TOPICS[topic as keyof typeof LEGAL_TOPICS];
        if (keywords) {
          // Find which keywords from the topic are in the scenario
          const presentKeywords = keywords.filter(k => lowerScenario.includes(k.toLowerCase()));
          if (presentKeywords.length > 0) {
            searchTerms.push(...presentKeywords.slice(0, 2)); // Take only the first 2 to avoid too many searches
          } else {
            searchTerms.push(topic); // Use the topic name itself
          }
        }
      });
      
      // If we have sections mentioned, prioritize them
      if (sections.length > 0 && acts.length > 0) {
        // Try to pair acts with sections for more specific searches
        const actSectionPairs = acts.flatMap((act: string) => 
          sections.map((section: string) => `${act} section ${section}`)
        );
        searchTerms.unshift(...actSectionPairs);
      }
      
      // Deduplicate search terms
      const uniqueSearchTerms = Array.from(new Set(searchTerms));
      
      // Perform searches (limit to 3 search terms to avoid too many requests)
      const allResults: Array<LegislationResult & { searchTerm: string }> = [];
      const searchPromises = uniqueSearchTerms.slice(0, 3).map(async term => {
        const searchUrl = `${API_BASE_URL}/search?text=${encodeURIComponent(term)}&format=json`;
        try {
          const searchData = await makeApiRequest<any>(searchUrl);
          
          if (searchData.searchResults && searchData.searchResults.length > 0) {
            const results = searchData.searchResults
              .slice(0, 5) // Take top 5 for each search term
              .map((result: any) => ({
                title: result.title,
                type: getLegislationTypeName(result.type),
                year: result.year,
                number: result.number,
                id: `${result.type}/${result.year}/${result.number}`,
                searchTerm: term
              }));
            
            allResults.push(...results);
          }
        } catch (error) {
          console.error(`Error searching for term "${term}":`, error);
          // Continue with other search terms
        }
      });
      
      await Promise.all(searchPromises);
      
      if (allResults.length === 0) {
        return {
          content: [
            {
              type: "text",
              text: `Could not find applicable legislation for your scenario. I identified these legal topics: ${topics.join(", ")}. Please provide more specific details about the legal issue.`,
            },
          ],
        };
      }
      
      // Filter out duplicates based on ID
      const uniqueResultsMap = new Map<string, LegislationResult & { searchTerm: string }>();
      
      allResults.forEach(item => {
        if (!uniqueResultsMap.has(item.id)) {
          uniqueResultsMap.set(item.id, item);
        } else {
          // If this item appears with multiple search terms, combine them
          const existingItem = uniqueResultsMap.get(item.id)!;
          if (existingItem.searchTerm !== item.searchTerm) {
            existingItem.searchTerm = `${existingItem.searchTerm}, ${item.searchTerm}`;
          }
        }
      });
      
      const uniqueResults = Array.from(uniqueResultsMap.values());
      
      // Sort by relevance (approximated by number of search terms that returned this legislation)
      const sortedResults = uniqueResults
        .sort((a, b) => {
          const aTermCount = (a.searchTerm?.split(",").length || 0);
          const bTermCount = (b.searchTerm?.split(",").length || 0);
          if (bTermCount !== aTermCount) return bTermCount - aTermCount;
          // If same relevance, sort by year (newest first)
          return b.year - a.year;
        })
        .slice(0, 7); // Limit to top 7 most relevant items

      return {
        content: [
          {
            type: "text",
            text: `Based on your scenario about "${scenario}", I've identified these legal topics: ${topics.join(", ")}.\n\nApplicable legislation:\n\n${
              sortedResults.map((r) => 
                `Title: ${r.title}\nType: ${r.type}\nYear: ${r.year}\nID: ${r.id}\nFound via search for: ${r.searchTerm}`
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
            text: `Error analyzing legal scenario: ${(error as Error).message}`,
          },
        ],
      };
    }
  }
);

// New tool: Reflective legal analysis using sequential thinking approach
// This implements a step-by-step reflective analysis of legal issues
interface LegalAnalysisThought {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  nextThoughtNeeded: boolean;
  legalContext?: {
    legislationRefs: string[];
    caseRefs: string[];
    topics: string[];
  };
}

class SequentialLegalThinking {
  private thoughtHistory: LegalAnalysisThought[] = [];
  private branches: Record<string, LegalAnalysisThought[]> = {};

  private validateThoughtData(input: unknown): LegalAnalysisThought {
    const data = input as Record<string, unknown>;

    if (!data.thought || typeof data.thought !== 'string') {
      throw new Error('Invalid thought: must be a string');
    }
    if (!data.thoughtNumber || typeof data.thoughtNumber !== 'number') {
      throw new Error('Invalid thoughtNumber: must be a number');
    }
    if (!data.totalThoughts || typeof data.totalThoughts !== 'number') {
      throw new Error('Invalid totalThoughts: must be a number');
    }
    if (typeof data.nextThoughtNeeded !== 'boolean') {
      throw new Error('Invalid nextThoughtNeeded: must be a boolean');
    }

    // Extract legislation and case law references
    const legislationRefs: string[] = [];
    const caseRefs: string[] = [];
    const thought = data.thought as string;

    // Try to extract legislation references
    const legislationMatches = thought.match(/(\d{4})\s+(c\.\s*\d+)/g) || [];
    legislationMatches.forEach(match => legislationRefs.push(match));

    // Try to extract case references using citation patterns
    CITATION_PATTERNS.forEach(pattern => {
      const matches = thought.matchAll(pattern);
      for (const match of matches) {
        caseRefs.push(match[0]);
      }
    });

    // Identify legal topics
    const topics = identifyLegalTopics(thought);

    return {
      thought: data.thought as string,
      thoughtNumber: data.thoughtNumber as number,
      totalThoughts: data.totalThoughts as number,
      nextThoughtNeeded: data.nextThoughtNeeded as boolean,
      isRevision: data.isRevision as boolean | undefined,
      revisesThought: data.revisesThought as number | undefined,
      legalContext: {
        legislationRefs,
        caseRefs,
        topics
      }
    };
  }

  private formatThought(thoughtData: LegalAnalysisThought): string {
    const { thoughtNumber, totalThoughts, thought, isRevision, revisesThought } = thoughtData;

    let prefix = '';
    let context = '';

    if (isRevision) {
      prefix = '🔄 Revision';
      context = ` (revising thought ${revisesThought})`;
    } else {
      prefix = '💭 Thought';
      context = '';
    }

    const header = `${prefix} ${thoughtNumber}/${totalThoughts}${context}`;
    const topicsText = thoughtData.legalContext?.topics && thoughtData.legalContext.topics.length > 0 
      ? `Topics: ${thoughtData.legalContext.topics.join(', ')}` 
      : '';
    const lawsText = thoughtData.legalContext?.legislationRefs && thoughtData.legalContext.legislationRefs.length > 0
      ? `Legislation: ${thoughtData.legalContext.legislationRefs.join(', ')}` 
      : '';
    const casesText = thoughtData.legalContext?.caseRefs && thoughtData.legalContext?.caseRefs.length > 0
      ? `Cases: ${thoughtData.legalContext.caseRefs.join(', ')}` 
      : '';
    
    const contextInfo = [topicsText, lawsText, casesText].filter(t => t.length > 0).join('\n');
    
    return `
------ ${header} ------
${thought}
${contextInfo ? '\n' + contextInfo : ''}
----------------------`;
  }

  public processThought(input: unknown): { content: Array<{ type: string; text: string }>; isError?: boolean } {
    try {
      const validatedInput = this.validateThoughtData(input);

      if (validatedInput.thoughtNumber > validatedInput.totalThoughts) {
        validatedInput.totalThoughts = validatedInput.thoughtNumber;
      }

      this.thoughtHistory.push(validatedInput);

      const formattedThought = this.formatThought(validatedInput);
      console.error(formattedThought);

      // For each legislation reference, try to pull real-time data
      const legislationDetails = validatedInput.legalContext?.legislationRefs.map(ref => {
        // This is a simplified match - in production we'd need more sophisticated parsing
        const match = ref.match(/(\d{4})\s+(c\.\s*\d+)/);
        if (match) {
          const year = match[1];
          const chapter = match[2].replace('c.', '').trim();
          return { year, chapter, ref };
        }
        return null;
      }).filter(Boolean);

      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            thoughtNumber: validatedInput.thoughtNumber,
            totalThoughts: validatedInput.totalThoughts,
            nextThoughtNeeded: validatedInput.nextThoughtNeeded,
            thoughtHistoryLength: this.thoughtHistory.length,
            legalContext: validatedInput.legalContext,
            // Return any legislation that was successfully identified
            legislationDetails
          }, null, 2)
        }]
      };
    } catch (error: unknown) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error),
            status: 'failed'
          }, null, 2)
        }],
        isError: true
      };
    }
  }
}

// Create an instance of the sequential legal thinking processor
const sequentialLegalThinking = new SequentialLegalThinking();

// Add the sequential thinking tool to the server
server.tool(
  "analyze-legal-issue-sequentially",
  "Analyze a legal issue step-by-step using reflective thinking",
  {
    thought: z.string().describe("Your current thinking step about the legal issue"),
    thoughtNumber: z.number().min(1).describe("Current thought number"),
    totalThoughts: z.number().min(1).describe("Estimated total thoughts needed"),
    nextThoughtNeeded: z.boolean().describe("Whether another thought step is needed"),
    isRevision: z.boolean().optional().describe("Whether this revises previous thinking"),
    revisesThought: z.number().optional().describe("Which thought is being reconsidered"),
  },
  async (params: {
    thought: string;
    thoughtNumber: number;
    totalThoughts: number;
    nextThoughtNeeded: boolean;
    isRevision?: boolean;
    revisesThought?: number;
  }) => {
    return sequentialLegalThinking.processThought(params);
  }
);

// Main function to run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("UK Legislation MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
}); 