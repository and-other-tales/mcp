import { expect } from 'chai';
import { BookPlanManager } from '../managers/BookPlanManager';
import { DynamicPromptManager } from '../managers/DynamicPromptManager';
import { ContextChunkManager } from '../analyzers/chunking';
describe('Manuscript Management System Integration', () => {
    let bookPlanManager;
    let promptManager;
    let chunkManager;
    beforeEach(() => {
        bookPlanManager = new BookPlanManager();
        promptManager = new DynamicPromptManager();
        chunkManager = new ContextChunkManager();
    });
    describe('Book Planning Integration', () => {
        it('should create and manage a complete narrative structure', () => {
            // Create basic structure
            const act = bookPlanManager.addAct('Act 1', 'Setup the world and conflict');
            expect(act).to.not.be.null;
            const chapter = bookPlanManager.addChapter(act.id, 'Chapter 1', 2500);
            expect(chapter).to.not.be.null;
            const scene = bookPlanManager.addScene(act.id, chapter.id, {
                summary: 'Opening scene',
                goals: ['Introduce protagonist'],
                conflicts: [{
                        type: 'internal',
                        description: 'Doubt about the journey ahead',
                        stakes: 'Personal growth'
                    }]
            });
            expect(scene).to.not.be.null;
            // Validate structure
            const issues = bookPlanManager.validateStructure();
            expect(issues).to.include('Missing book title');
            expect(issues).to.include('No genres specified');
        });
        it('should track themes and character arcs across the narrative', () => {
            const act = bookPlanManager.addAct('Act 1', 'Setup');
            // Add theme
            const theme = bookPlanManager.addTheme('Redemption', 'The path to forgiveness');
            expect(theme.name).to.equal('Redemption');
            // Add character arc
            const arc = bookPlanManager.addCharacterArc(act.id, {
                characterId: 'protagonist-1',
                startingState: 'Cynical',
                endingState: 'Hopeful',
                developments: [{
                        sceneId: 'scene-1',
                        change: 'First step towards trust',
                        catalyst: 'Help from stranger',
                        impact: 'Beginning to question cynicism'
                    }]
            });
            expect(arc).to.not.be.null;
        });
    });
    describe('Dynamic Prompting Integration', () => {
        it('should generate context-aware prompts based on manuscript chunks', () => {
            // Setup test manuscript
            const text = 'John walked through the ancient forest. The trees whispered secrets of the past. He remembered Sarah\'s warning about the dark heart of the woods.';
            const options = {
                maxChunkSize: 100,
                overlapSize: 10,
                preserveScenes: true,
                preserveChapters: true,
                contextWindow: 2
            };
            // Chunk the manuscript
            const chunks = chunkManager.chunkManuscript(text, options);
            expect(chunks.length).to.be.greaterThan(0);
            // Get analysis for the first chunk
            const contextWindow = promptManager.integrateChunkAnalysis(chunkManager.getContextForPosition(0)[0]);
            // Generate a prompt
            const prompt = promptManager.createPrompt('edit', contextWindow.currentFocus, contextWindow, [{
                    type: 'continuity',
                    rule: 'Maintain established atmosphere',
                    explanation: 'Keep the mysterious and foreboding tone of the forest',
                    scope: 'local'
                }]);
            expect(prompt.objectives).to.be.an('array');
            expect(prompt.contextualElements).to.be.an('array');
        });
        it('should maintain context history and constraints', () => {
            promptManager.addGlobalConstraint({
                type: 'style',
                rule: 'Maintain third-person limited POV',
                explanation: 'Stay in John\'s perspective without omniscient narration',
                scope: 'global'
            });
            const contextUpdate = {
                type: 'character',
                content: 'John\'s fear of enclosed spaces',
                relevance: 0.9,
                timeframe: 'past'
            };
            promptManager.updateContextHistory('scene-1', contextUpdate);
            // Create a prompt that should include the history
            const prompt = promptManager.createPrompt('edit', {
                type: 'scene',
                id: 'scene-1',
                content: 'Test scene content',
                criticalElements: ['fear', 'forest']
            }, {
                before: [],
                after: [],
                currentFocus: {
                    type: 'scene',
                    id: 'scene-1',
                    content: 'Test scene content',
                    criticalElements: ['fear', 'forest']
                }
            }, []);
            // The prompt should include both the global POV constraint and the character history
            expect(prompt.constraints).to.have.lengthOf.at.least(1);
            expect(prompt.contextualElements).to.have.lengthOf.at.least(1);
        });
    });
});
