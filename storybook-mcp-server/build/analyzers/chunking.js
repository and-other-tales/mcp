import { v4 as uuidv4 } from 'uuid';
import nlp from 'compromise';
import logger from '../utils/logger';
export class ContextChunkManager {
    constructor() {
        this.chunks = new Map();
        this.chunkAnalyses = new Map();
        this.contextualElements = new Map();
    }
    /**
     * Chunks a manuscript into manageable pieces while preserving context
     */
    chunkManuscript(text, options) {
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
        }
        catch (error) {
            logger.error('Error in manuscript chunking:', { error });
            throw new Error(`Failed to chunk manuscript: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Gets relevant context for a specific text position
     */
    getContextForPosition(position, windowSize = 2) {
        const relevantChunks = [];
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
    createInitialChunks(text, options) {
        const chunks = [];
        const doc = nlp(text);
        let currentPosition = 0;
        let currentChunk = null;
        doc.paragraphs().forEach((p, index) => {
            const paragraph = p;
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
            }
            else if (currentChunk) {
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
    refineChunks(chunks, options) {
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
    analyzeChunk(chunk) {
        const doc = nlp(chunk.content);
        // Extract characters
        const characters = doc.match('#Person+').out('array');
        characters.forEach((char) => chunk.characters.add(char));
        // Extract locations
        const locations = doc.places().out('array');
        locations.forEach((loc) => chunk.locations.add(loc));
        // Extract events and timeframes
        const events = this.extractEvents(doc);
        chunk.key_events = events;
        chunk.timeframe = this.determineTimeframe(doc);
        // Create metadata
        const metadata = {
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
    shouldStartNewChunk(currentChunk, newText, options) {
        if (!currentChunk)
            return true;
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
    adjustChunkBoundaries(chunk, analysis, options) {
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
    buildChunkRelationships(chunks) {
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
    findRelatedChunks(chunk, analysis) {
        const related = new Set();
        // Find chunks with shared characters
        this.chunks.forEach((otherChunk, id) => {
            if (chunk.id !== id) {
                // Check character overlap
                const sharedCharacters = new Set([...chunk.characters].filter(char => otherChunk.characters.has(char)));
                if (sharedCharacters.size > 0) {
                    related.add(id);
                }
                // Check location overlap
                const sharedLocations = new Set([...chunk.locations].filter(loc => otherChunk.locations.has(loc)));
                if (sharedLocations.size > 0) {
                    related.add(id);
                }
                // Check event connections
                const hasConnectedEvents = this.areEventsConnected(chunk.key_events, otherChunk.key_events);
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
    areEventsConnected(events1, events2) {
        // Implementation would check for causal or thematic connections
        // This is a simplified version
        return events1.some(e1 => events2.some(e2 => e1.toLowerCase().includes(e2.toLowerCase()) ||
            e2.toLowerCase().includes(e1.toLowerCase())));
    }
    /**
     * Checks if a chunk is relevant for a given position
     */
    isChunkRelevant(chunk, position, windowSize) {
        const chunkIndex = this.getChunkIndex(chunk);
        const targetIndex = this.getChunkIndexForPosition(position);
        return Math.abs(chunkIndex - targetIndex) <= windowSize;
    }
    /**
     * Gets the index of a chunk in the sequence
     */
    getChunkIndex(chunk) {
        let index = 0;
        for (const [id, c] of this.chunks) {
            if (id === chunk.id)
                return index;
            index++;
        }
        return -1;
    }
    /**
     * Gets the chunk index for a given position
     */
    getChunkIndexForPosition(position) {
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
    sortByRelevance(analyses, position) {
        return analyses.sort((a, b) => {
            const distanceA = Math.min(Math.abs(position - a.chunk.startPosition), Math.abs(position - a.chunk.endPosition));
            const distanceB = Math.min(Math.abs(position - b.chunk.startPosition), Math.abs(position - b.chunk.endPosition));
            return distanceA - distanceB;
        });
    }
    /**
     * Estimates token count for a text
     */
    estimateTokenCount(text) {
        // This is a simplified estimation
        // In production, you'd use a proper tokenizer
        return Math.ceil(text.length / 4);
    }
    /**
     * Checks if text represents a scene break
     */
    isSceneBreak(text) {
        return /^[\s]*[*#\-_]{3,}[\s]*$/.test(text);
    }
    /**
     * Checks if text represents a chapter break
     */
    isChapterBreak(text) {
        return /^Chapter\s+\d+/i.test(text);
    }
    /**
     * Adjusts chunk boundaries to complete sentences
     */
    adjustToCompleteSentences(chunk) {
        const doc = nlp(chunk.content);
        const sentences = doc.sentences().out('array');
        if (sentences.length > 0) {
            chunk.content = sentences.join(' ');
        }
    }
    /**
     * Adjusts chunk boundaries to preserve contextual elements
     */
    adjustForContextualElements(chunk, analysis) {
        // Implementation would ensure important narrative elements
        // aren't split across chunks
    }
    /**
     * Adds overlap with adjacent chunks
     */
    addChunkOverlap(chunk, overlapSize) {
        // Implementation would add specified amount of overlap
        // with previous and next chunks
    }
    /**
     * Extracts significant events from text
     */
    extractEvents(doc) {
        // Implementation would use NLP to identify significant events
        return [];
    }
    /**
     * Determines the timeframe of a chunk
     */
    determineTimeframe(doc) {
        // Implementation would extract and normalize temporal references
        return '';
    }
    /**
     * Extracts significant objects from text
     */
    extractSignificantObjects(doc) {
        // Implementation would identify important objects/props
        return [];
    }
    /**
     * Finds references to past events
     */
    findPastReferences(doc) {
        // Implementation would identify callbacks to earlier events
        return [];
    }
    /**
     * Finds setups for future events
     */
    findFutureSetups(doc) {
        // Implementation would identify foreshadowing and setups
        return [];
    }
    /**
     * Extracts character arc developments
     */
    extractCharacterArcs(doc, characters) {
        // Implementation would track character development
        return {};
    }
    /**
     * Identifies contextual elements in a chunk
     */
    identifyContextualElements(chunk, metadata) {
        // Implementation would identify and score important narrative elements
        return [];
    }
    /**
     * Extracts and stores contextual elements
     */
    extractContextualElements(analysis) {
        analysis.contextualElements.forEach(element => {
            this.contextualElements.set(element.name, element);
        });
    }
}
