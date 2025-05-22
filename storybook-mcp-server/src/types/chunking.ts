export interface TextChunk {
  id: string;
  content: string;
  startPosition: number;
  endPosition: number;
  sceneIndex?: number;
  chapterIndex?: number;
  actIndex?: number;
  characters: Set<string>;
  locations: Set<string>;
  timeframe: string;
  key_events: string[];
}

export interface ChunkMetadata {
  wordCount: number;
  tokenCount: number;
  significantElements: {
    characters: string[];
    locations: string[];
    objects: string[];
    events: string[];
  };
  contextualReferences: {
    pastEvents: string[];
    futureSetups: string[];
    characterArcs: Record<string, string>;
  };
}

export interface ChunkingOptions {
  maxChunkSize: number;
  overlapSize: number;
  preserveScenes: boolean;
  preserveChapters: boolean;
  contextWindow: number;
}

export interface ContextualElement {
  type: 'character' | 'location' | 'object' | 'event';
  name: string;
  firstMention: number;
  lastMention: number;
  significance: number;
  references: string[];
}

export interface ChunkAnalysis {
  chunk: TextChunk;
  metadata: ChunkMetadata;
  contextualElements: ContextualElement[];
  relatedChunks: string[];
}
