import { RepetitionAnalyzer } from '../analyzers/repetition';
const REPETITION_SAMPLE = `John walked to the store.He walked slowly, thinking about his day.
Sarah also walked to the store that morning. The morning was bright and clear.
John thought about his conversation with Sarah. He had been thinking about it all day.
The bright morning sun shone down as John walked home.`;
describe('RepetitionAnalyzer', () => {
    let analyzer;
    beforeEach(() => {
        analyzer = new RepetitionAnalyzer();
    });
    test('analyzes repetitions successfully', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        expect(result).toBeDefined();
        expect(result.repeatedWords).toBeDefined();
        expect(result.repeatedPhrases).toBeDefined();
        expect(result.statistics).toBeDefined();
    });
    test('identifies repeated words', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        const words = result.repeatedWords.map((w) => w.term);
        expect(words).toContain('walked');
        expect(words).toContain('morning');
    });
    test('counts word frequencies correctly', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        const walked = result.repeatedWords.find(w => w.term === 'walked');
        expect(walked).toBeDefined();
        expect(walked.count).toBe(4);
    });
    test('identifies repeated phrases', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        const phrases = result.repeatedPhrases.map(p => p.term);
        expect(phrases).toContain('walked to');
    });
    test('provides context for repetitions', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        result.repeatedWords.forEach(word => {
            expect(word.contexts.length).toBe(word.count);
            word.contexts.forEach(context => {
                expect(context.before).toBeDefined();
                expect(context.term).toBeDefined();
                expect(context.after).toBeDefined();
            });
        });
    });
    test('calculates statistics', () => {
        const result = analyzer.analyzeRepetitions(REPETITION_SAMPLE);
        expect(result.statistics.totalRepetitions).toBeGreaterThan(0);
        expect(result.statistics.mostFrequentWord).toBeDefined();
    });
    test('handles empty input', () => {
        const result = analyzer.analyzeRepetitions('');
        expect(result.repeatedWords).toHaveLength(0);
        expect(result.repeatedPhrases).toHaveLength(0);
    });
    test('ignores common stop words', () => {
        const result = analyzer.analyzeRepetitions('The the the and and and');
        expect(result.repeatedWords).toHaveLength(0);
    });
});
