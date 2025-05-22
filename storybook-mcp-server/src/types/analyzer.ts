import { Character } from '../types';

export interface AnalyzerOptions {
  maxParagraphLength?: number;
  minSceneLength?: number;
  maxSceneLength?: number;
  emotionalThreshold?: number;
  characterNamePattern?: RegExp;
  locationPattern?: RegExp;
}

export interface AnalyzerContext {
  currentParagraph: number;
  paragraphText: string;
  characters: Map<string, Character>;
  errors: Error[];
}

export type AnalyzerCallback = (context: AnalyzerContext) => void;
