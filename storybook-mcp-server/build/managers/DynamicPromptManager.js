import { v4 as uuidv4 } from 'uuid';
export class DynamicPromptManager {
    constructor() {
        this.templates = new Map();
        this.activeConstraints = [];
        this.contextHistory = new Map();
        this.initializeDefaultTemplates();
    }
    initializeDefaultTemplates() {
        // Default editing template
        this.templates.set('edit', {
            purpose: 'edit',
            baseStructure: 'Given the current context:\n[CONTEXT]\nRevise the following section:\n[FOCUS]\nConsider these elements:\n[CONSTRAINTS]',
            requiredContext: ['characters', 'plot'],
            optionalContext: ['setting', 'theme'],
            constraints: ['continuity', 'style']
        });
        // Default expansion template
        this.templates.set('expand', {
            purpose: 'expand',
            baseStructure: 'Using these elements as context:\n[CONTEXT]\nExpand the following section:\n[FOCUS]\nMaintaining:\n[CONSTRAINTS]',
            requiredContext: ['plot', 'setting'],
            optionalContext: ['theme'],
            constraints: ['continuity', 'character']
        });
        // Default analysis template
        this.templates.set('analyze', {
            purpose: 'analyze',
            baseStructure: 'Analyze the following section:\n[FOCUS]\nConsidering this context:\n[CONTEXT]\nEvaluate based on:\n[CONSTRAINTS]',
            requiredContext: ['plot', 'theme'],
            optionalContext: ['character', 'setting'],
            constraints: ['style', 'plot']
        });
    }
    createPrompt(template, focus, contextWindow, constraints) {
        const selectedTemplate = this.templates.get(template);
        if (!selectedTemplate) {
            throw new Error(`Template '${template}' not found`);
        }
        // Build contextual elements
        const contextualElements = this.buildContextualElements(selectedTemplate, contextWindow, focus);
        // Merge global and local constraints
        const mergedConstraints = [
            ...this.activeConstraints,
            ...constraints
        ].filter((constraint, index, self) => index === self.findIndex(c => c.rule === constraint.rule));
        return {
            basePrompt: selectedTemplate.baseStructure,
            contextualElements,
            constraints: mergedConstraints,
            objectives: this.deriveObjectives(focus, mergedConstraints)
        };
    }
    buildContextualElements(template, contextWindow, focus) {
        const elements = [];
        // Process required context types first
        template.requiredContext.forEach(type => {
            const contextElements = this.getContextForType(type, contextWindow, focus);
            elements.push(...contextElements);
        });
        // Add optional context if relevant
        template.optionalContext.forEach(type => {
            const optionalElements = this.getContextForType(type, contextWindow, focus);
            const relevantElements = optionalElements.filter(e => e.relevance > 0.7);
            elements.push(...relevantElements);
        });
        return elements;
    }
    getContextForType(type, contextWindow, focus) {
        const elements = [];
        // Process elements before current focus
        contextWindow.before.forEach(element => {
            if (this.matchesType(element, type)) {
                elements.push(this.convertToPromptContext(element, 'past'));
            }
        });
        // Process elements after current focus
        contextWindow.after.forEach(element => {
            if (this.matchesType(element, type)) {
                elements.push(this.convertToPromptContext(element, 'future'));
            }
        });
        // Add historical context if available
        const historicalContext = this.contextHistory.get(focus.id);
        if (historicalContext) {
            const relevantHistory = historicalContext.filter(ctx => ctx.type === type && ctx.relevance > 0.5);
            elements.push(...relevantHistory);
        }
        return elements;
    }
    matchesType(element, type) {
        switch (type) {
            case 'character':
                return element.type === 'character' || element.type === 'dialogue';
            case 'plot':
                return element.type === 'event' || element.type === 'conflict';
            case 'setting':
                return element.type === 'location' || element.type === 'time';
            case 'theme':
                return element.type === 'symbol' || element.type === 'motif';
            default:
                return false;
        }
    }
    convertToPromptContext(element, timeframe) {
        return {
            type: this.mapElementTypeToContextType(element.type),
            content: element.content,
            relevance: element.importance / 10,
            timeframe
        };
    }
    mapElementTypeToContextType(elementType) {
        switch (elementType) {
            case 'character':
            case 'dialogue':
                return 'character';
            case 'event':
            case 'conflict':
                return 'plot';
            case 'location':
            case 'time':
                return 'setting';
            case 'symbol':
            case 'motif':
                return 'theme';
            default:
                return 'plot';
        }
    }
    deriveObjectives(focus, constraints) {
        const objectives = [
            `Maintain consistency with ${focus.criticalElements.join(', ')}`,
        ];
        // Add constraint-based objectives
        constraints.forEach(constraint => {
            switch (constraint.type) {
                case 'continuity':
                    objectives.push(`Ensure narrative continuity: ${constraint.explanation}`);
                    break;
                case 'character':
                    objectives.push(`Maintain character consistency: ${constraint.explanation}`);
                    break;
                case 'plot':
                    objectives.push(`Advance plot coherently: ${constraint.explanation}`);
                    break;
                case 'style':
                    objectives.push(`Follow style guidelines: ${constraint.explanation}`);
                    break;
            }
        });
        return objectives;
    }
    updateContextHistory(focusId, context) {
        const existing = this.contextHistory.get(focusId) || [];
        existing.push(context);
        this.contextHistory.set(focusId, existing);
    }
    addGlobalConstraint(constraint) {
        if (!this.activeConstraints.some(c => c.rule === constraint.rule)) {
            this.activeConstraints.push(constraint);
        }
    }
    addTemplate(name, template) {
        this.templates.set(name, template);
    }
    integrateChunkAnalysis(analysis) {
        const contextualElements = analysis.contextualElements.map(element => ({
            id: uuidv4(),
            type: element.type,
            content: element.name,
            importance: element.significance,
            relationToFocus: this.determineRelation(element)
        }));
        const midpoint = Math.floor(contextualElements.length / 2);
        return {
            before: contextualElements.slice(0, midpoint),
            after: contextualElements.slice(midpoint + 1),
            currentFocus: {
                type: 'scene', // Default to scene, can be determined by metadata
                id: analysis.chunk.id,
                content: analysis.chunk.content,
                criticalElements: analysis.metadata.significantElements.events
            }
        };
    }
    determineRelation(element) {
        // This would use more sophisticated logic in a full implementation
        if (element.firstMention === element.lastMention) {
            return 'development';
        }
        return element.firstMention ? 'callback' : 'setup';
    }
    /**
     * Generates a prompt based on sequential analysis history
     */
    createSequentialPrompt(thought, thoughtHistory) {
        // Get relevant template based on thought purpose
        const template = this.templates.get('analyze');
        if (!template) {
            throw new Error('Analysis template not found');
        }
        // Build context from thought history
        const contextElements = thoughtHistory.map(t => ({
            type: this.determineThoughtType(t),
            content: t.thought,
            relevance: this.calculateThoughtRelevance(t, thought),
            timeframe: 'past'
        }));
        // Add current narrative context if available
        if (thought.narrativeContext) {
            if (thought.narrativeContext.theme) {
                contextElements.push(...thought.narrativeContext.theme.map(theme => ({
                    type: 'theme',
                    content: theme,
                    relevance: 1,
                    timeframe: 'present'
                })));
            }
            if (thought.narrativeContext.characters) {
                contextElements.push(...thought.narrativeContext.characters.map(char => ({
                    type: 'character',
                    content: char,
                    relevance: 1,
                    timeframe: 'present'
                })));
            }
        }
        // Generate appropriate constraints based on analysis context
        const analysisConstraints = this.generateAnalysisConstraints(thought);
        return {
            basePrompt: template.baseStructure,
            contextualElements: contextElements,
            constraints: [...this.activeConstraints, ...analysisConstraints],
            objectives: this.deriveAnalysisObjectives(thought)
        };
    }
    determineThoughtType(thought) {
        // Analyze thought content to determine its primary focus
        const content = thought.thought.toLowerCase();
        const narrativeContext = thought.narrativeContext;
        if (narrativeContext?.characters?.length)
            return 'character';
        if (narrativeContext?.plotPoints?.length)
            return 'plot';
        if (content.includes('theme') || narrativeContext?.theme?.length)
            return 'theme';
        if (content.includes('location') || content.includes('setting'))
            return 'setting';
        return 'plot'; // Default to plot if unclear
    }
    calculateThoughtRelevance(pastThought, currentThought) {
        // Base relevance on temporal distance
        const thoughtDistance = currentThought.thoughtNumber - pastThought.thoughtNumber;
        const baseRelevance = Math.max(0.1, 1 - thoughtDistance / currentThought.totalThoughts);
        // Increase relevance for directly related thoughts
        if (currentThought.revisesThought === pastThought.thoughtNumber) {
            return Math.min(1, baseRelevance + 0.3);
        }
        // Check for shared narrative elements
        const sharedElements = this.countSharedElements(pastThought, currentThought);
        return Math.min(1, baseRelevance + (sharedElements * 0.1));
    }
    countSharedElements(thought1, thought2) {
        let count = 0;
        if (thought1.narrativeContext && thought2.narrativeContext) {
            const ctx1 = thought1.narrativeContext;
            const ctx2 = thought2.narrativeContext;
            // Check shared characters
            count += this.countSharedArrayElements(ctx1.characters || [], ctx2.characters || []);
            // Check shared themes
            count += this.countSharedArrayElements(ctx1.theme || [], ctx2.theme || []);
            // Check shared plot points
            count += this.countSharedArrayElements(ctx1.plotPoints || [], ctx2.plotPoints || []);
        }
        return count;
    }
    countSharedArrayElements(arr1, arr2) {
        return arr1.filter(item => arr2.includes(item)).length;
    }
    generateAnalysisConstraints(thought) {
        const constraints = [];
        // Add sequential thinking constraints
        constraints.push({
            type: 'continuity',
            rule: 'Sequential Analysis',
            explanation: 'Build upon previous analytical steps while maintaining logical progression',
            scope: 'global'
        });
        // Add revision-specific constraints
        if (thought.isRevision) {
            constraints.push({
                type: 'plot',
                rule: 'Revision Coherence',
                explanation: 'Ensure revisions maintain consistency with established elements while improving identified issues',
                scope: 'local'
            });
        }
        return constraints;
    }
    deriveAnalysisObjectives(thought) {
        const objectives = [
            `Build upon analysis step ${thought.thoughtNumber} of ${thought.totalThoughts}`
        ];
        if (thought.narrativeContext) {
            const ctx = thought.narrativeContext;
            if (ctx.theme?.length) {
                objectives.push(`Analyze thematic elements: ${ctx.theme.join(', ')}`);
            }
            if (ctx.characters?.length) {
                objectives.push(`Consider character dynamics: ${ctx.characters.join(', ')}`);
            }
            if (ctx.plotPoints?.length) {
                objectives.push(`Examine plot developments: ${ctx.plotPoints.join(', ')}`);
            }
        }
        if (thought.isRevision) {
            objectives.push(`Revise and improve analysis step ${thought.revisesThought}`);
        }
        return objectives;
    }
}
