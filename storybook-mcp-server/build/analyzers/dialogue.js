import nlp from 'compromise';
import sentiment from 'sentiment';
import logger from '../utils/logger';
export class DialogueAnalyzer {
    constructor() {
        this.sentimentAnalyzer = new sentiment();
    }
    /**
     * Analyzes dialogue flow and provides suggestions for improvement
     */
    analyzeDialogue(text, focusCharacter) {
        try {
            const doc = nlp(text);
            const segments = [];
            // Extract all quotations and analyze each
            doc.quotations().forEach((quote) => {
                const segment = this.createDialogueSegment(quote, doc);
                if (segment) {
                    segments.push(segment);
                }
            });
            // Filter for focus character if specified
            const filteredSegments = focusCharacter
                ? segments.filter(s => s.speaker?.toLowerCase() === focusCharacter.toLowerCase())
                : segments;
            const statistics = this.generateStatistics(filteredSegments);
            const suggestions = this.generateSuggestions(filteredSegments);
            return {
                dialogueSegments: filteredSegments,
                statistics,
                generalSuggestions: suggestions,
            };
        }
        catch (error) {
            logger.error('Error in dialogue analysis:', { error });
            throw new Error(`Failed to analyze dialogue: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Creates a dialogue segment from a quote
     */
    createDialogueSegment(quote, doc) {
        try {
            const text = quote.text();
            const context = this.getPreviousContext(quote, doc);
            const speaker = this.identifySpeaker(context);
            const emotionalTone = this.analyzeTone(text);
            const paragraph = this.getParagraphNumber(quote);
            return {
                speaker,
                text,
                paragraph,
                emotionalTone,
                suggestions: this.generateSegmentSuggestions(text, speaker, emotionalTone),
            };
        }
        catch (error) {
            logger.warn('Error creating dialogue segment:', { error, quote: quote.text() });
            return null;
        }
    }
    /**
     * Gets the surrounding context for a quote
     */
    getPreviousContext(quote, doc) {
        const quoteParagraph = quote.parent();
        const prevParagraph = quoteParagraph.prev();
        return prevParagraph ? prevParagraph.text() : '';
    }
    /**
     * Identifies the speaker of a dialogue segment
     */
    identifySpeaker(context) {
        const doc = nlp(context);
        const possibleSpeakers = doc.match('#Person+').out('array');
        const verbs = ['said', 'asked', 'replied', 'shouted', 'whispered', 'murmured'];
        for (const speaker of possibleSpeakers) {
            for (const verb of verbs) {
                if (context.includes(`${speaker} ${verb}`)) {
                    return speaker;
                }
            }
        }
        return possibleSpeakers[possibleSpeakers.length - 1];
    }
    /**
     * Analyzes the emotional tone of dialogue
     */
    analyzeTone(text) {
        const result = this.sentimentAnalyzer.analyze(text);
        if (result.score > 2)
            return 'very positive';
        if (result.score > 0)
            return 'positive';
        if (result.score < -2)
            return 'very negative';
        if (result.score < 0)
            return 'negative';
        return 'neutral';
    }
    /**
     * Gets the paragraph number for a quote
     */
    getParagraphNumber(quote) {
        const doc = quote.document;
        const paragraphs = doc.paragraphs().data();
        const quoteParagraph = quote.parent().text();
        return paragraphs.findIndex((p) => p.text.includes(quoteParagraph));
    }
    /**
     * Generates suggestions for a dialogue segment
     */
    generateSegmentSuggestions(text, speaker, tone) {
        const suggestions = [];
        // Check dialogue length
        if (text.length > 200) {
            suggestions.push('Consider breaking this long dialogue into smaller segments');
        }
        // Check for dialogue tags
        if (!speaker) {
            suggestions.push('Add dialogue attribution to clarify the speaker');
        }
        // Check for overused words
        const words = text.toLowerCase().split(/\W+/);
        const wordCount = words.reduce((acc, word) => {
            acc[word] = (acc[word] || 0) + 1;
            return acc;
        }, {});
        Object.entries(wordCount).forEach(([word, count]) => {
            if (count > 3 && word.length > 3) {
                suggestions.push(`Consider varying the use of "${word}" (used ${count} times)`);
            }
        });
        return suggestions;
    }
    /**
     * Generates statistics for dialogue segments
     */
    generateStatistics(segments) {
        const speakerCounts = {};
        let totalLength = 0;
        const toneDistribution = {};
        segments.forEach(segment => {
            if (segment.speaker) {
                speakerCounts[segment.speaker] = (speakerCounts[segment.speaker] || 0) + 1;
            }
            totalLength += segment.text.length;
            toneDistribution[segment.emotionalTone] = (toneDistribution[segment.emotionalTone] || 0) + 1;
        });
        return {
            totalSegments: segments.length,
            segmentsPerCharacter: speakerCounts,
            averageLength: totalLength / segments.length,
            emotionalToneDistribution: toneDistribution,
        };
    }
    /**
     * Generates general suggestions for dialogue improvement
     */
    generateSuggestions(segments) {
        const suggestions = [];
        // Check dialogue distribution
        const speakerCount = Object.keys(this.generateStatistics(segments).segmentsPerCharacter).length;
        if (speakerCount === 1) {
            suggestions.push('Consider adding more character interactions through dialogue');
        }
        // Check emotional variety
        const toneDistribution = this.generateStatistics(segments).emotionalToneDistribution;
        if (Object.keys(toneDistribution).length < 3) {
            suggestions.push('Consider varying the emotional tone of dialogue more');
        }
        // Check dialogue density
        if (segments.length > 20) {
            const averageGap = this.calculateAverageDialogueGap(segments);
            if (averageGap < 2) {
                suggestions.push('Consider adding more narrative between dialogue exchanges');
            }
        }
        return suggestions;
    }
    /**
     * Calculates the average gap between dialogue segments
     */
    calculateAverageDialogueGap(segments) {
        let totalGap = 0;
        let gapCount = 0;
        for (let i = 1; i < segments.length; i++) {
            const gap = segments[i].paragraph - segments[i - 1].paragraph;
            if (gap > 0) {
                totalGap += gap;
                gapCount++;
            }
        }
        return gapCount > 0 ? totalGap / gapCount : 0;
    }
}
