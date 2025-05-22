import nlp from 'compromise';
import type { ThesaurusSuggestion, SynonymContext, NarrativeContext } from '../types';
import logger from '../utils/logger';

export class ContextualThesaurus {
  private emotionKeywords = {
    positive: ['happy', 'joyful', 'excited', 'peaceful', 'content'],
    negative: ['sad', 'angry', 'fearful', 'anxious', 'frustrated'],
    neutral: ['contemplative', 'thoughtful', 'observant', 'analytical']
  };

  private toneCategories = {
    formal: new Set(['stated', 'remarked', 'observed', 'noted', 'commented']),
    casual: new Set(['said', 'told', 'talked', 'spoke', 'mentioned']),
    emotional: new Set(['cried', 'yelled', 'whispered', 'shouted', 'murmured'])
  };

  /**
   * Finds contextually appropriate synonyms for a word or phrase
   */
  public findSynonyms(
    term: string,
    context: string,
    sceneContext?: string
  ): ThesaurusSuggestion[] {
    try {
      const narrativeContext = this.analyzeNarrativeContext(sceneContext || context);
      const termContext = this.analyzeTermContext(term, context);
      
      // Get base synonyms first
      const baseSynonyms = this.getBaseSynonyms(term);
      
      // Filter and rank synonyms based on context
      return this.rankSynonyms(baseSynonyms, termContext, narrativeContext);
    } catch (error) {
      logger.error('Error in thesaurus lookup:', { error });
      throw new Error(`Failed to find synonyms: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Analyzes the narrative context of a scene
   */
  private analyzeNarrativeContext(text: string): NarrativeContext {
    const doc = nlp(text);
    
    const emotions = this.detectEmotions(doc);
    const tone = this.detectTone(doc);
    const tense = this.detectTense(doc);
    const pov = this.detectPOV(doc);

    return {
      dominantEmotion: emotions.dominant,
      emotionalIntensity: emotions.intensity,
      tone,
      tense,
      pov
    };
  }

  /**
   * Analyzes the specific context of a term
   */
  private analyzeTermContext(term: string, context: string): SynonymContext {
    const doc = nlp(context);
    
    return {
      isDialogue: this.isInDialogue(context),
      isAction: this.isInAction(doc),
      isDescription: this.isInDescription(doc),
      grammaticalRole: this.determineGrammaticalRole(term, doc),
      subjectMatter: this.determineSubjectMatter(doc)
    };
  }

  /**
   * Gets base synonyms for a term without context
   */
  private getBaseSynonyms(term: string): string[] {
    // This would typically use a thesaurus API or database
    // For now, using a simple demonstration set
    const synonymMap: Record<string, string[]> = {
      // Action verbs
      'walked': ['strode', 'ambled', 'strolled', 'meandered', 'paced'],
      'looked': ['gazed', 'stared', 'glanced', 'peered', 'observed'],
      'said': ['stated', 'mumbled', 'whispered', 'declared', 'uttered'],
      
      // Descriptive adjectives
      'happy': ['joyful', 'elated', 'delighted', 'pleased', 'content'],
      'sad': ['melancholy', 'dejected', 'gloomy', 'downcast', 'sorrowful'],
      'angry': ['furious', 'enraged', 'irate', 'livid', 'indignant'],
      
      // Common phrases
      'looked at': ['gazed at', 'stared at', 'observed', 'examined', 'studied'],
      'walked to': ['headed to', 'moved to', 'approached', 'made way to'],
      'thought about': ['pondered', 'considered', 'contemplated', 'reflected on']
    };

    return synonymMap[term.toLowerCase()] || [];
  }

  /**
   * Ranks synonyms based on contextual appropriateness
   */
  private rankSynonyms(
    synonyms: string[],
    termContext: SynonymContext,
    narrativeContext: NarrativeContext
  ): ThesaurusSuggestion[] {
    return synonyms
      .map(synonym => ({
        word: synonym,
        contextScore: this.calculateContextScore(synonym, termContext, narrativeContext),
        usageNotes: this.generateUsageNotes(synonym, termContext, narrativeContext)
      }))
      .sort((a, b) => b.contextScore - a.contextScore);
  }

  /**
   * Calculates how appropriate a synonym is for the given context
   */
  private calculateContextScore(
    synonym: string,
    termContext: SynonymContext,
    narrativeContext: NarrativeContext
  ): number {
    let score = 1.0;

    // Adjust score based on dialogue context
    if (termContext.isDialogue) {
      score *= this.toneCategories.casual.has(synonym) ? 1.2 : 0.8;
    }

    // Adjust for emotional intensity
    if (narrativeContext.emotionalIntensity > 0.7) {
      score *= this.toneCategories.emotional.has(synonym) ? 1.3 : 0.7;
    }

    // Adjust for formal/informal tone
    if (narrativeContext.tone === 'formal') {
      score *= this.toneCategories.formal.has(synonym) ? 1.2 : 0.8;
    }

    return score;
  }

  /**
   * Generates usage notes for a synonym in the given context
   */
  private generateUsageNotes(
    synonym: string,
    termContext: SynonymContext,
    narrativeContext: NarrativeContext
  ): string {
    const notes: string[] = [];

    if (this.toneCategories.formal.has(synonym)) {
      notes.push('More formal register');
    }
    if (this.toneCategories.emotional.has(synonym)) {
      notes.push('Implies stronger emotion');
    }
    if (narrativeContext.dominantEmotion && 
        this.emotionKeywords[narrativeContext.dominantEmotion].includes(synonym)) {
      notes.push('Matches emotional tone of scene');
    }

    return notes.join('. ');
  }

  /**
   * Detects the emotional content of text
   */
  private detectEmotions(doc: any): { dominant: string; intensity: number } {
    // Implementation would use sentiment analysis
    // Returning placeholder for now
    return { dominant: 'neutral', intensity: 0.5 };
  }

  /**
   * Detects the overall tone of text
   */
  private detectTone(doc: any): 'formal' | 'casual' | 'mixed' {
    // Implementation would analyze language patterns
    // Returning placeholder for now
    return 'mixed';
  }

  /**
   * Detects the tense of text
   */
  private detectTense(doc: any): 'past' | 'present' | 'mixed' {
    // Implementation would analyze verb forms
    // Returning placeholder for now
    return 'past';
  }

  /**
   * Detects the point of view of text
   */
  private detectPOV(doc: any): 'first' | 'second' | 'third' | 'mixed' {
    // Implementation would analyze pronouns
    // Returning placeholder for now
    return 'third';
  }

  /**
   * Checks if text is within dialogue
   */
  private isInDialogue(text: string): boolean {
    return text.includes('"') || text.includes("'");
  }

  /**
   * Checks if text is describing action
   */
  private isInAction(doc: any): boolean {
    // Implementation would analyze verb patterns
    // Returning placeholder for now
    return false;
  }

  /**
   * Checks if text is descriptive
   */
  private isInDescription(doc: any): boolean {
    // Implementation would analyze adjective/adverb density
    // Returning placeholder for now
    return false;
  }

  /**
   * Determines the grammatical role of a term
   */
  private determineGrammaticalRole(term: string, doc: any): string {
    // Implementation would use POS tagging
    // Returning placeholder for now
    return 'unknown';
  }

  /**
   * Determines the subject matter of text
   */
  private determineSubjectMatter(doc: any): string {
    // Implementation would use topic modeling
    // Returning placeholder for now
    return 'general';
  }
}
