#!/usr/bin/env node
// Define types for modules that can't be found at compile time
// These will be resolved at runtime when the modules are available
// @ts-ignore
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
// @ts-ignore
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
// @ts-ignore
import axios from "axios";
import puppeteer from "puppeteer";
import TurndownService from "turndown";
// @ts-ignore
import { HfInference } from "@huggingface/inference";
// @ts-ignore
import { uploadFiles, whoAmI } from "@huggingface/hub";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
// Constants
const USER_AGENT = "Dataset-Creation-MCP-Server/1.0.0";
const CACHE_TTL = 3600 * 24; // 24 hours
const MAX_CONCURRENCY = 5;
const HF_TOKEN = process.env.HF_TOKEN || "";
const TEMP_DIR = "./datasets-temp";
// Setup cache
const responseCache = new Map();
// Setup Hugging Face inference
const hf = new HfInference(HF_TOKEN);
const turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced'
});
// Create temp directory if it doesn't exist
if (!existsSync(TEMP_DIR)) {
    mkdirSync(TEMP_DIR, { recursive: true });
}
// Helper function to make API requests with caching
async function makeApiRequest(url, useCache = true) {
    try {
        // Check cache first if caching is enabled
        if (useCache) {
            const cachedData = getCachedResponse(url);
            if (cachedData) {
                console.log(`Cache hit for URL: ${url}`);
                return cachedData;
            }
        }
        console.log(`Making API request to: ${url}`);
        const response = await axios.get(url, {
            headers: {
                "User-Agent": USER_AGENT,
                "Accept": "application/json",
            },
            timeout: 15000, // 15 second timeout
        });
        // Cache the response if caching is enabled
        if (useCache) {
            setCachedResponse(url, response.data);
        }
        return response.data;
    }
    catch (error) {
        if (axios.isAxiosError(error)) {
            const axiosError = error;
            if (axiosError.code === 'ECONNABORTED') {
                console.error(`Request timeout for URL: ${url}`);
                throw new Error(`Request timed out. The API is not responding in a timely manner.`);
            }
            else if (axiosError.response) {
                console.error(`API error: ${axiosError.response.status} - ${axiosError.response.statusText}`);
                throw new Error(`API returned error ${axiosError.response.status}: ${axiosError.response.statusText}`);
            }
        }
        throw error instanceof Error ? error : new Error(String(error));
    }
}
// Cache management functions
function getCachedResponse(url) {
    const cachedResponse = responseCache.get(url);
    if (!cachedResponse) {
        return null;
    }
    // Check if cache has expired
    const now = Date.now();
    if (now - cachedResponse.timestamp > CACHE_TTL * 1000) {
        responseCache.delete(url);
        return null;
    }
    return cachedResponse.data;
}
function setCachedResponse(url, data) {
    responseCache.set(url, {
        timestamp: Date.now(),
        data,
    });
}
// Helper function for concurrency control
async function withConcurrencyLimit(tasks, limit) {
    const results = [];
    const executing = [];
    for (const task of tasks) {
        const p = Promise.resolve().then(() => task()).then(result => {
            results.push(result);
            executing.splice(executing.indexOf(p), 1);
        });
        executing.push(p);
        if (executing.length >= limit) {
            await Promise.race(executing);
        }
    }
    await Promise.all(executing);
    return results;
}
// Helper function to clean HTML
function cleanHtml(html) {
    // Remove scripts, styles, comments, and other unwanted elements
    return html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<head\b[^<]*(?:(?!<\/head>)<[^<]*)*<\/head>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, '');
}
// Helper function to convert HTML to Markdown using ReaderLM
async function convertHtmlToMarkdown(html) {
    try {
        // First clean the HTML
        const cleanedHtml = cleanHtml(html);
        try {
            // Try using ReaderLM-v2 model for conversion
            console.log("Converting HTML to Markdown using ReaderLM-v2...");
            const prompt = `Extract the main content from the given HTML and convert it to Markdown format.\n\`\`\`html\n${cleanedHtml}\n\`\`\``;
            const response = await hf.textGeneration({
                model: "jinaai/ReaderLM-v2",
                inputs: prompt,
                parameters: {
                    max_new_tokens: 4096,
                    temperature: 0.1,
                    repetition_penalty: 1.05
                }
            });
            // Extract markdown content from the response
            const markdown = response.generated_text.trim();
            // Extract content between markdown code blocks if present
            const markdownRegex = /```(?:markdown)?\s*([\s\S]*?)```/;
            const match = markdown.match(markdownRegex);
            if (match && match[1]) {
                return match[1].trim();
            }
            return markdown;
        }
        catch (error) {
            // Fallback to turndown if HF inference fails
            console.warn("HF inference failed, falling back to TurndownService:", error);
            return turndownService.turndown(cleanedHtml);
        }
    }
    catch (error) {
        console.error("Error converting HTML to Markdown:", error);
        // Last resort fallback
        return turndownService.turndown(html);
    }
}
// Initialize browser for scraping
let browser = null;
let page = null;
async function ensureBrowser() {
    if (!browser || !browser.connected) {
        try {
            browser?.close();
        }
        catch (error) {
            // Ignore errors when closing browser
        }
        browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
        page = await browser.newPage();
        await page.setUserAgent(USER_AGENT);
        // Set timeout
        await page.setDefaultNavigationTimeout(60000);
    }
    return page;
}
// Function to write dataset to disk
function writeDatasetToDisk(dataset, outputPath) {
    const dir = dirname(outputPath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
    writeFileSync(outputPath, JSON.stringify(dataset, null, 2));
    console.log(`Dataset written to ${outputPath}`);
}
// Function to create a dataset suitable for HF
async function createDataset(documents, datasetName, outputPath = join(TEMP_DIR, `${datasetName}.json`)) {
    const dataset = {
        name: datasetName,
        documents
    };
    writeDatasetToDisk(dataset, outputPath);
    return outputPath;
}
// Function to upload dataset to HuggingFace Hub
async function uploadDatasetToHub(localPath, repoId) {
    try {
        if (!HF_TOKEN) {
            throw new Error("HF_TOKEN environment variable not set - cannot upload to Hub");
        }
        // @ts-ignore - whoAmI accepts { token } in the latest version
        const user = await whoAmI({ token: HF_TOKEN });
        console.log(`Uploading dataset as user: ${user.name}`);
        // Prepare upload
        const fileName = localPath.split("/").pop() || "dataset.json";
        // @ts-ignore - Type mismatch in HF API definition vs actual implementation
        await uploadFiles({
            credentials: { accessToken: HF_TOKEN },
            repo: {
                name: repoId.split("/").pop() || "dataset",
                type: "dataset",
            },
            files: [
                {
                    path: localPath,
                    name: fileName,
                    // @ts-ignore - Adding content property for type compatibility
                    content: readFileSync(localPath)
                }
            ],
            commitTitle: `Upload dataset: ${fileName}`,
            commitDescription: "Uploaded via Dataset-Creation-MCP",
        });
        return `https://huggingface.co/datasets/${repoId}`;
    }
    catch (error) {
        console.error("Failed to upload to HuggingFace Hub:", error);
        throw new Error(`Failed to upload to HuggingFace Hub: ${error instanceof Error ? error.message : String(error)}`);
    }
}
// MCP server tools
const TOOLS = [
    {
        name: "crawl_website",
        description: "Crawl a website and create a dataset from the content",
        inputSchema: {
            type: "object",
            properties: {
                url: { type: "string", description: "URL of the website to crawl" },
                depth: { type: "number", description: "Maximum depth to crawl (default: 2)" },
                maxPages: { type: "number", description: "Maximum number of pages to crawl (default: 50)" },
                includePatterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "URL patterns to include (regex)"
                },
                excludePatterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "URL patterns to exclude (regex)"
                },
                datasetName: { type: "string", description: "Name of the dataset to create" },
                uploadToHub: { type: "boolean", description: "Whether to upload the dataset to HuggingFace Hub" },
                hubRepoId: { type: "string", description: "HuggingFace Hub dataset repository ID (username/repo-name)" },
            },
            required: ["url", "datasetName"]
        }
    },
    {
        name: "create_dataset_from_urls",
        description: "Create a dataset from a list of URLs",
        inputSchema: {
            type: "object",
            properties: {
                urls: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of URLs to fetch content from"
                },
                datasetName: { type: "string", description: "Name of the dataset to create" },
                uploadToHub: { type: "boolean", description: "Whether to upload the dataset to HuggingFace Hub" },
                hubRepoId: { type: "string", description: "HuggingFace Hub dataset repository ID (username/repo-name)" },
            },
            required: ["urls", "datasetName"]
        }
    },
    {
        name: "create_dataset_from_legislation",
        description: "Create a dataset containing UK legislation",
        inputSchema: {
            type: "object",
            properties: {
                searchTerm: { type: "string", description: "Term to search for in legislation titles" },
                year: { type: "number", description: "Year of legislation (optional)" },
                type: { type: "string", description: "Type of legislation (e.g., 'ukpga' for UK Public General Acts)" },
                maxItems: { type: "number", description: "Maximum number of legislation items to include (default: 50)" },
                datasetName: { type: "string", description: "Name of the dataset to create" },
                uploadToHub: { type: "boolean", description: "Whether to upload the dataset to HuggingFace Hub" },
                hubRepoId: { type: "string", description: "HuggingFace Hub dataset repository ID (username/repo-name)" },
            },
            required: ["datasetName"]
        }
    },
    {
        name: "create_dataset_from_hmrc",
        description: "Create a dataset containing documentation from HMRC",
        inputSchema: {
            type: "object",
            properties: {
                searchTerm: { type: "string", description: "Term to search for in HMRC documents" },
                documentType: { type: "string", description: "Type of document (e.g., 'guidance', 'forms', 'manuals')" },
                maxItems: { type: "number", description: "Maximum number of documents to include (default: 50)" },
                datasetName: { type: "string", description: "Name of the dataset to create" },
                uploadToHub: { type: "boolean", description: "Whether to upload the dataset to HuggingFace Hub" },
                hubRepoId: { type: "string", description: "HuggingFace Hub dataset repository ID (username/repo-name)" },
            },
            required: ["datasetName"]
        }
    },
    {
        name: "html_to_markdown",
        description: "Convert HTML content to Markdown using ReaderLM",
        inputSchema: {
            type: "object",
            properties: {
                html: { type: "string", description: "HTML content to convert" },
                clean: { type: "boolean", description: "Whether to clean the HTML before conversion (default: true)" },
            },
            required: ["html"]
        }
    },
];
// Create server
const server = new McpServer({
    name: "dataset-creation-mcp-server",
    version: "1.0.0",
}, {
    capabilities: {
        resources: {},
        tools: {},
    },
});
// Handle tool calls
async function handleToolCall(name, args) {
    console.log(`Handling tool call: ${name}`);
    switch (name) {
        case "crawl_website": {
            const { url, depth = 2, maxPages = 50, includePatterns = [], excludePatterns = [], datasetName, uploadToHub = false, hubRepoId, } = args;
            try {
                console.log(`Crawling website: ${url} (depth: ${depth}, maxPages: ${maxPages})`);
                const page = await ensureBrowser();
                const visitedUrls = new Set();
                const pendingUrls = [{ url, depth: 0 }];
                const documents = [];
                // Compile regex patterns
                const includeRegexes = includePatterns.map((pattern) => new RegExp(pattern));
                const excludeRegexes = excludePatterns.map((pattern) => new RegExp(pattern));
                // Function to check if URL should be crawled
                const shouldCrawl = (testUrl) => {
                    // Always match the starting URL
                    if (testUrl === url)
                        return true;
                    // Check if URL is from the same domain
                    try {
                        const testUrlObj = new URL(testUrl);
                        const baseUrlObj = new URL(url);
                        if (testUrlObj.hostname !== baseUrlObj.hostname)
                            return false;
                        // Check exclude patterns first (if matched, don't crawl)
                        if (excludeRegexes.length > 0 && excludeRegexes.some(regex => regex.test(testUrl))) {
                            return false;
                        }
                        // Check include patterns (if any exist and none match, don't crawl)
                        if (includeRegexes.length > 0 && !includeRegexes.some(regex => regex.test(testUrl))) {
                            return false;
                        }
                        return true;
                    }
                    catch (error) {
                        return false;
                    }
                };
                // Function to process a URL
                const processUrl = async (urlItem) => {
                    const { url: currentUrl, depth: currentDepth } = urlItem;
                    if (visitedUrls.size >= maxPages)
                        return;
                    if (visitedUrls.has(currentUrl))
                        return;
                    console.log(`Processing URL: ${currentUrl} (depth: ${currentDepth})`);
                    visitedUrls.add(currentUrl);
                    try {
                        // Visit the page
                        await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
                        // Use setTimeout instead of page.waitForTimeout
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for any dynamic content
                        // Get page content
                        const content = await page.content();
                        const title = await page.title();
                        // Convert to Markdown
                        const markdown = await convertHtmlToMarkdown(content);
                        // Add to documents
                        documents.push({
                            text: markdown,
                            metadata: {
                                source: currentUrl,
                                title,
                                date: new Date().toISOString(),
                                type: 'webpage',
                            }
                        });
                        // If we haven't reached max depth, extract links and add to pending queue
                        if (currentDepth < depth) {
                            const links = await page.evaluate(() => {
                                return Array.from(document.querySelectorAll('a[href]'))
                                    .map(a => a.getAttribute('href'))
                                    .filter(href => href && !href.startsWith('#') && !href.startsWith('javascript:'));
                            });
                            for (const link of links) {
                                try {
                                    // Resolve relative URLs
                                    if (link) {
                                        const resolvedUrl = new URL(link, currentUrl).href;
                                        if (!visitedUrls.has(resolvedUrl) && shouldCrawl(resolvedUrl)) {
                                            pendingUrls.push({ url: resolvedUrl, depth: currentDepth + 1 });
                                        }
                                    }
                                }
                                catch (error) {
                                    // Invalid URL, skip it
                                }
                            }
                        }
                    }
                    catch (error) {
                        console.warn(`Error processing URL ${currentUrl}:`, error);
                    }
                };
                // Process URLs with concurrency limit
                while (pendingUrls.length > 0 && visitedUrls.size < maxPages) {
                    const batch = pendingUrls.splice(0, Math.min(MAX_CONCURRENCY, pendingUrls.length));
                    await Promise.all(batch.map(processUrl));
                }
                // Create the dataset
                const outputPath = await createDataset(documents, datasetName);
                // Upload to Hub if requested
                let hubUrl = "";
                if (uploadToHub && hubRepoId) {
                    hubUrl = await uploadDatasetToHub(outputPath, hubRepoId);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created dataset "${datasetName}" with ${documents.length} documents from ${visitedUrls.size} pages.\n\n` +
                                `Dataset saved to: ${outputPath}` +
                                (hubUrl ? `\n\nUploaded to HuggingFace Hub: ${hubUrl}` : ""),
                        }
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to crawl website: ${error instanceof Error ? error.message : String(error)}`,
                        }
                    ],
                    isError: true,
                };
            }
        }
        case "create_dataset_from_urls": {
            const { urls, datasetName, uploadToHub = false, hubRepoId, } = args;
            try {
                console.log(`Creating dataset from ${urls.length} URLs`);
                const page = await ensureBrowser();
                const documents = [];
                // Function to process a URL
                const processUrl = async (url) => {
                    console.log(`Processing URL: ${url}`);
                    try {
                        // Visit the page
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                        // Use setTimeout instead of page.waitForTimeout
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for any dynamic content
                        // Get page content
                        const content = await page.content();
                        const title = await page.title();
                        // Convert to Markdown
                        const markdown = await convertHtmlToMarkdown(content);
                        // Add to documents
                        documents.push({
                            text: markdown,
                            metadata: {
                                source: url,
                                title,
                                date: new Date().toISOString(),
                                type: 'webpage',
                            }
                        });
                    }
                    catch (error) {
                        console.warn(`Error processing URL ${url}:`, error);
                    }
                };
                // Process URLs with concurrency limit
                const urlBatches = [];
                for (let i = 0; i < urls.length; i += MAX_CONCURRENCY) {
                    urlBatches.push(urls.slice(i, i + MAX_CONCURRENCY));
                }
                for (const batch of urlBatches) {
                    await Promise.all(batch.map(url => processUrl(url)));
                }
                // Create the dataset
                const outputPath = await createDataset(documents, datasetName);
                // Upload to Hub if requested
                let hubUrl = "";
                if (uploadToHub && hubRepoId) {
                    hubUrl = await uploadDatasetToHub(outputPath, hubRepoId);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created dataset "${datasetName}" with ${documents.length} documents.\n\n` +
                                `Dataset saved to: ${outputPath}` +
                                (hubUrl ? `\n\nUploaded to HuggingFace Hub: ${hubUrl}` : ""),
                        }
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create dataset from URLs: ${error instanceof Error ? error.message : String(error)}`,
                        }
                    ],
                    isError: true,
                };
            }
        }
        case "create_dataset_from_legislation": {
            const { searchTerm = "", year, type, maxItems = 50, datasetName, uploadToHub = false, hubRepoId, } = args;
            try {
                const API_BASE = "https://www.legislation.gov.uk/search";
                // Build search query
                let searchUrl = `${API_BASE}?title=${encodeURIComponent(searchTerm)}&type=all`;
                if (year)
                    searchUrl += `&year=${year}`;
                if (type)
                    searchUrl += `&type=${type}`;
                console.log(`Searching legislation: ${searchUrl}`);
                // Fetch search results
                const searchResponse = await makeApiRequest(searchUrl);
                if (!searchResponse.results || searchResponse.results.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No legislation found matching the search criteria.",
                            }
                        ],
                        isError: true,
                    };
                }
                const results = searchResponse.results.slice(0, maxItems);
                console.log(`Found ${results.length} legislation items`);
                // Process each legislation
                const documents = [];
                // Function to process legislation
                const processLegislation = async (item) => {
                    try {
                        const url = item.url;
                        console.log(`Processing legislation: ${url}`);
                        // Fetch legislation content
                        const page = await ensureBrowser();
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                        // Use setTimeout instead of page.waitForTimeout
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        // Get content
                        const content = await page.content();
                        // Convert to Markdown
                        const markdown = await convertHtmlToMarkdown(content);
                        // Add to documents
                        documents.push({
                            text: markdown,
                            metadata: {
                                source: url,
                                title: item.title,
                                date: item.year,
                                type: item.type,
                                id: item.id,
                            }
                        });
                    }
                    catch (error) {
                        console.warn(`Error processing legislation ${item.title}:`, error);
                    }
                };
                // Process legislation items with concurrency limit
                const batches = [];
                for (let i = 0; i < results.length; i += MAX_CONCURRENCY) {
                    batches.push(results.slice(i, i + MAX_CONCURRENCY));
                }
                for (const batch of batches) {
                    await Promise.all(batch.map((item) => processLegislation(item)));
                }
                // Create the dataset
                const outputPath = await createDataset(documents, datasetName);
                // Upload to Hub if requested
                let hubUrl = "";
                if (uploadToHub && hubRepoId) {
                    hubUrl = await uploadDatasetToHub(outputPath, hubRepoId);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created dataset "${datasetName}" with ${documents.length} legislation documents.\n\n` +
                                `Dataset saved to: ${outputPath}` +
                                (hubUrl ? `\n\nUploaded to HuggingFace Hub: ${hubUrl}` : ""),
                        }
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create dataset from legislation: ${error instanceof Error ? error.message : String(error)}`,
                        }
                    ],
                    isError: true,
                };
            }
        }
        case "create_dataset_from_hmrc": {
            const { searchTerm = "", documentType = "all", maxItems = 50, datasetName, uploadToHub = false, hubRepoId, } = args;
            try {
                const API_BASE = "https://www.gov.uk/api/search";
                // Build search query
                let searchUrl = `${API_BASE}?q=${encodeURIComponent(searchTerm)}`;
                searchUrl += `&filter_organisations=hm-revenue-customs`;
                if (documentType !== "all") {
                    searchUrl += `&filter_content_purpose=${documentType}`;
                }
                console.log(`Searching HMRC documents: ${searchUrl}`);
                // Fetch search results
                const searchResponse = await makeApiRequest(searchUrl);
                if (!searchResponse.results || searchResponse.results.length === 0) {
                    return {
                        content: [
                            {
                                type: "text",
                                text: "No HMRC documents found matching the search criteria.",
                            }
                        ],
                        isError: true,
                    };
                }
                const results = searchResponse.results.slice(0, maxItems);
                console.log(`Found ${results.length} HMRC documents`);
                // Process each document
                const documents = [];
                // Function to process document
                const processDocument = async (item) => {
                    try {
                        const url = `https://www.gov.uk${item.link}`;
                        console.log(`Processing document: ${url}`);
                        // Fetch document content
                        const page = await ensureBrowser();
                        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
                        // Use setTimeout instead of page.waitForTimeout
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        // Get content
                        const content = await page.content();
                        // Convert to Markdown
                        const markdown = await convertHtmlToMarkdown(content);
                        // Add to documents
                        documents.push({
                            text: markdown,
                            metadata: {
                                source: url,
                                title: item.title,
                                date: item.public_timestamp,
                                type: item.content_purpose,
                                id: item.link,
                            }
                        });
                    }
                    catch (error) {
                        console.warn(`Error processing document ${item.title}:`, error);
                    }
                };
                // Process documents with concurrency limit
                const batches = [];
                for (let i = 0; i < results.length; i += MAX_CONCURRENCY) {
                    batches.push(results.slice(i, i + MAX_CONCURRENCY));
                }
                for (const batch of batches) {
                    await Promise.all(batch.map((item) => processDocument(item)));
                }
                // Create the dataset
                const outputPath = await createDataset(documents, datasetName);
                // Upload to Hub if requested
                let hubUrl = "";
                if (uploadToHub && hubRepoId) {
                    hubUrl = await uploadDatasetToHub(outputPath, hubRepoId);
                }
                return {
                    content: [
                        {
                            type: "text",
                            text: `Created dataset "${datasetName}" with ${documents.length} HMRC documents.\n\n` +
                                `Dataset saved to: ${outputPath}` +
                                (hubUrl ? `\n\nUploaded to HuggingFace Hub: ${hubUrl}` : ""),
                        }
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to create dataset from HMRC documents: ${error instanceof Error ? error.message : String(error)}`,
                        }
                    ],
                    isError: true,
                };
            }
        }
        case "html_to_markdown": {
            const { html, clean = true, } = args;
            try {
                // Process HTML
                const processedHtml = clean ? cleanHtml(html) : html;
                const markdown = await convertHtmlToMarkdown(processedHtml);
                return {
                    content: [
                        {
                            type: "text",
                            text: markdown,
                        }
                    ],
                };
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Failed to convert HTML to Markdown: ${error instanceof Error ? error.message : String(error)}`,
                        }
                    ],
                    isError: true,
                };
            }
        }
        default:
            return {
                content: [
                    {
                        type: "text",
                        text: `Unknown tool: ${name}`,
                    }
                ],
                isError: true,
            };
    }
}
// Setup request handlers
server.setRequestHandler("list_resources", async () => ({
    resources: [],
}));
server.setRequestHandler("read_resource", async (request) => {
    throw new Error(`Resource not found: ${request.params.uri}`);
});
server.setRequestHandler("list_tools", async () => ({
    tools: TOOLS,
}));
server.setRequestHandler("call_tool", async (request) => handleToolCall(request.params.name, request.params.arguments ?? {}));
// Run server
async function runServer() {
    console.log("Starting Dataset Creation MCP Server...");
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
runServer().catch(console.error);
// Cleanup on exit
process.on("SIGINT", async () => {
    console.log("Shutting down...");
    await browser?.close();
    process.exit(0);
});
process.stdin.on("close", async () => {
    console.error("Dataset Creation MCP Server closed");
    await browser?.close();
    server.close();
});
