import { ContextualThesaurus } from '../analyzers/thesaurus';

describe('ContextualThesaurus', () => {
  let thesaurus: ContextualThesaurus;

  beforeEach(() => {
    thesaurus = new ContextualThesaurus();
  });

  test('finds synonyms with context', () => {
    const result = thesaurus.findSynonyms(
      'walked',
      'John walked slowly down the street',
      'It was a peaceful afternoon as John made his way through town.'
    );
    
    expect(result.length).toBeGreaterThan(0);
    result.forEach(suggestion => {
      expect(suggestion.word).toBeDefined();
      expect(suggestion.contextScore).toBeGreaterThan(0);
      expect(suggestion.usageNotes).toBeDefined();
    });
  });

  test('ranks synonyms by context appropriateness', () => {
    const result = thesaurus.findSynonyms(
      'said',
      '"I don\'t know," he said angrily.',
      'The argument was getting heated.'
    );
    
    // Emotional context should prioritize emotional synonyms
    const scores = result.map(r => r.contextScore);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  test('handles dialogue context', () => {
    const result = thesaurus.findSynonyms(
      'said',
      '"Hello," she said with a smile.',
      'A friendly conversation was taking place.'
    );
    
    expect(result.some(r => r.usageNotes.includes('formal'))).toBeTruthy();
  });

  test('considers narrative tone', () => {
    const result = thesaurus.findSynonyms(
      'walked',
      'The diplomat walked through the grand hall.',
      'The formal reception was attended by various dignitaries.'
    );
    
    expect(result.some(r => r.usageNotes.includes('formal'))).toBeTruthy();
  });

  test('handles empty context', () => {
    const result = thesaurus.findSynonyms('happy', '', '');
    expect(result.length).toBeGreaterThan(0);
  });

  test('handles unknown words', () => {
    const result = thesaurus.findSynonyms('xyzabc', 'Unknown word in a sentence', '');
    expect(result).toHaveLength(0);
  });

  test('provides meaningful usage notes', () => {
    const result = thesaurus.findSynonyms(
      'angry',
      'He was angry about the situation.',
      'The tension in the room was palpable.'
    );
    
    result.forEach(suggestion => {
      expect(suggestion.usageNotes.length).toBeGreaterThan(0);
    });
  });
});
