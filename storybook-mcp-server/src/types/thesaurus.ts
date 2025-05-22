export type EmotionTone = 'positive' | 'negative' | 'neutral';

export interface ThesaurusSuggestion {
    word: string;
    synonyms: string[];
    context: SynonymContext;
    narrativeContext: NarrativeContext;
}

export interface SynonymContext {
    tone: EmotionTone;
    intensity: number;
    formality: 'formal' | 'informal';
}

export interface NarrativeContext {
    genre?: string;
    perspective?: 'first-person' | 'third-person';
    timeframe?: 'historical' | 'contemporary' | 'future';
    style?: string;
    dominantEmotion?: EmotionTone;
}
