import { v4 as uuidv4 } from 'uuid';
import type {
  DynamicPrompt,
  PromptContext,
  PromptConstraint,
  ContextWindow,
  TextFocus,
  ContextualElement,
  PromptTemplate
} from '../types/prompt';
import { ChunkAnalysis } from '../types/chunking';
import { StoryAnalysisThought } from './SequentialStoryThinking';

export class DynamicPromptManager {
  private templates: Map<string, PromptTemplate>;
  private activeConstraints: PromptConstraint[];
  private contextHistory: Map<string, PromptContext[]>;

  constructor() {
    this.templates = new Map();
    this.activeConstraints = [];
    this.contextHistory = new Map();
    this.initializeDefaultTemplates();
  }

  private initializeDefaultTemplates() {
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

  public createPrompt(
    template: string,
    focus: TextFocus,
    contextWindow: ContextWindow,
    constraints: PromptConstraint[]
  ): DynamicPrompt {
    const selectedTemplate = this.templates.get(template);
    if (!selectedTemplate) {
      throw new Error(`Template '${template}' not found`);
    }

    // Build contextual elements
    const contextualElements = this.buildContextualElements(
      selectedTemplate,
      contextWindow,
      focus
    );

    // Merge global and local constraints
    const mergedConstraints = [
      ...this.activeConstraints,
      ...constraints
    ].filter((constraint, index, self) => 
      index === self.findIndex(c => c.rule === constraint.rule)
    );

    return {
      basePrompt: selectedTemplate.baseStructure,
      contextualElements,
      constraints: mergedConstraints,
      objectives: this.deriveObjectives(focus, mergedConstraints)
    };
  }

  private buildContextualElements(
    template: PromptTemplate,
    contextWindow: ContextWindow,
    focus: TextFocus
  ): PromptContext[] {
    const elements: PromptContext[] = [];

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

  private getContextForType(
    type: string,
    contextWindow: ContextWindow,
    focus: TextFocus
  ): PromptContext[] {
    const elements: PromptContext[] = [];

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
      const relevantHistory = historicalContext.filter(ctx => 
        ctx.type === type && ctx.relevance > 0.5
      );
      elements.push(...relevantHistory);
    }

    return elements;
  }

  private matchesType(element: ContextualElement, type: string): boolean {
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

  private convertToPromptContext(
    element: ContextualElement,
    timeframe: 'past' | 'present' | 'future'
  ): PromptContext {
    return {
      type: this.mapElementTypeToContextType(element.type),
      content: element.content,
      relevance: element.importance / 10,
      timeframe
    };
  }

  private mapElementTypeToContextType(
    elementType: string
  ): 'character' | 'plot' | 'setting' | 'theme' {
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

  private deriveObjectives(
    focus: TextFocus,
    constraints: PromptConstraint[]
  ): string[] {
    const objectives: string[] = [
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

  public updateContextHistory(focusId: string, context: PromptContext) {
    const existing = this.contextHistory.get(focusId) || [];
    existing.push(context);
    this.contextHistory.set(focusId, existing);
  }

  public addGlobalConstraint(constraint: PromptConstraint) {
    if (!this.activeConstraints.some(c => c.rule === constraint.rule)) {
      this.activeConstraints.push(constraint);
    }
  }

  public addTemplate(name: string, template: PromptTemplate) {
    this.templates.set(name, template);
  }

  public integrateChunkAnalysis(analysis: ChunkAnalysis): ContextWindow {
    const contextualElements: ContextualElement[] = analysis.contextualElements.map(element => ({
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

  private determineRelation(element: any): 'setup' | 'callback' | 'development' | 'resolution' {
    // This would use more sophisticated logic in a full implementation
    if (element.firstMention === element.lastMention) {
      return 'development';
    }
    return element.firstMention ? 'callback' : 'setup';
  }

  /**
   * Generates a prompt based on sequential analysis history
   */
  public createSequentialPrompt(
    thought: StoryAnalysisThought,
    thoughtHistory: StoryAnalysisThought[]
  ): DynamicPrompt {
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
      timeframe: 'past' as const
    }));

    // Add current narrative context if available
    if (thought.narrativeContext) {
      if (thought.narrativeContext.theme) {
        contextElements.push(...thought.narrativeContext.theme.map(theme => ({
          type: 'theme' as const,
          content: theme,
          relevance: 1,
          timeframe: 'present' as const
        })));
      }

      if (thought.narrativeContext.characters) {
        contextElements.push(...thought.narrativeContext.characters.map(char => ({
          type: 'character' as const,
          content: char,
          relevance: 1,
          timeframe: 'present' as const
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

  private determineThoughtType(thought: StoryAnalysisThought): 'character' | 'plot' | 'setting' | 'theme' {
    // Analyze thought content to determine its primary focus
    const content = thought.thought.toLowerCase();
    const narrativeContext = thought.narrativeContext;

    if (narrativeContext?.characters?.length) return 'character';
    if (narrativeContext?.plotPoints?.length) return 'plot';
    if (content.includes('theme') || narrativeContext?.theme?.length) return 'theme';
    if (content.includes('location') || content.includes('setting')) return 'setting';

    return 'plot'; // Default to plot if unclear
  }

  private calculateThoughtRelevance(
    pastThought: StoryAnalysisThought,
    currentThought: StoryAnalysisThought
  ): number {
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

  private countSharedElements(thought1: StoryAnalysisThought, thought2: StoryAnalysisThought): number {
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

  private countSharedArrayElements(arr1: string[], arr2: string[]): number {
    return arr1.filter(item => arr2.includes(item)).length;
  }

  private generateAnalysisConstraints(thought: StoryAnalysisThought): PromptConstraint[] {
    const constraints: PromptConstraint[] = [];

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

  private deriveAnalysisObjectives(thought: StoryAnalysisThought): string[] {
    const objectives: string[] = [
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
