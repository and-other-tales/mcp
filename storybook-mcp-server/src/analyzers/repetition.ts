import nlp from 'compromise';
import type { RepetitionAnalysisResult, RepetitionInstance, PhraseContext } from '../types/repetition';
import logger from '../utils/logger';

export class RepetitionAnalyzer {
  private minRepetitions = 3;
  private minPhraseLength = 2;
  private maxPhraseLength = 5;
  private contextWindowSize = 50; // characters before/after for context

  /**
   * Analyzes word and phrase repetitions in the manuscript
   */
  public analyzeRepetitions(text: string): RepetitionAnalysisResult {
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
    } catch (error) {
      logger.error('Error in repetition analysis:', { error });
      throw new Error(`Failed to analyze repetitions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Finds words that are repeated more than the minimum threshold
   */
  private findRepeatedWords(doc: any): Map<string, number> {
    const wordCounts = new Map<string, number>();
    
    doc.terms().forEach((term: any) => {
      const word = term.text().toLowerCase();
      if (this.isSignificantWord(word)) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    });

    return new Map(
      [...wordCounts.entries()]
        .filter(([_, count]) => count >= this.minRepetitions)
        .sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Finds phrases that are repeated more than the minimum threshold
   */
  private findRepeatedPhrases(doc: any): Map<string, number> {
    const phraseCounts = new Map<string, number>();
    
    // Look for phrases of different lengths
    for (let length = this.minPhraseLength; length <= this.maxPhraseLength; length++) {
      const phrases = this.extractPhrases(doc, length);
      phrases.forEach(phrase => {
        if (this.isSignificantPhrase(phrase)) {
          phraseCounts.set(phrase, (phraseCounts.get(phrase) || 0) + 1);
        }
      });
    }

    return new Map(
      [...phraseCounts.entries()]
        .filter(([_, count]) => count >= this.minRepetitions)
        .sort((a, b) => b[1] - a[1])
    );
  }

  /**
   * Extracts phrases of a specific length from the document
   */
  private extractPhrases(doc: any, length: number): string[] {
    const phrases: string[] = [];
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
  private buildRepetitionInstances(
    repetitions: Map<string, number>,
    text: string
  ): RepetitionInstance[] {
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
  private findContexts(text: string, term: string): PhraseContext[] {
    const contexts: PhraseContext[] = [];
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
  private isSignificantWord(word: string): boolean {
    // Ignore common articles, prepositions, etc.
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with']);
    return word.length > 2 && !stopWords.has(word);
  }

  /**
   * Checks if a phrase is significant enough to track
   */
  private isSignificantPhrase(phrase: string): boolean {
    // Ignore phrases that are all stop words
    return phrase.split(' ').some(word => this.isSignificantWord(word));
  }

  /**
   * Gets the most frequently occurring term
   */
  private getMostFrequent(repetitions: Map<string, number>): { term: string; count: number } | null {
    if (repetitions.size === 0) return null;
    
    const [term, count] = [...repetitions.entries()][0];
    return { term, count };
  }
}
