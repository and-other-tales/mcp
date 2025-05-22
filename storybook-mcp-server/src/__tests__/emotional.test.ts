import { EmotionalAnalyzer } from '../analyzers/emotional';
import { EMOTIONAL_SAMPLE } from './utils';

describe('EmotionalAnalyzer', () => {
  let analyzer: EmotionalAnalyzer;

  beforeEach(() => {
    analyzer = new EmotionalAnalyzer();
  });

  test('analyzes emotions successfully', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE);
    expect(result).toBeDefined();
    expect(result.scenes.length).toBeGreaterThan(0);
    expect(result.emotionalArc).toBeDefined();
    expect(result.pacingSuggestions).toBeDefined();
  });

  test('identifies emotional high points', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE);
    const { emotionalHighPoints } = result;
    
    expect(emotionalHighPoints.length).toBeGreaterThan(0);
    emotionalHighPoints.forEach(point => {
      expect(point.emotion).toBeDefined();
      expect(point.intensity).toBeGreaterThan(0);
      expect(point.context).toBeDefined();
    });
  });

  test('generates emotional arc', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE);
    const { emotionalArc } = result;
    
    expect(emotionalArc.points.length).toBeGreaterThan(0);
    expect(emotionalArc.overallTrend).toBeDefined();
    
    emotionalArc.points.forEach(point => {
      expect(point.paragraph).toBeDefined();
      expect(point.emotions).toBeDefined();
    });
  });

  test('detects multiple emotions in a scene', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE);
    const firstScene = result.scenes[0];
    
    expect(Object.values(firstScene.emotionalScore)
      .filter(score => score > 0).length
    ).toBeGreaterThan(1);
  });

  test('provides pacing suggestions', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE);
    expect(result.pacingSuggestions.length).toBeGreaterThan(0);
  });

  test('handles scene delimiters', () => {
    const result = analyzer.analyzeEmotions(EMOTIONAL_SAMPLE, '---');
    expect(result.scenes).toBeDefined();
  });

  test('handles empty input', () => {
    const result = analyzer.analyzeEmotions('');
    expect(result.scenes).toHaveLength(1);
    expect(result.emotionalHighPoints).toHaveLength(0);
  });

  test('handles neutral text', () => {
    const result = analyzer.analyzeEmotions('The cat sat on the mat.');
    expect(result.scenes).toBeDefined();
    expect(Object.values(result.scenes[0].emotionalScore)
      .every(score => score === 0)
    ).toBeTruthy();
  });
});
