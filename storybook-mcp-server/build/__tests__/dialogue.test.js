import { DialogueAnalyzer } from '../analyzers/dialogue';
import { DIALOG_SAMPLE } from './utils';
describe('DialogueAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        analyzer = new DialogueAnalyzer();
    });
    test('analyzes dialogue successfully', () => {
        const result = analyzer.analyzeDialogue(DIALOG_SAMPLE);
        expect(result).toBeDefined();
        expect(result.dialogueSegments.length).toBeGreaterThan(0);
        expect(result.statistics).toBeDefined();
        expect(result.generalSuggestions).toBeDefined();
    });
    test('identifies speakers correctly', () => {
        const result = analyzer.analyzeDialogue(DIALOG_SAMPLE);
        const speakers = new Set(result.dialogueSegments
            .map(s => s.speaker)
            .filter(s => s !== undefined));
        expect(speakers).toContain('Sarah');
        expect(speakers).toContain('John');
        expect(speakers).toContain('Dr. Thompson');
    });
    test('calculates dialogue statistics', () => {
        const result = analyzer.analyzeDialogue(DIALOG_SAMPLE);
        expect(result.statistics.totalSegments).toBe(6);
        expect(result.statistics.segmentsPerCharacter).toBeDefined();
        expect(result.statistics.averageLength).toBeGreaterThan(0);
    });
    test('analyzes emotional tone', () => {
        const result = analyzer.analyzeDialogue(DIALOG_SAMPLE);
        result.dialogueSegments.forEach(segment => {
            expect(segment.emotionalTone).toBeDefined();
        });
    });
    test('handles focus character filtering', () => {
        const result = analyzer.analyzeDialogue(DIALOG_SAMPLE, 'Sarah');
        result.dialogueSegments.forEach(segment => {
            expect(segment.speaker === undefined || segment.speaker === 'Sarah').toBeTruthy();
        });
    });
    test('handles empty input', () => {
        const result = analyzer.analyzeDialogue('');
        expect(result.dialogueSegments).toHaveLength(0);
    });
    test('handles input without dialogue', () => {
        const result = analyzer.analyzeDialogue('This is a text without any dialogue.');
        expect(result.dialogueSegments).toHaveLength(0);
    });
});
