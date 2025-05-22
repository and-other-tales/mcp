import nlp from 'compromise';
import logger from '../utils/logger';
export class RepetitionAnalyzer {
    constructor() {
        this.minRepetitions = 3;
        this.minPhraseLength = 2;
        this.maxPhraseLength = 5;
        this.contextWindowSize = 50; // characters before/after for context
    }
    /**
     * Analyzes word and phrase repetitions in the manuscript
     */
    analyzeRepetitions(text) {
        try {
            const doc = nlp(text);
            const words = this.findRepeatedWords(doc);
            const phrases = this.findRepeatedPhrases(doc);
            return {
                repeatedWords: this.buildRepetitionInstances(words, text),
                repeatedPhrases: this.buildRepetitionInstances(phrases, text),
                statistics: {
                    totalRepetitions: words.size + phrases.size,
                    mostFrequentWord: this.getMostFrequent(words),
                    mostFrequentPhrase: this.getMostFrequent(phrases)
                }
            };
        }
        catch (error) {
            logger.error('Error in repetition analysis:', { error });
            throw new Error(`Failed to analyze repetitions: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Finds words that are repeated more than the minimum threshold
     */
    findRepeatedWords(doc) {
        const wordCounts = new Map();
        doc.terms().forEach((term) => {
            const word = term.text().toLowerCase();
            if (this.isSignificantWord(word)) {
                wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
            }
        });
        return new Map([...wordCounts.entries()]
            .filter(([_, count]) => count >= this.minRepetitions)
            .sort((a, b) => b[1] - a[1]));
    }
    /**
     * Finds phrases that are repeated more than the minimum threshold
     */
    findRepeatedPhrases(doc) {
        const phraseCounts = new Map();
        // Look for phrases of different lengths
        for (let length = this.minPhraseLength; length <= this.maxPhraseLength; length++) {
            const phrases = this.extractPhrases(doc, length);
            phrases.forEach(phrase => {
                if (this.isSignificantPhrase(phrase)) {
                    phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
                }
            });
        }
        return new Map([...phraseCounts.entries()]
            .filter(([_, count]) => count >= this.minRepetitions)
            .sort((a, b) => b[1] - a[1]));
    }
    /**
     * Extracts phrases of a specific length from the document
     */
    extractPhrases(doc, length) {
        const phrases = [];
        const terms = doc.terms().out('array');
        for (let i = 0; i <= terms.length - length; i++) {
            const phrase = terms.slice(i, i + length).join(' ').toLowerCase();
            phrases.push(phrase);
        }
        return phrases;
    }
    /**
     * Builds detailed repetition instances with context
     */
    buildRepetitionInstances(repetitions, text) {
        return Array.from(repetitions.entries()).map(([term, count]) => {
            const contexts = this.findContexts(text, term);
            return {
                term,
                count,
                contexts,
                isPhrase: term.includes(' ')
            };
        });
    }
    /**
     * Finds all contexts where a term appears in the text
     */
    findContexts(text, term) {
        const contexts = [];
        const lowerText = text.toLowerCase();
        const lowerTerm = term.toLowerCase();
        let lastIndex = 0;
        while ((lastIndex = lowerText.indexOf(lowerTerm, lastIndex)) !== -1) {
            const start = Math.max(0, lastIndex - this.contextWindowSize);
            const end = Math.min(text.length, lastIndex + term.length + this.contextWindowSize);
            contexts.push({
                before: text.slice(start, lastIndex).trim(),
                term: text.slice(lastIndex, lastIndex + term.length),
                after: text.slice(lastIndex + term.length, end).trim(),
                position: lastIndex
            });
            lastIndex += term.length;
        }
        return contexts;
    }
    /**
     * Checks if a word is significant enough to track
     */
    isSignificantWord(word) {
        // Ignore common articles, prepositions, etc.
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with']);
        return word.length > 2 && !stopWords.has(word);
    }
    /**
     * Checks if a phrase is significant enough to track
     */
    isSignificantPhrase(phrase) {
        // Ignore phrases that are all stop words
        return phrase.split(' ').some(word => this.isSignificantWord(word));
    }
    /**
     * Gets the most frequently occurring term
     */
    getMostFrequent(repetitions) {
        if (repetitions.size === 0)
            return null;
        const [term, count] = [...repetitions.entries()][0];
        return { term, count };
    }
}
