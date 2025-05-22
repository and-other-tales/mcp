export interface RepetitionAnalysisResult {
  repeatedWords: RepetitionInstance[];
  repeatedPhrases: RepetitionInstance[];
  statistics: {
    totalRepetitions: number;
    mostFrequentWord: { term: string; count: number; } | null;
    mostFrequentPhrase: { term: string; count: number; } | null;
  };
}

export interface RepetitionInstance {
  term: string;
  count: number;
  contexts: PhraseContext[];
  isPhrase: boolean;
}

export interface PhraseContext {
  before: string;
  term: string;
  after: string;
  position: number;
}

export interface ThesaurusSuggestion {
  word: string;
  contextScore: number;
  usageNotes: string;
}

export interface SynonymContext {
  isDialogue: boolean;
  isAction: boolean;
  isDescription: boolean;
  grammaticalRole: string;
  subjectMatter: string;
}

export interface NarrativeContext {
  dominantEmotion: string;
  emotionalIntensity: number;
  tone: 'formal' | 'casual' | 'mixed';
  tense: 'past' | 'present' | 'mixed';
  pov: 'first' | 'second' | 'third' | 'mixed';
}
