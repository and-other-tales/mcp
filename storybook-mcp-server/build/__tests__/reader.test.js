import { ReaderSimulator } from '../analyzers/reader';
import { SAMPLE_STORY } from './utils';
describe('ReaderSimulator', () => {
    let simulator;
    const youngReaderProfile = {
        age: 18,
        educationLevel: 'secondary',
        readingSpeed: 'average',
        attentionSpan: 'short',
        interests: ['science fiction', 'adventure'],
        genre_preferences: ['mystery', 'action'],
        language_proficiency: 'intermediate'
    };
    const adultReaderProfile = {
        age: 35,
        educationLevel: 'postgraduate',
        readingSpeed: 'fast',
        attentionSpan: 'long',
        interests: ['technology', 'science', 'research'],
        genre_preferences: ['thriller', 'science fiction'],
        language_proficiency: 'native'
    };
    describe('young reader simulation', () => {
        beforeEach(() => {
            simulator = new ReaderSimulator(youngReaderProfile);
        });
        test('simulates reading behavior successfully', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            expect(result).toBeDefined();
            expect(result.demographics).toEqual(youngReaderProfile);
            expect(result.reading_timeline.length).toBeGreaterThan(0);
            expect(result.engagement_summary).toBeDefined();
            expect(result.suggestions.length).toBeGreaterThan(0);
        });
        test('identifies skimming behavior', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            expect(result.reading_timeline.some(b => b.is_skimming)).toBeTruthy();
        });
        test('shows attention degradation over time', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            const firstFewAttention = result.reading_timeline
                .slice(0, 3)
                .map(b => b.attention_level);
            const lastFewAttention = result.reading_timeline
                .slice(-3)
                .map(b => b.attention_level);
            const avgFirst = firstFewAttention.reduce((a, b) => a + b, 0) / firstFewAttention.length;
            const avgLast = lastFewAttention.reduce((a, b) => a + b, 0) / lastFewAttention.length;
            expect(avgLast).toBeLessThan(avgFirst);
        });
        test('generates relevant suggestions', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            expect(result.suggestions.some(s => s.type === 'engagement')).toBeTruthy();
            expect(result.suggestions.some(s => s.type === 'complexity')).toBeTruthy();
        });
    });
    describe('adult reader simulation', () => {
        beforeEach(() => {
            simulator = new ReaderSimulator(adultReaderProfile);
        });
        test('simulates reading behavior successfully', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            expect(result).toBeDefined();
            expect(result.demographics).toEqual(adultReaderProfile);
            expect(result.reading_timeline.length).toBeGreaterThan(0);
            expect(result.engagement_summary).toBeDefined();
        });
        test('shows higher comprehension levels', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            const avgComprehension = result.reading_timeline
                .reduce((sum, b) => sum + b.comprehension_level, 0) /
                result.reading_timeline.length;
            expect(avgComprehension).toBeGreaterThan(0.7);
        });
        test('exhibits less skimming behavior', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            const skimmingBehaviors = result.reading_timeline.filter(b => b.is_skimming);
            expect(skimmingBehaviors.length).toBeLessThanOrEqual(result.reading_timeline.length * 0.2);
        });
        test('maintains better attention levels', () => {
            const result = simulator.simulateReading(SAMPLE_STORY);
            const avgAttention = result.reading_timeline
                .reduce((sum, b) => sum + b.attention_level, 0) /
                result.reading_timeline.length;
            expect(avgAttention).toBeGreaterThan(0.6);
        });
    });
    describe('edge cases', () => {
        beforeEach(() => {
            simulator = new ReaderSimulator(youngReaderProfile);
        });
        test('handles empty text', () => {
            const result = simulator.simulateReading('');
            expect(result).toBeDefined();
            expect(result.reading_timeline).toHaveLength(0);
            expect(result.engagement_summary.overall_engagement_score).toBe(0);
        });
        test('handles single paragraph', () => {
            const result = simulator.simulateReading('This is a test paragraph.');
            expect(result).toBeDefined();
            expect(result.reading_timeline).toHaveLength(1);
        });
        test('handles very complex text', () => {
            const complexText = `The quantum mechanical model of consciousness postulates 
        that coherent quantum processes in microtubules are orchestrated by synaptic 
        inputs and memory stored in microtubules, and the continuous Schrödinger 
        evolution of each quantum state terminates in accordance with the specific 
        objective threshold.`;
            const result = simulator.simulateReading(complexText);
            expect(result.reading_timeline[0].comprehension_level).toBeLessThan(0.5);
            expect(result.suggestions.some(s => s.type === 'complexity')).toBeTruthy();
        });
        test('handles highly engaging text', () => {
            const engagingText = `An incredible science fiction adventure unfolded as 
        the young heroes discovered an ancient alien technology. Their hearts raced 
        with excitement as they embarked on the thrilling journey into the unknown!`;
            const result = simulator.simulateReading(engagingText);
            expect(result.reading_timeline[0].attention_level).toBeGreaterThan(0.7);
            expect(result.engagement_summary.most_engaging_sections.length).toBeGreaterThan(0);
        });
    });
});
