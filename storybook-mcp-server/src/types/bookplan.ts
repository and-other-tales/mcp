export interface BookPlan {
  title: string;
  genre: string[];
  targetLength: number;
  outline: StoryOutline;
  acts: Act[];
  themes: Theme[];
  worldBuilding: WorldBuildingElement[];
}

export interface Act {
  id: string;
  title: string;
  purpose: string;
  chapters: Chapter[];
  plotPoints: PlotPoint[];
  characterArcs: CharacterArc[];
}

export interface Chapter {
  id: string;
  title: string;
  scenes: Scene[];
  plotPoints: PlotPoint[];
  pacing: PacingNote[];
  wordCountTarget: number;
}

export interface Scene {
  id: string;
  summary: string;
  characters: SceneCharacter[];
  location: Location;
  timeframe: Timeframe;
  goals: string[];
  conflicts: Conflict[];
  outcomes: string[];
}

export interface StoryOutline {
  premise: string;
  centralConflict: string;
  resolution: string;
  subplots: Subplot[];
}

export interface Theme {
  name: string;
  description: string;
  manifestations: ThemeManifestation[];
}

export interface ThemeManifestation {
  sceneId: string;
  description: string;
  impact: string;
}

export interface WorldBuildingElement {
  type: 'rule' | 'system' | 'culture' | 'history';
  name: string;
  description: string;
  affects: string[];
  manifestations: string[];
}

export interface PlotPoint {
  id: string;
  type: 'major' | 'minor' | 'setup' | 'payoff';
  description: string;
  setup: string[];
  impact: string[];
  relatedCharacters: string[];
}

export interface CharacterArc {
  characterId: string;
  startingState: string;
  endingState: string;
  developments: CharacterDevelopment[];
}

export interface CharacterDevelopment {
  sceneId: string;
  change: string;
  catalyst: string;
  impact: string;
}

export interface PacingNote {
  position: number;
  type: 'rising' | 'falling' | 'climax' | 'rest';
  duration: number;
  intensity: number;
}

export interface SceneCharacter {
  id: string;
  role: 'primary' | 'secondary' | 'mentioned';
  goal: string;
  conflict: string;
  outcome: string;
}

export interface Location {
  name: string;
  description: string;
  significance: string;
  atmosphericElements: string[];
}

export interface Timeframe {
  relative: string;
  absolute?: string;
  duration: string;
}

export interface Conflict {
  type: 'internal' | 'external' | 'environmental';
  description: string;
  stakes: string;
  resolution?: string;
}

export interface Subplot {
  id: string;
  summary: string;
  relatedCharacters: string[];
  plotPoints: PlotPoint[];
  resolution: string;
}
