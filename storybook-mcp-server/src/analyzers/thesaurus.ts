import nlp from 'compromise';
import type { ThesaurusSuggestion, SynonymContext, NarrativeContext, EmotionTone } from '../types/thesaurus';
import logger from '../utils/logger';

export class ContextualThesaurus {
  private emotionKeywords: Record<EmotionTone, string[]> = {
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

    return {
      genre: 'narrative',
      perspective: this.detectPerspective(doc),
      timeframe: this.detectTimeframe(doc),
      style: 'standard',
      dominantEmotion: emotions.dominant
    };
  }

  /**
   * Analyzes the specific context of a term
   */
  private analyzeTermContext(term: string, context: string): SynonymContext {
    const doc = nlp(context);
    const emotions = this.detectEmotions(doc);
    
    return {
      tone: emotions.dominant,
      intensity: emotions.intensity,
      formality: this.detectFormality(doc)
    };
  }

  private detectPerspective(doc: any): 'first-person' | 'third-person' {
    // Simple POV detection
    if (doc.match('I|me|my|we|our').length > 0) {
      return 'first-person';
    }
    return 'third-person';
  }

  private detectTimeframe(doc: any): 'historical' | 'contemporary' | 'future' {
    // Simple timeframe detection based on verb tenses and time markers
    if (doc.match('will|future|tomorrow|next|soon').length > 0) {
      return 'future';
    }
    if (doc.match('past|yesterday|ago|before|ancient|historical').length > 0) {
      return 'historical';
    }
    return 'contemporary';
  }

  private detectFormality(doc: any): 'formal' | 'informal' {
    // Simple formality detection
    const informalMarkers = doc.match('gonna|wanna|like|yeah|hey|cool').length;
    const formalMarkers = doc.match('shall|whom|therefore|indeed|nevertheless').length;
    
    return formalMarkers > informalMarkers ? 'formal' : 'informal';
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
    return synonyms.map(word => ({
      word,
      synonyms: this.getBaseSynonyms(word),
      context: {
        tone: termContext.tone,
        intensity: termContext.intensity,
        formality: termContext.formality
      },
      narrativeContext: {
        genre: narrativeContext.genre,
        perspective: narrativeContext.perspective,
        timeframe: narrativeContext.timeframe,
        style: narrativeContext.style,
        dominantEmotion: narrativeContext.dominantEmotion
      }
    }));
  }

  /**
   * Detects the emotional content of text
   */
  private detectEmotions(doc: any): { dominant: EmotionTone; intensity: number } {
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
