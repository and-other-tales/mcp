import { v4 as uuidv4 } from 'uuid';
import nlp from 'compromise';
import type { TextChunk, ChunkMetadata, ChunkingOptions, ContextualElement, ChunkAnalysis } from '../types/chunking';
import type { NlpDocument } from '../types/compromise';
import logger from '../utils/logger';

export class ContextChunkManager {
  private chunks: Map<string, TextChunk> = new Map();
  private chunkAnalyses: Map<string, ChunkAnalysis> = new Map();
  private contextualElements: Map<string, ContextualElement> = new Map();

  /**
   * Chunks a manuscript into manageable pieces while preserving context
   */
  public chunkManuscript(
    text: string,
    options: ChunkingOptions
  ): TextChunk[] {
    try {
      this.chunks.clear();
      this.contextualElements.clear();

      // First pass: Create initial chunks
      const initialChunks = this.createInitialChunks(text, options);
      
      // Second pass: Analyze and refine chunks
      const refinedChunks = this.refineChunks(initialChunks, options);
      
      // Third pass: Build relationships between chunks
      this.buildChunkRelationships(refinedChunks);

      return Array.from(this.chunks.values());
    } catch (error) {
      logger.error('Error in manuscript chunking:', { error });
      throw new Error(`Failed to chunk manuscript: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Gets relevant context for a specific text position
   */
  public getContextForPosition(
    position: number,
    windowSize: number = 2
  ): ChunkAnalysis[] {
    const relevantChunks: ChunkAnalysis[] = [];
    
    for (const [_, chunk] of this.chunks) {
      if (this.isChunkRelevant(chunk, position, windowSize)) {
        const analysis = this.chunkAnalyses.get(chunk.id);
        if (analysis) {
          relevantChunks.push(analysis);
        }
      }
    }

    return this.sortByRelevance(relevantChunks, position);
  }

  /**
   * Creates initial chunks based on natural boundaries
   */
  private createInitialChunks(
    text: string,
    options: ChunkingOptions
  ): TextChunk[] {
    const chunks: TextChunk[] = [];    const doc = nlp(text) as unknown as NlpDocument;
    
    let currentPosition = 0;
    let currentChunk: TextChunk | null = null;

    doc.paragraphs().forEach((p: unknown, index: number) => {      const paragraph = p as NlpDocument;
      const paragraphText = paragraph.text();
      
      if (this.shouldStartNewChunk(currentChunk, paragraphText, options)) {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        currentChunk = {
          id: uuidv4(),
          content: paragraphText,
          startPosition: currentPosition,
          endPosition: currentPosition + paragraphText.length,
          characters: new Set(),
          locations: new Set(),
          timeframe: '',
          key_events: []
        };
      } else if (currentChunk) {
        currentChunk.content += '\\n' + paragraphText;
        currentChunk.endPosition = currentPosition + paragraphText.length;
      }

      currentPosition += paragraphText.length + 1;
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Refines chunks by analyzing content and adjusting boundaries
   */
  private refineChunks(
    chunks: TextChunk[],
    options: ChunkingOptions
  ): TextChunk[] {
    chunks.forEach(chunk => {
      // Analyze chunk content
      const analysis = this.analyzeChunk(chunk);
      
      // Adjust chunk boundaries if needed
      this.adjustChunkBoundaries(chunk, analysis, options);
      
      // Store final chunk and analysis
      this.chunks.set(chunk.id, chunk);
      this.chunkAnalyses.set(chunk.id, analysis);
      
      // Extract and store contextual elements
      this.extractContextualElements(analysis);
    });

    return Array.from(this.chunks.values());
  }

  /**
   * Analyzes a chunk's content
   */
  private analyzeChunk(chunk: TextChunk): ChunkAnalysis {
    const doc = nlp(chunk.content);
    
    // Extract characters
    const characters = doc.match('#Person+').out('array');
    characters.forEach((char: string) => chunk.characters.add(char));

    // Extract locations
    const locations = doc.places().out('array');
    locations.forEach((loc: string) => chunk.locations.add(loc));

    // Extract events and timeframes
    const events = this.extractEvents(doc);
    chunk.key_events = events;
    chunk.timeframe = this.determineTimeframe(doc);

    // Create metadata
    const metadata: ChunkMetadata = {
      wordCount: chunk.content.split(/\s+/).length,
      tokenCount: this.estimateTokenCount(chunk.content),
      significantElements: {
        characters: Array.from(chunk.characters),
        locations: Array.from(chunk.locations),
        objects: this.extractSignificantObjects(doc),
        events
      },
      contextualReferences: {
        pastEvents: this.findPastReferences(doc),
        futureSetups: this.findFutureSetups(doc),
        characterArcs: this.extractCharacterArcs(doc, Array.from(chunk.characters))
      }
    };

    return {
      chunk,
      metadata,
      contextualElements: this.identifyContextualElements(chunk, metadata),
      relatedChunks: []
    };
  }

  /**
   * Determines if a new chunk should be started
   */
  private shouldStartNewChunk(
    currentChunk: TextChunk | null,
    newText: string,
    options: ChunkingOptions
  ): boolean {
    if (!currentChunk) return true;

    // Check size constraints
    if (this.estimateTokenCount(currentChunk.content) >= options.maxChunkSize) {
      return true;
    }

    // Check for scene breaks
    if (options.preserveScenes && this.isSceneBreak(newText)) {
      return true;
    }

    // Check for chapter breaks
    if (options.preserveChapters && this.isChapterBreak(newText)) {
      return true;
    }

    return false;
  }

  /**
   * Adjusts chunk boundaries for optimal context preservation
   */
  private adjustChunkBoundaries(
    chunk: TextChunk,
    analysis: ChunkAnalysis,
    options: ChunkingOptions
  ): void {
    // Ensure complete sentences at boundaries
    this.adjustToCompleteSentences(chunk);

    // Ensure contextual elements aren't split
    this.adjustForContextualElements(chunk, analysis);

    // Add overlap with adjacent chunks if needed
    if (options.overlapSize > 0) {
      this.addChunkOverlap(chunk, options.overlapSize);
    }
  }

  /**
   * Builds relationships between chunks
   */
  private buildChunkRelationships(chunks: TextChunk[]): void {
    chunks.forEach(chunk => {
      const analysis = this.chunkAnalyses.get(chunk.id);
      if (analysis) {
        analysis.relatedChunks = this.findRelatedChunks(chunk, analysis);
      }
    });
  }

  /**
   * Finds chunks related to the given chunk
   */
  private findRelatedChunks(
    chunk: TextChunk,
    analysis: ChunkAnalysis
  ): string[] {
    const related = new Set<string>();

    // Find chunks with shared characters
    this.chunks.forEach((otherChunk, id) => {
      if (chunk.id !== id) {
        // Check character overlap
        const sharedCharacters = new Set(
          [...chunk.characters].filter(char => otherChunk.characters.has(char))
        );

        if (sharedCharacters.size > 0) {
          related.add(id);
        }

        // Check location overlap
        const sharedLocations = new Set(
          [...chunk.locations].filter(loc => otherChunk.locations.has(loc))
        );

        if (sharedLocations.size > 0) {
          related.add(id);
        }

        // Check event connections
        const hasConnectedEvents = this.areEventsConnected(
          chunk.key_events,
          otherChunk.key_events
        );

        if (hasConnectedEvents) {
          related.add(id);
        }
      }
    });

    return Array.from(related);
  }

  /**
   * Checks if two sets of events are connected
   */
  private areEventsConnected(
    events1: string[],
    events2: string[]
  ): boolean {
    // Implementation would check for causal or thematic connections
    // This is a simplified version
    return events1.some(e1 => 
      events2.some(e2 => 
        e1.toLowerCase().includes(e2.toLowerCase()) ||
        e2.toLowerCase().includes(e1.toLowerCase())
      )
    );
  }

  /**
   * Checks if a chunk is relevant for a given position
   */
  private isChunkRelevant(
    chunk: TextChunk,
    position: number,
    windowSize: number
  ): boolean {
    const chunkIndex = this.getChunkIndex(chunk);
    const targetIndex = this.getChunkIndexForPosition(position);
    
    return Math.abs(chunkIndex - targetIndex) <= windowSize;
  }

  /**
   * Gets the index of a chunk in the sequence
   */
  private getChunkIndex(chunk: TextChunk): number {
    let index = 0;
    for (const [id, c] of this.chunks) {
      if (id === chunk.id) return index;
      index++;
    }
    return -1;
  }

  /**
   * Gets the chunk index for a given position
   */
  private getChunkIndexForPosition(position: number): number {
    let index = 0;
    for (const chunk of this.chunks.values()) {
      if (position >= chunk.startPosition && position <= chunk.endPosition) {
        return index;
      }
      index++;
    }
    return -1;
  }

  /**
   * Sorts chunk analyses by relevance to a position
   */
  private sortByRelevance(
    analyses: ChunkAnalysis[],
    position: number
  ): ChunkAnalysis[] {
    return analyses.sort((a, b) => {
      const distanceA = Math.min(
        Math.abs(position - a.chunk.startPosition),
        Math.abs(position - a.chunk.endPosition)
      );
      const distanceB = Math.min(
        Math.abs(position - b.chunk.startPosition),
        Math.abs(position - b.chunk.endPosition)
      );
      return distanceA - distanceB;
    });
  }

  /**
   * Estimates token count for a text
   */
  private estimateTokenCount(text: string): number {
    // This is a simplified estimation
    // In production, you'd use a proper tokenizer
    return Math.ceil(text.length / 4);
  }

  /**
   * Checks if text represents a scene break
   */
  private isSceneBreak(text: string): boolean {
    return /^[\s]*[*#\-_]{3,}[\s]*$/.test(text);
  }

  /**
   * Checks if text represents a chapter break
   */
  private isChapterBreak(text: string): boolean {
    return /^Chapter\s+\d+/i.test(text);
  }

  /**
   * Adjusts chunk boundaries to complete sentences
   */
  private adjustToCompleteSentences(chunk: TextChunk): void {
    const doc = nlp(chunk.content);
    const sentences = doc.sentences().out('array');
    
    if (sentences.length > 0) {
      chunk.content = sentences.join(' ');
    }
  }

  /**
   * Adjusts chunk boundaries to preserve contextual elements
   */
  private adjustForContextualElements(
    chunk: TextChunk,
    analysis: ChunkAnalysis
  ): void {
    // Implementation would ensure important narrative elements
    // aren't split across chunks
  }

  /**
   * Adds overlap with adjacent chunks
   */
  private addChunkOverlap(
    chunk: TextChunk,
    overlapSize: number
  ): void {
    // Implementation would add specified amount of overlap
    // with previous and next chunks
  }

  /**
   * Extracts significant events from text
   */
  private extractEvents(doc: any): string[] {
    // Implementation would use NLP to identify significant events
    return [];
  }

  /**
   * Determines the timeframe of a chunk
   */
  private determineTimeframe(doc: any): string {
    // Implementation would extract and normalize temporal references
    return '';
  }

  /**
   * Extracts significant objects from text
   */
  private extractSignificantObjects(doc: any): string[] {
    // Implementation would identify important objects/props
    return [];
  }

  /**
   * Finds references to past events
   */
  private findPastReferences(doc: any): string[] {
    // Implementation would identify callbacks to earlier events
    return [];
  }

  /**
   * Finds setups for future events
   */
  private findFutureSetups(doc: any): string[] {
    // Implementation would identify foreshadowing and setups
    return [];
  }

  /**
   * Extracts character arc developments
   */
  private extractCharacterArcs(
    doc: any,
    characters: string[]
  ): Record<string, string> {
    // Implementation would track character development
    return {};
  }

  /**
   * Identifies contextual elements in a chunk
   */
  private identifyContextualElements(
    chunk: TextChunk,
    metadata: ChunkMetadata
  ): ContextualElement[] {
    // Implementation would identify and score important narrative elements
    return [];
  }

  /**
   * Extracts and stores contextual elements
   */
  private extractContextualElements(analysis: ChunkAnalysis): void {
    analysis.contextualElements.forEach(element => {
      this.contextualElements.set(element.name, element);
    });
  }
}
