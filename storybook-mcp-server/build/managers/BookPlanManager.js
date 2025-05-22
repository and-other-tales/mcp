import { v4 as uuidv4 } from 'uuid';
import { SequentialStoryThinking } from './SequentialStoryThinking';
export class BookPlanManager {
    constructor(initialPlan) {
        this.bookPlan = initialPlan || this.createEmptyPlan();
        this.sequentialThinking = new SequentialStoryThinking();
    }
    createEmptyPlan() {
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
    addAct(title, purpose) {
        const act = {
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
    getAct(actId) {
        return this.bookPlan.acts.find(act => act.id === actId);
    }
    // Chapter Management
    addChapter(actId, title, wordCountTarget) {
        const act = this.getAct(actId);
        if (!act)
            return null;
        const chapter = {
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
    getChapter(actId, chapterId) {
        const act = this.getAct(actId);
        return act?.chapters.find(chapter => chapter.id === chapterId);
    }
    // Scene Management
    addScene(actId, chapterId, sceneDetails) {
        const chapter = this.getChapter(actId, chapterId);
        if (!chapter)
            return null;
        const scene = {
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
    addTheme(name, description) {
        const theme = {
            name,
            description,
            manifestations: []
        };
        this.bookPlan.themes.push(theme);
        return theme;
    }
    // Plot Management
    addPlotPoint(actId, plotPoint) {
        const act = this.getAct(actId);
        if (!act)
            return null;
        const newPlotPoint = {
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
    addCharacterArc(actId, characterArc) {
        const act = this.getAct(actId);
        if (!act)
            return null;
        const newArc = {
            characterId: characterArc.characterId || uuidv4(),
            startingState: characterArc.startingState || '',
            endingState: characterArc.endingState || '',
            developments: characterArc.developments || []
        };
        act.characterArcs.push(newArc);
        return newArc;
    }
    // World Building Management
    addWorldBuildingElement(element) {
        const newElement = {
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
    addSubplot(subplot) {
        const newSubplot = {
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
    addPacingNote(actId, chapterId, note) {
        const chapter = this.getChapter(actId, chapterId);
        if (!chapter)
            return null;
        const pacingNote = {
            position: note.position || 0,
            type: note.type || 'rising',
            duration: note.duration || 0,
            intensity: note.intensity || 0
        };
        chapter.pacing.push(pacingNote);
        return pacingNote;
    }
    // Analysis and Validation
    validateStructure() {
        const issues = [];
        // Check basic structure
        if (!this.bookPlan.title)
            issues.push('Missing book title');
        if (!this.bookPlan.genre.length)
            issues.push('No genres specified');
        if (!this.bookPlan.targetLength)
            issues.push('Target length not set');
        // Check outline
        if (!this.bookPlan.outline.premise)
            issues.push('Missing premise');
        if (!this.bookPlan.outline.centralConflict)
            issues.push('Missing central conflict');
        if (!this.bookPlan.outline.resolution)
            issues.push('Missing resolution');
        // Check acts
        if (!this.bookPlan.acts.length) {
            issues.push('No acts defined');
        }
        else {
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
    analyzePacing() {
        const pacingPoints = [];
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
    getFullPlan() {
        return this.bookPlan;
    }
    // Sequential Thinking Integration
    analyzeSequentially(thought) {
        return this.sequentialThinking.processThought(thought);
    }
    getAnalysisBranches() {
        return this.sequentialThinking.getBranches();
    }
    switchAnalysisBranch(branchId) {
        return this.sequentialThinking.switchBranch(branchId);
    }
    getAnalysisHistory() {
        return this.sequentialThinking.getThoughtHistory();
    }
    mergeAnalysisBranches(sourceBranch, targetBranch, atThought) {
        return this.sequentialThinking.mergeBranches(sourceBranch, targetBranch, atThought);
    }
}
