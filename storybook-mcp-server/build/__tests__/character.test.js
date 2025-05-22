import { CharacterAnalyzer } from '../analyzers/character';
import { SAMPLE_STORY } from './utils';
describe('CharacterAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        analyzer = new CharacterAnalyzer();
    });
    test('analyzes characters successfully', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        expect(result).toBeDefined();
        expect(result.characters.length).toBeGreaterThan(0);
        expect(result.statistics).toBeDefined();
        expect(result.suggestions).toBeDefined();
    });
    test('identifies main characters', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        const characterNames = result.characters.map(c => c.name);
        expect(characterNames).toContain('John');
        expect(characterNames).toContain('Sarah');
        expect(characterNames).toContain('Dr. Thompson');
    });
    test('tracks character appearances', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        const john = result.characters.find(c => c.name === 'John');
        expect(john).toBeDefined();
        expect(john.appearances.length).toBeGreaterThan(0);
        const firstAppearance = john.appearances[0];
        expect(firstAppearance.action).toBeDefined();
        expect(firstAppearance.location).toBeDefined();
    });
    test('calculates character statistics', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        const { statistics } = result;
        expect(statistics.totalCharacters).toBe(3);
        expect(Object.keys(statistics.appearancesPerCharacter)).toHaveLength(3);
        expect(statistics.mostFrequentLocations.length).toBeGreaterThan(0);
        expect(statistics.characterInteractions).toBeDefined();
    });
    test('detects character interactions', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        const interactions = result.statistics.characterInteractions;
        expect(interactions['John']).toContain('Sarah');
        expect(interactions['Sarah']).toContain('John');
    });
    test('identifies continuity errors', () => {
        const result = analyzer.analyzeCharacters(SAMPLE_STORY);
        expect(Array.isArray(result.continuityErrors)).toBeTruthy();
    });
    test('handles predefined main characters', () => {
        const mainCharacters = ['John', 'Sarah'];
        const result = analyzer.analyzeCharacters(SAMPLE_STORY, mainCharacters);
        const characterNames = result.characters.map(c => c.name);
        mainCharacters.forEach(name => {
            expect(characterNames).toContain(name);
        });
    });
    test('handles empty input', () => {
        const result = analyzer.analyzeCharacters('');
        expect(result.characters).toHaveLength(0);
        expect(result.continuityErrors).toHaveLength(0);
    });
    test('handles text without character names', () => {
        const result = analyzer.analyzeCharacters('The sun was shining brightly.');
        expect(result.characters).toHaveLength(0);
    });
});
