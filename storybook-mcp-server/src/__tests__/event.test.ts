import { EventContinuityAnalyzer } from '../analyzers/event';
import { EVENT_SAMPLE } from './utils';

describe('EventContinuityAnalyzer', () => {
  let analyzer: EventContinuityAnalyzer;

  beforeEach(() => {
    analyzer = new EventContinuityAnalyzer();
  });

  test('analyzes events successfully', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    expect(result).toBeDefined();
    expect(result.events.length).toBeGreaterThan(0);
    expect(result.eventChain).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });

  test('identifies events with timestamps', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    const events = result.events;
    
    expect(events.some(e => e.timestamp?.includes('9:00 AM'))).toBeTruthy();
    expect(events.some(e => e.timestamp?.includes('morning'))).toBeTruthy();
    expect(events.some(e => e.timestamp?.includes('evening'))).toBeTruthy();
  });

  test('builds event chain', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    const { eventChain } = result;
    
    expect(eventChain.sequences.length).toBeGreaterThan(0);
    expect(eventChain.timeline.length).toBeGreaterThan(0);
    
    eventChain.sequences.forEach(sequence => {
      expect(sequence.events.length).toBeGreaterThan(0);
      expect(sequence.characters.length).toBeGreaterThan(0);
      expect(sequence.location).toBeDefined();
    });
  });

  test('detects character involvement in events', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    const events = result.events;
    
    const eventWithCharacters = events.find(e => 
      e.characters.includes('Sarah') || e.characters.includes('John')
    );
    expect(eventWithCharacters).toBeDefined();
  });

  test('creates chronological timeline', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    const { timeline } = result.eventChain;
    
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.every(e => e.event && e.timestamp)).toBeTruthy();
    
    // Check chronological ordering
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i].relativePosition).toBeGreaterThan(timeline[i-1].relativePosition);
    }
  });

  test('identifies potential plot holes', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    expect(Array.isArray(result.eventChain.possiblePlotHoles)).toBeTruthy();
  });

  test('detects continuity errors', () => {
    const result = analyzer.analyzeEvents(EVENT_SAMPLE);
    expect(Array.isArray(result.continuityErrors)).toBeTruthy();
  });

  test('handles empty input', () => {
    const result = analyzer.analyzeEvents('');
    expect(result.events).toHaveLength(0);
    expect(result.continuityErrors).toHaveLength(0);
  });

  test('handles text without events', () => {
    const result = analyzer.analyzeEvents('This is a simple description.');
    expect(result.events).toHaveLength(0);
  });
});
