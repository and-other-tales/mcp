import { v4 as uuidv4 } from 'uuid';
import type {
  BookPlan,
  Act,
  Chapter,
  Scene,
  Theme,
  PlotPoint,
  CharacterArc,
  WorldBuildingElement,
  Subplot,
  PacingNote,
  Location,
  Conflict
} from '../types/bookplan';
import { SequentialStoryThinking, StoryAnalysisThought } from './SequentialStoryThinking';

export class BookPlanManager {
  private bookPlan: BookPlan;
  private sequentialThinking: SequentialStoryThinking;

  constructor(initialPlan?: BookPlan) {
    this.bookPlan = initialPlan || this.createEmptyPlan();
    this.sequentialThinking = new SequentialStoryThinking();
  }

  private createEmptyPlan(): BookPlan {
    return {
      title: '',
      genre: [],
      targetLength: 0,
      outline: {
        premise: '',
        centralConflict: '',
        resolution: '',
        subplots: []
      },
      acts: [],
      themes: [],
      worldBuilding: []
    };
  }

  // Act Management
  public addAct(title: string, purpose: string): Act {
    const act: Act = {
      id: uuidv4(),
      title,
      purpose,
      chapters: [],
      plotPoints: [],
      characterArcs: []
    };
    this.bookPlan.acts.push(act);
    return act;
  }

  public getAct(actId: string): Act | undefined {
    return this.bookPlan.acts.find(act => act.id === actId);
  }

  // Chapter Management
  public addChapter(actId: string, title: string, wordCountTarget: number): Chapter | null {
    const act = this.getAct(actId);
    if (!act) return null;

    const chapter: Chapter = {
      id: uuidv4(),
      title,
      scenes: [],
      plotPoints: [],
      pacing: [],
      wordCountTarget
    };
    act.chapters.push(chapter);
    return chapter;
  }

  public getChapter(actId: string, chapterId: string): Chapter | undefined {
    const act = this.getAct(actId);
    return act?.chapters.find(chapter => chapter.id === chapterId);
  }

  // Scene Management
  public addScene(actId: string, chapterId: string, sceneDetails: Partial<Scene>): Scene | null {
    const chapter = this.getChapter(actId, chapterId);
    if (!chapter) return null;

    const scene: Scene = {
      id: uuidv4(),
      summary: sceneDetails.summary || '',
      characters: sceneDetails.characters || [],
      location: sceneDetails.location || {
        name: '',
        description: '',
        significance: '',
        atmosphericElements: []
      },
      timeframe: sceneDetails.timeframe || {
        relative: '',
        duration: ''
      },
      goals: sceneDetails.goals || [],
      conflicts: sceneDetails.conflicts || [],
      outcomes: sceneDetails.outcomes || []
    };
    chapter.scenes.push(scene);
    return scene;
  }

  // Theme Management
  public addTheme(name: string, description: string): Theme {
    const theme: Theme = {
      name,
      description,
      manifestations: []
    };
    this.bookPlan.themes.push(theme);
    return theme;
  }

  // Plot Management
  public addPlotPoint(actId: string, plotPoint: Partial<PlotPoint>): PlotPoint | null {
    const act = this.getAct(actId);
    if (!act) return null;

    const newPlotPoint: PlotPoint = {
      id: uuidv4(),
      type: plotPoint.type || 'minor',
      description: plotPoint.description || '',
      setup: plotPoint.setup || [],
      impact: plotPoint.impact || [],
      relatedCharacters: plotPoint.relatedCharacters || []
    };
    act.plotPoints.push(newPlotPoint);
    return newPlotPoint;
  }

  // Character Arc Management
  public addCharacterArc(actId: string, characterArc: Partial<CharacterArc>): CharacterArc | null {
    const act = this.getAct(actId);
    if (!act) return null;

    const newArc: CharacterArc = {
      characterId: characterArc.characterId || uuidv4(),
      startingState: characterArc.startingState || '',
      endingState: characterArc.endingState || '',
      developments: characterArc.developments || []
    };
    act.characterArcs.push(newArc);
    return newArc;
  }

  // World Building Management
  public addWorldBuildingElement(element: Partial<WorldBuildingElement>): WorldBuildingElement {
    const newElement: WorldBuildingElement = {
      type: element.type || 'rule',
      name: element.name || '',
      description: element.description || '',
      affects: element.affects || [],
      manifestations: element.manifestations || []
    };
    this.bookPlan.worldBuilding.push(newElement);
    return newElement;
  }

  // Subplot Management
  public addSubplot(subplot: Partial<Subplot>): Subplot {
    const newSubplot: Subplot = {
      id: uuidv4(),
      summary: subplot.summary || '',
      relatedCharacters: subplot.relatedCharacters || [],
      plotPoints: subplot.plotPoints || [],
      resolution: subplot.resolution || ''
    };
    this.bookPlan.outline.subplots.push(newSubplot);
    return newSubplot;
  }

  // Pacing Management
  public addPacingNote(actId: string, chapterId: string, note: Partial<PacingNote>): PacingNote | null {
    const chapter = this.getChapter(actId, chapterId);
    if (!chapter) return null;

    const pacingNote: PacingNote = {
      position: note.position || 0,
      type: note.type || 'rising',
      duration: note.duration || 0,
      intensity: note.intensity || 0
    };
    chapter.pacing.push(pacingNote);
    return pacingNote;
  }

  // Analysis and Validation
  public validateStructure(): string[] {
    const issues: string[] = [];

    // Check basic structure
    if (!this.bookPlan.title) issues.push('Missing book title');
    if (!this.bookPlan.genre.length) issues.push('No genres specified');
    if (!this.bookPlan.targetLength) issues.push('Target length not set');

    // Check outline
    if (!this.bookPlan.outline.premise) issues.push('Missing premise');
    if (!this.bookPlan.outline.centralConflict) issues.push('Missing central conflict');
    if (!this.bookPlan.outline.resolution) issues.push('Missing resolution');

    // Check acts
    if (!this.bookPlan.acts.length) {
      issues.push('No acts defined');
    } else {
      this.bookPlan.acts.forEach((act, index) => {
        if (!act.chapters.length) {
          issues.push(`Act ${index + 1} has no chapters`);
        }
        act.chapters.forEach((chapter, chapterIndex) => {
          if (!chapter.scenes.length) {
            issues.push(`Act ${index + 1}, Chapter ${chapterIndex + 1} has no scenes`);
          }
        });
      });
    }

    return issues;
  }

  public analyzePacing(): { intensity: number; type: string }[] {
    const pacingPoints: { intensity: number; type: string }[] = [];
    
    this.bookPlan.acts.forEach(act => {
      act.chapters.forEach(chapter => {
        chapter.pacing.forEach(note => {
          pacingPoints.push({
            intensity: note.intensity,
            type: note.type
          });
        });
      });
    });

    return pacingPoints;
  }

  public getFullPlan(): BookPlan {
    return this.bookPlan;
  }

  // Sequential Thinking Integration
  public analyzeSequentially(thought: StoryAnalysisThought): StoryAnalysisThought {
    return this.sequentialThinking.processThought(thought);
  }

  public getAnalysisBranches(): string[] {
    return this.sequentialThinking.getBranches();
  }

  public switchAnalysisBranch(branchId: string): boolean {
    return this.sequentialThinking.switchBranch(branchId);
  }

  public getAnalysisHistory(): StoryAnalysisThought[] {
    return this.sequentialThinking.getThoughtHistory();
  }

  public mergeAnalysisBranches(sourceBranch: string, targetBranch: string, atThought: number): boolean {
    return this.sequentialThinking.mergeBranches(sourceBranch, targetBranch, atThought);
  }
}
