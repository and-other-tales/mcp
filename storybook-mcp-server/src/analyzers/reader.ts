import nlp from 'compromise';
import { ReaderDemographics, ReadingBehavior, EngagementMarker, ReaderSimulationResult } from '../types/reader';
import { NlpDocument } from '../types/nlp';
import logger from '../utils/logger';

export class ReaderSimulator {
  private static readonly AVG_READING_SPEEDS = {
    slow: 150,      // words per minute
    average: 250,   // words per minute
    fast: 400       // words per minute
  };

  private static readonly ATTENTION_SPAN_DURATIONS = {
    short: 10,      // minutes
    medium: 25,     // minutes
    long: 45        // minutes
  };

  private static readonly COMPLEXITY_THRESHOLDS = {
    basic: 0.3,
    intermediate: 0.6,
    advanced: 0.8,
    native: 1.0
  };

  private demographics: ReaderDemographics;
  private readingBehaviors: ReadingBehavior[] = [];
  private currentTime = 0;
  private fatigueLevel = 0;
  private lastInterestSpike = 0;

  constructor(demographics: ReaderDemographics) {
    this.demographics = demographics;
  }

  /**
   * Simulates a human reader going through the manuscript
   */
  public simulateReading(text: string): ReaderSimulationResult {
    try {
      this.readingBehaviors = [];
      this.currentTime = 0;
      this.fatigueLevel = 0;
        const doc = nlp(text) as unknown as NlpDocument;
      const paragraphs = doc.paragraphs().map((p: NlpDocument) => p.text());
      
      let currentParagraph = 0;
      let isSkimming = false;
      let skimmingStartParagraph = -1;
      
      // Process each paragraph with the simulated reader's characteristics
      paragraphs.forEach((paragraph: string, index: number) => {
        const complexity = this.calculateTextComplexity(paragraph);
        const relevance = this.calculateRelevance(paragraph);
        const emotionalImpact = this.calculateEmotionalImpact(paragraph);
        
        // Update reader state
        this.updateReaderState(complexity, relevance, emotionalImpact);
        
        // Determine if reader starts/stops skimming
        const shouldSkim = this.shouldStartSkimming(complexity, relevance);
        if (shouldSkim && !isSkimming) {
          isSkimming = true;
          skimmingStartParagraph = index;
          this.addEngagementMarker({
            type: 'skimming_start',
            paragraph_number: index,
            intensity: this.fatigueLevel,
            reason: 'Low engagement and high fatigue'
          });
        } else if (!shouldSkim && isSkimming) {
          isSkimming = false;
          this.addEngagementMarker({
            type: 'skimming_end',
            paragraph_number: index,
            intensity: this.fatigueLevel,
            reason: 'Engagement recovered'
          });
        }
        
        // Calculate reading speed based on conditions
        const readingSpeed = this.calculateReadingSpeed(
          complexity,
          isSkimming,
          this.fatigueLevel
        );
        
        // Calculate attention and comprehension
        const attentionLevel = this.calculateAttentionLevel(
          complexity,
          relevance,
          this.fatigueLevel
        );
        
        const comprehensionLevel = this.calculateComprehensionLevel(
          complexity,
          attentionLevel,
          isSkimming
        );
        
        // Add reading behavior for this paragraph
        this.readingBehaviors.push({
          elapsed_time: this.currentTime,
          paragraph_number: index,
          attention_level: attentionLevel,
          comprehension_level: comprehensionLevel,
          is_skimming: isSkimming,
          reading_speed_wpm: readingSpeed,
          engagement_markers: []
        });
        
        // Update time based on paragraph length and reading speed
        const wordCount = paragraph.split(' ').length;
        this.currentTime += (wordCount / readingSpeed) * 60; // Convert to seconds
      });
      
      // Generate final analysis
      return this.generateReadingAnalysis(paragraphs.length);
      
    } catch (error) {
      logger.error('Error in reader simulation:', { error });
      throw new Error(`Failed to simulate reading: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Calculates text complexity based on sentence structure, vocabulary, etc.
   */
  private calculateTextComplexity(text: string): number {
    const doc = nlp(text);
    
    // Analyze sentence complexity
    const sentenceLength = doc.sentences().length;
    const wordCount = text.split(' ').length;
    const avgWordsPerSentence = wordCount / Math.max(1, sentenceLength);
    
    // Analyze vocabulary complexity
    const uniqueWords = new Set(text.toLowerCase().match(/\b\w+\b/g) || []);
    const vocabularyComplexity = uniqueWords.size / wordCount;
    
    // Consider advanced grammar structures
    const subordinateClauses = (text.match(/(?:because|although|if|while|unless|since|when|that|which|who)/gi) || []).length;
    const complexityScore = (
      (avgWordsPerSentence / 35) +         // Normalize by typical max
      (vocabularyComplexity) +             // Already normalized
      (subordinateClauses / 10)            // Normalize by typical max
    ) / 3;                                 // Average the components
    
    return Math.min(1, Math.max(0, complexityScore));
  }

  /**
   * Calculates how relevant the content is to the reader's interests
   */
  private calculateRelevance(text: string): number {
    const lowerText = text.toLowerCase();
    
    // Count matches with reader's interests
    const interestMatches = this.demographics.interests.filter(interest => 
      lowerText.includes(interest.toLowerCase())
    ).length;
    
    // Count matches with preferred genres
    const genreMatches = this.demographics.genre_preferences.filter(genre =>
      lowerText.includes(genre.toLowerCase())
    ).length;
    
    const relevanceScore = (
      (interestMatches / Math.max(1, this.demographics.interests.length)) +
      (genreMatches / Math.max(1, this.demographics.genre_preferences.length))
    ) / 2;
    
    return Math.min(1, Math.max(0, relevanceScore));
  }

  /**
   * Calculates emotional impact of the text
   */
  private calculateEmotionalImpact(text: string): number {
    const doc = nlp(text);
    
    // Look for emotional language
    const emotionalWords = doc.match('#Emotion').length;
    const wordCount = text.split(' ').length;
    
    // Look for exclamations and intense punctuation
    const exclamations = (text.match(/!|\?|\.{3}/g) || []).length;
    
    // Look for intensifiers
    const intensifiers = doc.match('very|really|extremely|absolutely').length;
    
    const emotionalScore = (
      (emotionalWords / Math.max(1, wordCount)) +
      (exclamations / Math.max(1, wordCount) * 2) +
      (intensifiers / Math.max(1, wordCount))
    ) / 4;
    
    return Math.min(1, Math.max(0, emotionalScore));
  }

  /**
   * Updates the reader's state based on text properties
   */
  private updateReaderState(complexity: number, relevance: number, emotionalImpact: number): void {
    // Update fatigue
    const attentionSpanMinutes = ReaderSimulator.ATTENTION_SPAN_DURATIONS[this.demographics.attentionSpan];
    const timeFactor = Math.min(1, (this.currentTime / 60) / attentionSpanMinutes);
    const complexityFactor = complexity * (1 - ReaderSimulator.COMPLEXITY_THRESHOLDS[this.demographics.language_proficiency]);
    
    this.fatigueLevel = Math.min(1, this.fatigueLevel + (
      (timeFactor * 0.1) +         // Time-based fatigue
      (complexityFactor * 0.2) -    // Complexity-based fatigue
      (relevance * 0.15) -         // Interest reduces fatigue
      (emotionalImpact * 0.1)      // Emotional engagement reduces fatigue
    ));
    
    // Reset fatigue partially on high interest
    if (relevance > 0.7 || emotionalImpact > 0.7) {
      this.fatigueLevel = Math.max(0, this.fatigueLevel - 0.3);
      this.lastInterestSpike = this.currentTime;
    }
  }

  /**
   * Determines if the reader should start skimming
   */
  private shouldStartSkimming(complexity: number, relevance: number): boolean {
    const proficiencyThreshold = ReaderSimulator.COMPLEXITY_THRESHOLDS[this.demographics.language_proficiency];
    
    return (
      (this.fatigueLevel > 0.7) ||                         // Too tired
      (complexity > proficiencyThreshold * 1.5) ||         // Too complex
      (relevance < 0.2 && this.fatigueLevel > 0.4) ||     // Uninteresting and somewhat tired
      (this.currentTime - this.lastInterestSpike > 600)    // No interesting content for 10 minutes
    );
  }

  /**
   * Calculates reading speed based on conditions
   */
  private calculateReadingSpeed(complexity: number, isSkimming: boolean, fatigue: number): number {
    const baseSpeed = ReaderSimulator.AVG_READING_SPEEDS[this.demographics.readingSpeed];
    
    let adjustedSpeed = baseSpeed;
    
    // Adjust for complexity
    adjustedSpeed *= (1 - (complexity * 0.5));
    
    // Adjust for skimming
    if (isSkimming) {
      adjustedSpeed *= 2.5;
    }
    
    // Adjust for fatigue
    adjustedSpeed *= (1 - (fatigue * 0.3));
    
    return Math.max(50, Math.min(1000, adjustedSpeed));
  }

  /**
   * Calculates attention level based on various factors
   */
  private calculateAttentionLevel(complexity: number, relevance: number, fatigue: number): number {
    const proficiencyFactor = ReaderSimulator.COMPLEXITY_THRESHOLDS[this.demographics.language_proficiency];
    const complexityImpact = Math.max(0, 1 - (complexity / proficiencyFactor));
    
    const attentionLevel = (
      (1 - fatigue) * 0.4 +          // Fatigue impact
      relevance * 0.4 +              // Interest impact
      complexityImpact * 0.2         // Complexity impact
    );
    
    return Math.min(1, Math.max(0, attentionLevel));
  }

  /**
   * Calculates comprehension level based on various factors
   */
  private calculateComprehensionLevel(complexity: number, attention: number, isSkimming: boolean): number {
    const proficiencyFactor = ReaderSimulator.COMPLEXITY_THRESHOLDS[this.demographics.language_proficiency];
    const baseComprehension = Math.max(0, 1 - (complexity / proficiencyFactor));
    
    let comprehensionLevel = baseComprehension * attention;
    
    // Reduce comprehension while skimming
    if (isSkimming) {
      comprehensionLevel *= 0.4;
    }
    
    return Math.min(1, Math.max(0, comprehensionLevel));
  }

  /**
   * Adds an engagement marker to the current reading behavior
   */
  private addEngagementMarker(marker: EngagementMarker): void {
    if (this.readingBehaviors.length > 0) {
      this.readingBehaviors[this.readingBehaviors.length - 1].engagement_markers.push(marker);
    }
  }

  /**
   * Generates final reading analysis
   */
  private generateReadingAnalysis(totalParagraphs: number): ReaderSimulationResult {
    // Find engaging and non-engaging sections
    const sections = this.findEngagementSections();
    
    // Calculate overall metrics
    const overallEngagement = this.calculateOverallEngagement();
    const completionRate = this.calculateCompletionRate(totalParagraphs);
    const averageComprehension = this.calculateAverageComprehension();
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(sections, overallEngagement);
    
    return {
      demographics: this.demographics,
      reading_timeline: this.readingBehaviors,
      engagement_summary: {
        most_engaging_sections: sections.engaging,
        least_engaging_sections: sections.nonEngaging,
        skimmed_sections: sections.skimmed,
        overall_engagement_score: overallEngagement,
        reading_completion_rate: completionRate,
        average_comprehension: averageComprehension
      },
      suggestions
    };
  }

  /**
   * Finds sections with different engagement levels
   */
  private findEngagementSections() {
    const engaging: ReaderSimulationResult['engagement_summary']['most_engaging_sections'] = [];
    const nonEngaging: ReaderSimulationResult['engagement_summary']['least_engaging_sections'] = [];
    const skimmed: ReaderSimulationResult['engagement_summary']['skimmed_sections'] = [];
    
    let currentSection = {
      start: 0,
      engagement: this.readingBehaviors[0]?.attention_level || 0,
      isSkimming: this.readingBehaviors[0]?.is_skimming || false
    };
    
    this.readingBehaviors.forEach((behavior, index) => {
      // Check for engagement level changes
      if (
        Math.abs(behavior.attention_level - currentSection.engagement) > 0.3 ||
        behavior.is_skimming !== currentSection.isSkimming ||
        index === this.readingBehaviors.length - 1
      ) {
        // Add completed section to appropriate list
        const section = {
          start_paragraph: currentSection.start,
          end_paragraph: index,
          engagement_score: currentSection.engagement,
          reason: this.getEngagementReason(currentSection.engagement, currentSection.isSkimming)
        };
        
        if (currentSection.isSkimming) {
          skimmed.push({
            start_paragraph: section.start_paragraph,
            end_paragraph: section.end_paragraph,
            reason: section.reason
          });
        } else if (currentSection.engagement > 0.7) {
          engaging.push(section);
        } else if (currentSection.engagement < 0.4) {
          nonEngaging.push(section);
        }
        
        // Start new section
        currentSection = {
          start: index,
          engagement: behavior.attention_level,
          isSkimming: behavior.is_skimming
        };
      }
    });
    
    return { engaging, nonEngaging, skimmed };
  }

  /**
   * Gets a description of why a section had its engagement level
   */
  private getEngagementReason(engagement: number, isSkimming: boolean): string {
    if (isSkimming) {
      return 'Reader began skimming due to low engagement or high fatigue';
    } else if (engagement > 0.7) {
      return 'Strong emotional resonance and relevance to reader interests';
    } else if (engagement < 0.4) {
      return 'Content complexity or lack of connection to reader interests';
    }
    return 'Moderate engagement with content';
  }

  /**
   * Calculates overall engagement score
   */
  private calculateOverallEngagement(): number {
    const engagementScores = this.readingBehaviors.map(b => 
      b.attention_level * (b.is_skimming ? 0.3 : 1)
    );
    
    return engagementScores.reduce((a, b) => a + b, 0) / engagementScores.length;
  }

  /**
   * Calculates reading completion rate
   */
  private calculateCompletionRate(totalParagraphs: number): number {
    const skimmedWeight = 0.3;
    let effectiveParagraphs = 0;
    
    this.readingBehaviors.forEach(behavior => {
      effectiveParagraphs += behavior.is_skimming ? skimmedWeight : 1;
    });
    
    return effectiveParagraphs / totalParagraphs;
  }

  /**
   * Calculates average comprehension level
   */
  private calculateAverageComprehension(): number {
    return this.readingBehaviors.reduce((sum, b) => sum + b.comprehension_level, 0) / 
           this.readingBehaviors.length;
  }

  /**
   * Generates improvement suggestions based on reading analysis
   */
  private generateSuggestions(
    sections: {
      engaging: ReaderSimulationResult['engagement_summary']['most_engaging_sections'];
      nonEngaging: ReaderSimulationResult['engagement_summary']['least_engaging_sections'];
      skimmed: ReaderSimulationResult['engagement_summary']['skimmed_sections'];
    },
    overallEngagement: number
  ): ReaderSimulationResult['suggestions'] {
    const suggestions: ReaderSimulationResult['suggestions'] = [];
    
    // Check for long non-engaging sections
    sections.nonEngaging
      .filter(section => (section.end_paragraph - section.start_paragraph) > 5)
      .forEach(section => {
        suggestions.push({
          type: 'engagement',
          target_paragraph_range: [section.start_paragraph, section.end_paragraph],
          suggestion: 'Consider adding more emotional resonance or relevant content to maintain reader interest',
          priority: 'high'
        });
      });
    
    // Check for complexity issues in skimmed sections
    sections.skimmed.forEach(section => {
      suggestions.push({
        type: 'complexity',
        target_paragraph_range: [section.start_paragraph, section.end_paragraph],
        suggestion: 'Simplify language or break down complex ideas to prevent reader fatigue',
        priority: 'medium'
      });
    });
    
    // Check overall pacing
    if (sections.engaging.length < sections.nonEngaging.length) {
      suggestions.push({
        type: 'pacing',
        suggestion: 'Increase the frequency of engaging elements throughout the text',
        priority: 'high'
      });
    }
    
    // Check for structural issues
    if (overallEngagement < 0.5) {
      suggestions.push({
        type: 'structure',
        suggestion: 'Consider restructuring to lead with more engaging content and maintain momentum',
        priority: 'high'
      });
    }
    
    return suggestions;
  }
}
