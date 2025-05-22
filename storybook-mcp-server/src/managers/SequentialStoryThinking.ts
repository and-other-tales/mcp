import type { TextFocus } from '../types/prompt';

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

export class SequentialStoryThinking {
  private thoughtHistory: StoryAnalysisThought[] = [];
  private branches: Record<string, StoryAnalysisThought[]> = {};
  private currentBranch: string = 'main';

  public processThought(input: StoryAnalysisThought): StoryAnalysisThought {
    // Validate and process the current thought
    const validatedThought = this.validateThoughtData(input);

    // Update total thoughts if needed
    if (validatedThought.thoughtNumber > validatedThought.totalThoughts) {
      validatedThought.totalThoughts = validatedThought.thoughtNumber;
    }

    // Store the thought in history
    if (validatedThought.isRevision && validatedThought.revisesThought) {
      // Create a new branch for the revision
      const branchId = `revision-${Date.now()}`;
      this.branches[branchId] = [...this.thoughtHistory.slice(0, validatedThought.revisesThought - 1)];
      this.currentBranch = branchId;
      this.branches[branchId].push(validatedThought);
    } else {
      if (!this.branches[this.currentBranch]) {
        this.branches[this.currentBranch] = [];
      }
      this.branches[this.currentBranch].push(validatedThought);
      this.thoughtHistory = this.branches[this.currentBranch];
    }

    return validatedThought;
  }

  public getBranches(): string[] {
    return Object.keys(this.branches);
  }

  public switchBranch(branchId: string): boolean {
    if (this.branches[branchId]) {
      this.currentBranch = branchId;
      this.thoughtHistory = this.branches[branchId];
      return true;
    }
    return false;
  }

  public getThoughtHistory(): StoryAnalysisThought[] {
    return this.thoughtHistory;
  }

  public getBranchHistory(branchId: string): StoryAnalysisThought[] | null {
    return this.branches[branchId] || null;
  }

  public mergeBranches(sourceBranch: string, targetBranch: string, atThought: number): boolean {
    const sourceHistory = this.branches[sourceBranch];
    const targetHistory = this.branches[targetBranch];

    if (!sourceHistory || !targetHistory) return false;

    // Create merged history
    const mergedHistory = [
      ...targetHistory.slice(0, atThought - 1),
      ...sourceHistory.slice(atThought - 1)
    ];

    // Create new branch for the merge
    const mergedBranchId = `merge-${Date.now()}`;
    this.branches[mergedBranchId] = mergedHistory;

    return true;
  }

  private validateThoughtData(input: unknown): StoryAnalysisThought {
    const thought = input as StoryAnalysisThought;
    
    if (!thought.thought || typeof thought.thought !== 'string') {
      throw new Error('Thought must be a non-empty string');
    }

    if (!thought.thoughtNumber || thought.thoughtNumber < 1) {
      throw new Error('Thought number must be a positive integer');
    }

    if (!thought.totalThoughts || thought.totalThoughts < thought.thoughtNumber) {
      throw new Error('Total thoughts must be greater than or equal to current thought number');
    }

    if (thought.isRevision && !thought.revisesThought) {
      throw new Error('Revision thoughts must specify which thought they revise');
    }

    if (thought.revisesThought && thought.revisesThought >= thought.thoughtNumber) {
      throw new Error('Cannot revise a future thought');
    }

    return thought;
  }
}
