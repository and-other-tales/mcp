#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DialogueAnalyzer } from "./analyzers/dialogue";
import { EmotionalAnalyzer } from "./analyzers/emotional";
import { CharacterAnalyzer } from "./analyzers/character";
import { EventContinuityAnalyzer } from "./analyzers/event";
import { ReaderSimulator } from "./analyzers/reader";
import { RepetitionAnalyzer } from "./analyzers/repetition";
import { ContextualThesaurus } from "./analyzers/thesaurus";
import logger from "./utils/logger";
import { AnalyzerInput, ServerRequest, SimulateReaderInput } from "./types/server";

// Initialize analyzers
const dialogueAnalyzer = new DialogueAnalyzer();
const emotionalAnalyzer = new EmotionalAnalyzer();
const characterAnalyzer = new CharacterAnalyzer();
const eventAnalyzer = new EventContinuityAnalyzer();
const repetitionAnalyzer = new RepetitionAnalyzer();
const thesaurus = new ContextualThesaurus();

// Create server instance
const server = new McpServer({
  name: "storybook-mcp-server",
  version: "1.0.0",
  capabilities: {
    resources: {},
    tools: {},
  }
});

// Tool: Analyze dialogue
server.tool(
  "analyze-dialogue",
  "Analyze dialogue flow and provide suggestions for improvement",
  {
    text: z.string().describe("The manuscript text to analyze"),
    focusCharacter: z.string().optional().describe("Optional character to focus the analysis on")
  },  async ({ text, focusCharacter }: AnalyzerInput) => {
    try {
      const result = dialogueAnalyzer.analyzeDialogue(text, focusCharacter);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in dialogue analysis:', { error });
      throw error;
    }
  }
);

// Tool: Analyze emotional content
server.tool(
  "analyze-emotions",
  "Analyze emotional content and pacing",
  {
    text: z.string().describe("The manuscript text to analyze"),
    sceneDelimiter: z.string().optional().default("***").describe("Scene delimiter")
  },  async ({ text, sceneDelimiter }: AnalyzerInput) => {
    try {
      const result = emotionalAnalyzer.analyzeEmotions(text, sceneDelimiter);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in emotional analysis:', { error });
      throw error;
    }
  }
);

// Tool: Analyze character continuity
server.tool(
  "analyze-characters",
  "Analyze character continuity and interactions",
  {
    text: z.string().describe("The manuscript text to analyze"),
    mainCharacters: z.array(z.string()).optional().describe("List of main characters to track")
  },  async ({ text, mainCharacters }: AnalyzerInput) => {
    try {
      const result = characterAnalyzer.analyzeCharacters(text, mainCharacters);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in character analysis:', { error });
      throw error;
    }
  }
);

// Tool: Analyze event continuity
server.tool(
  "analyze-events",
  "Analyze event continuity and timeline consistency",
  {
    text: z.string().describe("The manuscript text to analyze")
  },
  async ({ text }: AnalyzerInput) => {
    try {
      const result = eventAnalyzer.analyzeEvents(text);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in event analysis:', { error });
      throw error;
    }
  }
);

// Tool: Comprehensive manuscript analysis
server.tool(
  "analyze-manuscript",
  "Perform comprehensive analysis of the manuscript",
  {
    text: z.string().describe("The manuscript text to analyze"),
    sceneDelimiter: z.string().optional().default("***").describe("Scene delimiter"),
    mainCharacters: z.array(z.string()).optional().describe("List of main characters to track")
  },
  async ({ text, sceneDelimiter, mainCharacters }: AnalyzerInput) => {
    try {
      const [
        dialogueResult,
        emotionalResult,
        characterResult,
        eventResult
      ] = await Promise.all([
        dialogueAnalyzer.analyzeDialogue(text),
        emotionalAnalyzer.analyzeEmotions(text, sceneDelimiter),
        characterAnalyzer.analyzeCharacters(text, mainCharacters),
        eventAnalyzer.analyzeEvents(text)
      ]);

      const analysis = {
        dialogue: dialogueResult,
        emotional: emotionalResult,
        characters: characterResult,
        events: eventResult,
        summary: {
          dialogueCount: dialogueResult.dialogueSegments.length,
          sceneCount: emotionalResult.scenes.length,
          characterCount: characterResult.characters.length,
          eventCount: eventResult.events.length,
          continuityErrors: [
            ...characterResult.continuityErrors,
            ...eventResult.continuityErrors
          ],
          suggestions: [
            ...dialogueResult.generalSuggestions,
            ...emotionalResult.pacingSuggestions,
            ...characterResult.suggestions,
            ...eventResult.suggestions
          ]
        }
      };

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(analysis, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in comprehensive analysis:', { error });
      throw error;
    }
  }
);

// Tool: Simulate reader experience
server.tool(
  "simulate-reader",
  "Simulate how different types of readers would experience the manuscript",
  {
    text: z.string().describe("The manuscript text to analyze"),
    demographics: z.object({
      age: z.number().min(5).max(100),
      educationLevel: z.enum(['primary', 'secondary', 'undergraduate', 'postgraduate', 'professional']),
      readingSpeed: z.enum(['slow', 'average', 'fast']),
      attentionSpan: z.enum(['short', 'medium', 'long']),
      interests: z.array(z.string()),
      genre_preferences: z.array(z.string()),
      language_proficiency: z.enum(['basic', 'intermediate', 'advanced', 'native'])
    }).describe("Reader demographic profile")
  },
  async ({ text, demographics }: SimulateReaderInput) => {
    try {
      const simulator = new ReaderSimulator(demographics);
      const result = simulator.simulateReading(text);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in reader simulation:', { error });
      throw error;
    }
  }
);

// Tool: Analyze repetitions
server.tool(
  "analyze-repetitions",
  "Analyze word and phrase repetitions in the manuscript",
  {
    text: z.string().describe("The manuscript text to analyze")
  },
  async ({ text }) => {
    try {
      const result = repetitionAnalyzer.analyzeRepetitions(text);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in repetition analysis:', { error });
      throw error;
    }
  }
);

// Tool: Suggest alternatives using thesaurus
server.tool(
  "suggest-alternatives",
  "Find contextually appropriate alternatives for repeated words or phrases",
  {
    term: z.string().describe("The word or phrase to find alternatives for"),
    context: z.string().describe("The surrounding text where the term appears"),
    sceneContext: z.string().optional().describe("The broader scene context (optional)")
  },
  async ({ term, context, sceneContext }) => {
    try {
      const suggestions = thesaurus.findSynonyms(term, context, sceneContext);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(suggestions, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error in thesaurus lookup:', { error });
      throw error;
    }
  }
);

// Setup request handlers
server.setRequestHandler("list_resources", async () => ({
  resources: [],
}));

server.setRequestHandler("read_resource", async (request: ServerRequest) => {
  throw new Error(`Resource not found: ${request.params.uri}`);
});

// Health check endpoint
const healthCheck = (): { status: string; version: string; timestamp: string } => {
  return {
    status: "ok",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  };
};

// Main function to run the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // Log successful startup
  logger.info('Storybook MCP Server started successfully', {
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
}

// Start the server
main().catch(error => {
  logger.error('Server startup failed:', { error });
  process.exit(1);
});
