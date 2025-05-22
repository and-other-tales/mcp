/**
 * Type definitions for the Storybook MCP Server
 */

// Core interfaces
export interface Character {
  name: string;
  currentLocation?: string;
  lastMention?: number; // paragraph number
  attributes: Map<string, string>;
  appearances: CharacterAppearance[];
}

export interface CharacterAppearance {
  paragraph: number;
  action: 'enter' | 'exit' | 'mention';
  location?: string;
}

export interface Scene {
  startParagraph: number;
  endParagraph: number;
  characters: Set<string>;
  location?: string;
  emotionalScore: EmotionalScore;
}

export interface EmotionalScore {
  joy: number;
  sadness: number;
  anger: number;
  fear: number;
  surprise: number;
}

export interface DialogueSegment {
  speaker?: string;
  text: string;
  paragraph: number;
  emotionalTone: string;
  suggestions?: string[];
}

export interface Event {
  name: string;
  paragraph: number;
  characters: string[];
  location?: string;
  description: string;
  timestamp?: string;
}

export interface ContinuityError {
  type: 'character' | 'event' | 'timeline';
  description: string;
  paragraph: number;
  severity: 'high' | 'medium' | 'low';
  suggestion?: string;
}

// Analysis results interfaces
export interface DialogueAnalysisResult {
  dialogueSegments: DialogueSegment[];
  statistics: DialogueStatistics;
  generalSuggestions: string[];
}

export interface DialogueStatistics {
  totalSegments: number;
  segmentsPerCharacter: Record<string, number>;
  averageLength: number;
  emotionalToneDistribution: Record<string, number>;
}

export interface EmotionalAnalysisResult {
  scenes: Scene[];
  emotionalArc: EmotionalArc;
  pacingSuggestions: string[];
  emotionalHighPoints: EmotionalHighPoint[];
}

export interface EmotionalArc {
  points: Array<{
    paragraph: number;
    emotions: EmotionalScore;
  }>;
  overallTrend: string;
}

export interface EmotionalHighPoint {
  paragraph: number;
  emotion: keyof EmotionalScore;
  intensity: number;
  context: string;
}

export interface CharacterAnalysisResult {
  characters: Character[];
  continuityErrors: ContinuityError[];
  statistics: CharacterStatistics;
  suggestions: string[];
}

export interface CharacterStatistics {
  totalCharacters: number;
  appearancesPerCharacter: Record<string, number>;
  mostFrequentLocations: string[];
  characterInteractions: Record<string, string[]>;
}

export interface EventAnalysisResult {
  events: Event[];
  continuityErrors: ContinuityError[];
  eventChain: EventChain;
  suggestions: string[];
}

export interface EventChain {
  sequences: EventSequence[];
  timeline: TimelineEvent[];
  possiblePlotHoles: string[];
}

export interface EventSequence {
  events: string[];
  characters: string[];
  location: string;
}

export interface TimelineEvent {
  event: string;
  timestamp: string;
  relativePosition: number;
}
