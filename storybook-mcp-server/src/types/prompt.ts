export interface DynamicPrompt {
  basePrompt: string;
  contextualElements: PromptContext[];
  constraints: PromptConstraint[];
  objectives: string[];
}

export interface StoryAnalysisThought {
  thought: string;
  thoughtNumber: number;
  totalThoughts: number;
  isRevision?: boolean;
  revisesThought?: number;
  nextThoughtNeeded: boolean;
  narrativeContext?: {
    scene: TextFocus;
    theme: string[];
    characters: string[];
    plotPoints: string[];
  };
}

export interface PromptContext {
  type: 'character' | 'plot' | 'setting' | 'theme';
  content: string;
  relevance: number;
  timeframe: 'past' | 'present' | 'future';
}

export interface PromptConstraint {
  type: 'continuity' | 'character' | 'plot' | 'style';
  rule: string;
  explanation: string;
  scope: 'local' | 'global';
}

export interface ContextWindow {
  before: ContextualElement[];
  after: ContextualElement[];
  currentFocus: TextFocus;
}

export interface TextFocus {
  type: 'scene' | 'chapter' | 'act';
  id: string;
  content: string;
  criticalElements: string[];
}

export interface ContextualElement {
  id: string;
  type: string;
  content: string;
  importance: number;
  relationToFocus: 'setup' | 'callback' | 'development' | 'resolution';
}

export interface PromptTemplate {
  purpose: 'edit' | 'expand' | 'revise' | 'analyze';
  baseStructure: string;
  requiredContext: string[];
  optionalContext: string[];
  constraints: string[];
}
