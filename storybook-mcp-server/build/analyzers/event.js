import nlp from 'compromise';
import logger from '../utils/logger';
export class EventContinuityAnalyzer {
    constructor() {
        this.events = [];
        this.continuityErrors = [];
        this.timeKeywords = ['before', 'after', 'during', 'when', 'while', 'then', 'next', 'finally'];
        this.eventKeywords = ['happened', 'occurred', 'took place', 'began', 'started', 'ended', 'finished'];
    }
    /**
     * Analyzes event continuity throughout the manuscript
     */
    analyzeEvents(text) {
        try {
            this.events = [];
            this.continuityErrors = [];
            const doc = nlp(text);
            // Process each paragraph
            doc.paragraphs().forEach((p, index) => {
                const paragraph = p.text();
                this.processEventParagraph(paragraph, index);
            });
            const eventChain = this.buildEventChain();
            const suggestions = this.generateEventSuggestions();
            return {
                events: this.events,
                continuityErrors: this.continuityErrors,
                eventChain,
                suggestions,
            };
        }
        catch (error) {
            logger.error('Error in event analysis:', { error });
            throw new Error(`Failed to analyze events: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Processes a single paragraph for events
     */
    processEventParagraph(text, paragraphNumber) {
        const doc = nlp(text);
        // Extract events based on time keywords and event verbs
        this.timeKeywords.forEach(keyword => {
            const matches = doc.match(`${keyword} .* (${this.eventKeywords.join('|')})`);
            matches.forEach((match) => {
                const eventText = match.text();
                const event = this.createEvent(eventText, paragraphNumber);
                if (event) {
                    this.events.push(event);
                }
            });
        });
        // Extract character names associated with events
        this.updateEventCharacters(doc, paragraphNumber);
        // Check for event continuity errors
        this.checkEventContinuity(paragraphNumber, text);
    }
    /**
     * Creates a new event record
     */
    createEvent(text, paragraph) {
        const doc = nlp(text);
        const location = this.extractEventLocation(doc);
        return {
            name: text,
            paragraph,
            characters: [],
            location,
            description: text,
            timestamp: this.extractTimestamp(doc)
        };
    }
    /**
     * Extracts location information for an event
     */
    extractEventLocation(doc) {
        const places = doc.places().out('array');
        return places.length > 0 ? places[0] : undefined;
    }
    /**
     * Updates character lists for events
     */
    updateEventCharacters(doc, paragraphNumber) {
        const names = doc.match('#Person+').out('array');
        const currentEvents = this.events.filter(e => e.paragraph === paragraphNumber);
        currentEvents.forEach(event => {
            event.characters = [...new Set([...event.characters, ...names])];
        });
    }
    /**
     * Extracts timestamp information from text
     */
    extractTimestamp(doc) {
        const dates = doc.dates().out('array');
        if (dates.length > 0) {
            return dates[0];
        }
        // Look for time-related phrases
        const timeMatches = doc.match('(morning|afternoon|evening|night|dawn|dusk)').out('array');
        if (timeMatches.length > 0) {
            return timeMatches[0];
        }
        return undefined;
    }
    /**
     * Checks for event continuity errors
     */
    checkEventContinuity(paragraph, text) {
        const recentEvents = this.events
            .filter(e => Math.abs(e.paragraph - paragraph) <= 5)
            .sort((a, b) => a.paragraph - b.paragraph);
        if (recentEvents.length < 2)
            return;
        // Check for logical time sequence
        for (let i = 1; i < recentEvents.length; i++) {
            const prevEvent = recentEvents[i - 1];
            const currentEvent = recentEvents[i];
            if (prevEvent.timestamp && currentEvent.timestamp) {
                const prevDate = new Date(prevEvent.timestamp);
                const currentDate = new Date(currentEvent.timestamp);
                if (prevDate > currentDate) {
                    this.addContinuityError({
                        type: 'timeline',
                        description: `Timeline inconsistency between events: "${prevEvent.name}" and "${currentEvent.name}"`,
                        paragraph,
                        severity: 'high',
                        suggestion: 'Clarify the chronological order of events'
                    });
                }
            }
        }
        // Check for location consistency
        this.checkLocationConsistency(recentEvents, paragraph);
    }
    /**
     * Checks for consistency in event locations
     */
    checkLocationConsistency(events, paragraph) {
        for (let i = 1; i < events.length; i++) {
            const prevEvent = events[i - 1];
            const currentEvent = events[i];
            if (prevEvent.location &&
                currentEvent.location &&
                prevEvent.location !== currentEvent.location) {
                // Check if any characters are in both events
                const commonCharacters = prevEvent.characters
                    .filter(char => currentEvent.characters.includes(char));
                if (commonCharacters.length > 0) {
                    this.addContinuityError({
                        type: 'event',
                        description: `Characters ${commonCharacters.join(', ')} appear in events at different locations without showing movement`,
                        paragraph,
                        severity: 'medium',
                        suggestion: 'Add scene showing character movement between locations'
                    });
                }
            }
        }
    }
    /**
     * Adds a continuity error to the list
     */
    addContinuityError(error) {
        this.continuityErrors.push(error);
    }
    /**
     * Builds the event chain for the story
     */
    buildEventChain() {
        const sequences = [];
        const timeline = [];
        const possiblePlotHoles = [];
        // Group events by location
        const eventsByLocation = new Map();
        this.events.forEach(event => {
            const location = event.location || 'unknown';
            if (!eventsByLocation.has(location)) {
                eventsByLocation.set(location, []);
            }
            eventsByLocation.get(location).push(event);
        });
        // Create sequences for each location
        eventsByLocation.forEach((events, location) => {
            const sequence = {
                events: events.map(e => e.name),
                characters: [...new Set(events.flatMap(e => e.characters))],
                location
            };
            sequences.push(sequence);
        });
        // Build timeline
        const sortedEvents = [...this.events]
            .sort((a, b) => a.paragraph - b.paragraph);
        timeline.push(...sortedEvents.map((event, index) => ({
            event: event.name,
            timestamp: event.timestamp || `Event ${index + 1}`,
            relativePosition: index
        })));
        // Identify possible plot holes
        this.identifyPlotHoles(sequences, possiblePlotHoles);
        return {
            sequences,
            timeline,
            possiblePlotHoles
        };
    }
    /**
     * Identifies potential plot holes in the story
     */
    identifyPlotHoles(sequences, plotHoles) {
        // Check for unresolved events
        const eventConnections = new Map();
        sequences.forEach(sequence => {
            sequence.events.forEach((event, index) => {
                if (index < sequence.events.length - 1) {
                    const nextEvent = sequence.events[index + 1];
                    if (!eventConnections.has(event)) {
                        eventConnections.set(event, new Set());
                    }
                    eventConnections.get(event).add(nextEvent);
                }
            });
        });
        // Look for events without consequences
        eventConnections.forEach((connections, event) => {
            if (connections.size === 0) {
                plotHoles.push(`Event "${event}" has no clear consequences or follow-up`);
            }
        });
        // Check for character consistency across sequences
        this.checkCharacterConsistencyAcrossSequences(sequences, plotHoles);
    }
    /**
     * Checks character consistency across event sequences
     */
    checkCharacterConsistencyAcrossSequences(sequences, plotHoles) {
        sequences.forEach((seq1, i) => {
            sequences.slice(i + 1).forEach(seq2 => {
                const commonCharacters = seq1.characters
                    .filter(char => seq2.characters.includes(char));
                if (commonCharacters.length > 0) {
                    const locationChange = `${seq1.location} to ${seq2.location}`;
                    if (!this.events.some(event => event.characters.some(char => commonCharacters.includes(char)) &&
                        event.description.toLowerCase().includes('travel') ||
                        event.description.toLowerCase().includes('went') ||
                        event.description.toLowerCase().includes('moved'))) {
                        plotHoles.push(`Characters ${commonCharacters.join(', ')} appear in ${locationChange} without clear travel or transition`);
                    }
                }
            });
        });
    }
    /**
     * Generates suggestions for improving event continuity
     */
    generateEventSuggestions() {
        const suggestions = [];
        // Check for event density
        const eventDensity = this.calculateEventDensity();
        if (eventDensity < 0.1) {
            suggestions.push('Consider adding more events to maintain story momentum');
        }
        else if (eventDensity > 0.5) {
            suggestions.push('Consider spacing out events to allow for character development');
        }
        // Check for timestamp usage
        const eventsWithTimestamps = this.events.filter(e => e.timestamp).length;
        if (eventsWithTimestamps < this.events.length * 0.3) {
            suggestions.push('Add more temporal markers to help readers follow the timeline');
        }
        // Check for event-character distribution
        this.checkEventCharacterDistribution(suggestions);
        return suggestions;
    }
    /**
     * Calculates event density (events per paragraph)
     */
    calculateEventDensity() {
        if (this.events.length === 0)
            return 0;
        const totalParagraphs = Math.max(...this.events.map(e => e.paragraph)) + 1;
        return this.events.length / totalParagraphs;
    }
    /**
     * Checks the distribution of characters across events
     */
    checkEventCharacterDistribution(suggestions) {
        const characterEventCounts = new Map();
        this.events.forEach(event => {
            event.characters.forEach(char => {
                characterEventCounts.set(char, (characterEventCounts.get(char) || 0) + 1);
            });
        });
        const avgEventsPerCharacter = Array.from(characterEventCounts.values()).reduce((a, b) => a + b, 0) /
            characterEventCounts.size;
        characterEventCounts.forEach((count, char) => {
            if (count < avgEventsPerCharacter / 2) {
                suggestions.push(`Character "${char}" appears in fewer events than average - consider involving them more`);
            }
        });
    }
}
