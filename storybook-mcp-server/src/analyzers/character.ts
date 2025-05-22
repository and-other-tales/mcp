import nlp from 'compromise';
import type { Character, CharacterAnalysisResult, CharacterAppearance, ContinuityError } from '../types';
import type { NlpDocument } from '../types/nlp';
import logger from '../utils/logger';

export class CharacterAnalyzer {
  private characters = new Map<string, Character>();
  private continuityErrors: ContinuityError[] = [];
  private locationKeywords = ['in', 'at', 'inside', 'outside', 'near', 'by'];

  /**
   * Analyzes character continuity throughout the manuscript
   */
  public analyzeCharacters(text: string, mainCharacters?: string[]): CharacterAnalysisResult {
    try {
      this.characters.clear();
      this.continuityErrors = [];

      // Initialize main characters if provided
      if (mainCharacters) {
        mainCharacters.forEach(name => {
          this.characters.set(name, this.createCharacter(name));
        });
      }

      const doc = nlp(text) as unknown as NlpDocument;
      
      // Process each paragraph
      doc.paragraphs().forEach((p: unknown, index: number) => {
        const paragraph = (p as NlpDocument).text();
        this.processParagraph(paragraph, index);
      });

      // Generate final analysis
      const statistics = this.generateCharacterStatistics();
      const suggestions = this.generateCharacterSuggestions();

      return {
        characters: Array.from(this.characters.values()),
        continuityErrors: this.continuityErrors,
        statistics,
        suggestions,
      };
    } catch (error) {
      logger.error('Error in character analysis:', { error });
      throw new Error(`Failed to analyze characters: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Creates a new character record
   */
  private createCharacter(name: string): Character {
    return {
      name,
      attributes: new Map(),
      appearances: []
    };
  }

  /**
   * Processes a single paragraph for character analysis
   */
  private processParagraph(text: string, paragraphNumber: number): void {
    const doc = nlp(text);
    
    // Extract character names
    const names = this.extractCharacterNames(doc);
    const location = this.extractLocation(doc);

    names.forEach(name => {
      if (!this.characters.has(name)) {
        this.characters.set(name, this.createCharacter(name));
      }

      const character = this.characters.get(name)!;
      this.updateCharacterStatus(character, text, paragraphNumber, location);
    });

    // Check for continuity errors
    this.checkCharacterContinuity(paragraphNumber, text, names);
  }

  /**
   * Extracts character names from text
   */
  private extractCharacterNames(doc: any): string[] {
    const names = new Set<string>();
    
    // Get proper nouns that are likely character names
    doc.match('#Person+').forEach((m: any) => {
      const name = m.text().trim();
      if (this.isLikelyCharacterName(name)) {
        names.add(name);
      }
    });

    // Get pronouns and try to resolve them
    doc.match('#Pronoun').forEach((m: any) => {
      const resolvedName = this.resolvePronouns(m, doc);
      if (resolvedName) {
        names.add(resolvedName);
      }
    });

    return Array.from(names);
  }

  /**
   * Checks if a name is likely to be a character name
   */
  private isLikelyCharacterName(name: string): boolean {
    return name.length > 1 && 
           name.charAt(0).toUpperCase() === name.charAt(0) &&
           !/\d/.test(name) &&
           !this.locationKeywords.includes(name.toLowerCase());
  }

  /**
   * Attempts to resolve pronouns to character names
   */
  private resolvePronouns(pronoun: any, doc: any): string | null {
    const text = pronoun.text().toLowerCase();
    if (['he', 'his', 'him', 'she', 'her', 'hers'].includes(text)) {
      // Look for the nearest preceding proper noun
      const precedingText = doc.before(pronoun).text();
      const precedingDoc = nlp(precedingText);
      const names = precedingDoc.match('#Person+').out('array');
      return names[names.length - 1] || null;
    }
    return null;
  }

  /**
   * Extracts location information from text
   */
  private extractLocation(doc: any): string | undefined {
    for (const keyword of this.locationKeywords) {
      const matches = doc.match(`${keyword} #Place+`).out('array');
      if (matches.length > 0) {
        return matches[0].replace(keyword, '').trim();
      }
    }
    return undefined;
  }

  /**
   * Updates a character's status based on new information
   */
  private updateCharacterStatus(
    character: Character,
    text: string,
    paragraph: number,
    location?: string
  ): void {
    const appearance: CharacterAppearance = {
      paragraph,
      action: this.determineCharacterAction(text, character.name),
      location
    };

    character.appearances.push(appearance);
    character.lastMention = paragraph;
    
    if (location) {
      character.currentLocation = location;
    }

    // Update character attributes
    this.updateCharacterAttributes(character, text);
  }

  /**
   * Determines what action a character is taking in the text
   */
  private determineCharacterAction(text: string, name: string): 'enter' | 'exit' | 'mention' {
    const lowerText = text.toLowerCase();
    const exitWords = ['left', 'departed', 'exited', 'gone', 'walked away', 'walked out'];
    const enterWords = ['entered', 'arrived', 'came in', 'walked in', 'appeared'];
    
    if (exitWords.some(word => lowerText.includes(`${name.toLowerCase()} ${word}`))) {
      return 'exit';
    }
    if (enterWords.some(word => lowerText.includes(`${name.toLowerCase()} ${word}`))) {
      return 'enter';
    }
    return 'mention';
  }

  /**
   * Updates character attributes based on descriptive text
   */
  private updateCharacterAttributes(character: Character, text: string): void {
    const doc = nlp(text);
    const descriptions = doc.match(`${character.name} (is|was) #Adjective+`).out('array');
    
    descriptions.forEach((desc: string) => {
      const [_, attribute] = desc.split(/is|was/).map((s: string) => s.trim());
      if (attribute) {
        character.attributes.set('appearance', attribute);
      }
    });
  }

  /**
   * Checks for character continuity errors
   */
  private checkCharacterContinuity(
    paragraph: number,
    text: string,
    currentCharacters: string[]
  ): void {
    // Check for characters appearing without entering
    currentCharacters.forEach(name => {
      const character = this.characters.get(name)!;
      const lastAppearance = character.appearances[character.appearances.length - 2];
      
      if (lastAppearance?.action === 'exit' && 
          character.appearances[character.appearances.length - 1].action === 'mention') {
        this.addContinuityError({
          type: 'character',
          description: `${name} appears in scene without entering after previously exiting`,
          paragraph,
          severity: 'high',
          suggestion: `Add a scene showing ${name}'s return`
        });
      }
    });

    // Check for location consistency
    this.checkLocationConsistency(paragraph, currentCharacters);
  }

  /**
   * Checks for consistency in character locations
   */
  private checkLocationConsistency(paragraph: number, currentCharacters: string[]): void {
    currentCharacters.forEach(name => {
      const character = this.characters.get(name)!;
      const currentAppearance = character.appearances[character.appearances.length - 1];
      
      if (currentAppearance.location && 
          character.currentLocation && 
          currentAppearance.location !== character.currentLocation) {
        this.addContinuityError({
          type: 'character',
          description: `${name} appears in ${currentAppearance.location} but was last seen in ${character.currentLocation}`,
          paragraph,
          severity: 'medium',
          suggestion: `Add character movement between locations`
        });
      }
    });
  }

  /**
   * Adds a continuity error to the list
   */
  private addContinuityError(error: ContinuityError): void {
    this.continuityErrors.push(error);
  }

  /**
   * Generates statistics about character appearances and interactions
   */
  private generateCharacterStatistics(): any {
    const stats = {
      totalCharacters: this.characters.size,
      appearancesPerCharacter: {} as Record<string, number>,
      mostFrequentLocations: this.getMostFrequentLocations(),
      characterInteractions: this.analyzeCharacterInteractions()
    };

    this.characters.forEach((char, name) => {
      stats.appearancesPerCharacter[name] = char.appearances.length;
    });

    return stats;
  }

  /**
   * Gets the most frequently mentioned locations
   */
  private getMostFrequentLocations(): string[] {
    const locationCounts = new Map<string, number>();
    
    this.characters.forEach(char => {
      char.appearances.forEach(app => {
        if (app.location) {
          locationCounts.set(app.location, (locationCounts.get(app.location) || 0) + 1);
        }
      });
    });

    return Array.from(locationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([location]) => location);
  }

  /**
   * Analyzes character interactions
   */
  private analyzeCharacterInteractions(): Record<string, string[]> {
    const interactions: Record<string, Set<string>> = {};

    this.characters.forEach((_, name) => {
      interactions[name] = new Set();
    });

    // Group characters by paragraph to find interactions
    const paragraphGroups = new Map<number, Set<string>>();
    
    this.characters.forEach(char => {
      char.appearances.forEach(app => {
        if (!paragraphGroups.has(app.paragraph)) {
          paragraphGroups.set(app.paragraph, new Set());
        }
        paragraphGroups.get(app.paragraph)!.add(char.name);
      });
    });

    // Record interactions
    paragraphGroups.forEach(chars => {
      const charArray = Array.from(chars);
      charArray.forEach(char1 => {
        charArray.forEach(char2 => {
          if (char1 !== char2) {
            interactions[char1].add(char2);
          }
        });
      });
    });

    // Convert Sets to arrays for output
    const result: Record<string, string[]> = {};
    Object.entries(interactions).forEach(([char, ints]) => {
      result[char] = Array.from(ints);
    });

    return result;
  }

  /**
   * Generates suggestions for improving character continuity
   */
  private generateCharacterSuggestions(): string[] {
    const suggestions: string[] = [];

    // Check for underutilized characters
    const appearances = Array.from(this.characters.values())
      .map(char => ({ name: char.name, count: char.appearances.length }));
    
    const avgAppearances = appearances.reduce((sum, char) => sum + char.count, 0) / appearances.length;
    
    appearances.forEach(({ name, count }) => {
      if (count < avgAppearances / 2) {
        suggestions.push(`Consider developing ${name}'s role further (appears ${count} times vs. average ${Math.round(avgAppearances)})`);
      }
    });

    // Check for isolated characters
    const interactions = this.analyzeCharacterInteractions();
    Object.entries(interactions).forEach(([char, ints]) => {
      if (ints.length === 0) {
        suggestions.push(`${char} doesn't interact with any other characters - consider adding interactions`);
      }
    });

    return suggestions;
  }
}
