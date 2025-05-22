export type EmotionTone = 'positive' | 'negative' | 'neutral';

export interface NarrativeContext {
  genre: string;
  perspective: 'first-person' | 'third-person';
  timeframe: 'historical' | 'contemporary' | 'future';
  style: string;
  dominantEmotion?: EmotionTone;
}

export interface SynonymContext {
  tone: EmotionTone;
  intensity: number;
  formality: 'formal' | 'informal';
}

export interface ThesaurusSuggestion {
  word: string;
  contextScore: number;
  usageNotes: string;
  synonyms?: string[];
  context?: SynonymContext;
  narrativeContext?: NarrativeContext;
}

// This file provides thesaurus-related types for the storybook MCP server

export interface ThesaurusEntry {
  word: string;
  synonyms: string[];
  antonyms?: string[];
  definitions?: string[];
}

export interface ThesaurusResponse {
  entries: ThesaurusEntry[];
  query: string;
  success: boolean;
}

export interface ThesaurusRequest {
  word: string;
  includeAntonyms?: boolean;
  includeDefinitions?: boolean;
}
