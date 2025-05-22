import { expect } from 'chai';
import { BookPlanManager } from '../managers/BookPlanManager';
import { DynamicPromptManager } from '../managers/DynamicPromptManager';
import { SequentialStoryThinking, StoryAnalysisThought } from '../managers/SequentialStoryThinking';

describe('Sequential Story Analysis Integration', () => {
  let bookPlanManager: BookPlanManager;
  let promptManager: DynamicPromptManager;
  let sequentialThinking: SequentialStoryThinking;

  beforeEach(() => {
    bookPlanManager = new BookPlanManager();
    promptManager = new DynamicPromptManager();
    sequentialThinking = new SequentialStoryThinking();
  });

  describe('Sequential Analysis Workflow', () => {
    it('should process sequential analysis thoughts', () => {
      // Initial thought
      const thought1: StoryAnalysisThought = {
        thought: 'Character motivation seems inconsistent in opening scene',
        thoughtNumber: 1,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        narrativeContext: {
          scene: {
            type: 'scene',
            id: 'scene-1',
            content: 'Opening scene content',
            criticalElements: ['character-motivation', 'conflict']
          },
          characters: ['John'],
          theme: ['identity'],
          plotPoints: ['initial-decision']
        }
      };

      const result1 = bookPlanManager.analyzeSequentially(thought1);
      expect(result1.thoughtNumber).to.equal(1);
      expect(result1.nextThoughtNeeded).to.be.true;

      // Follow-up thought
      const thought2: StoryAnalysisThought = {
        thought: 'Previous actions suggest deeper internal struggle',
        thoughtNumber: 2,
        totalThoughts: 3,
        nextThoughtNeeded: true,
        narrativeContext: {
          scene: thought1.narrativeContext!.scene,
          characters: ['John'],
          theme: ['identity', 'struggle'],
          plotPoints: ['initial-decision', 'internal-conflict']
        }
      };

      const result2 = bookPlanManager.analyzeSequentially(thought2);
      expect(result2.thoughtNumber).to.equal(2);

      // Revision thought
      const thought3: StoryAnalysisThought = {
        thought: 'Need to revise initial character motivation analysis',
        thoughtNumber: 3,
        totalThoughts: 3,
        nextThoughtNeeded: false,
        isRevision: true,
        revisesThought: 1,
        narrativeContext: thought1.narrativeContext
      };

      const result3 = bookPlanManager.analyzeSequentially(thought3);
      expect(result3.isRevision).to.be.true;
      expect(result3.revisesThought).to.equal(1);
    });

    it('should generate appropriate prompts for sequential analysis', () => {
      const thought: StoryAnalysisThought = {
        thought: 'Theme analysis for opening scene',
        thoughtNumber: 1,
        totalThoughts: 2,
        nextThoughtNeeded: true,
        narrativeContext: {
          scene: {
            type: 'scene',
            id: 'scene-1',
            content: 'Opening scene content',
            criticalElements: ['theme-setup', 'atmosphere']
          },
          theme: ['isolation', 'hope'],
          characters: ['John', 'Sarah'],
          plotPoints: ['initial-meeting']
        }
      };

      // Add the thought to history
      bookPlanManager.analyzeSequentially(thought);
      
      // Get thought history
      const thoughtHistory = bookPlanManager.getAnalysisHistory();
      
      // Generate sequential prompt
      const prompt = promptManager.createSequentialPrompt(thought, thoughtHistory);
      
      expect(prompt.contextualElements).to.be.an('array');
      expect(prompt.constraints).to.be.an('array');
      expect(prompt.objectives).to.be.an('array');
      
      // Check for theme-specific elements
      const themeElements = prompt.contextualElements.filter(e => e.type === 'theme');
      expect(themeElements).to.have.length.greaterThan(0);
    });

    it('should manage multiple analysis branches', () => {
      const mainThought: StoryAnalysisThought = {
        thought: 'Initial character analysis',
        thoughtNumber: 1,
        totalThoughts: 2,
        nextThoughtNeeded: true,
        narrativeContext: {
          scene: {
            type: 'scene',
            id: 'scene-1',
            content: 'Scene content',
            criticalElements: ['character']
          },
          characters: ['John'],
          theme: [],
          plotPoints: []
        }
      };

      bookPlanManager.analyzeSequentially(mainThought);

      const revisionThought: StoryAnalysisThought = {
        thought: 'Alternative character interpretation',
        thoughtNumber: 2,
        totalThoughts: 2,
        nextThoughtNeeded: false,
        isRevision: true,
        revisesThought: 1,
        narrativeContext: mainThought.narrativeContext
      };

      bookPlanManager.analyzeSequentially(revisionThought);

      const branches = bookPlanManager.getAnalysisBranches();
      expect(branches.length).to.be.greaterThan(1);

      // Each branch should have different content
      const mainHistory = bookPlanManager.getAnalysisHistory();
      expect(mainHistory).to.not.deep.equal(revisionThought);
    });
  });
});
