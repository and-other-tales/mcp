import { Scene } from './scene';
import { EmotionalScore } from './emotional';
import { NlpDocument } from './nlp';
import { ThesaurusSuggestion, SynonymContext, NarrativeContext, EmotionTone } from './thesaurus';

export { Scene } from './scene';
export { EmotionalScore } from './emotional';
export { NlpDocument } from './nlp';
export type { ThesaurusSuggestion, SynonymContext, NarrativeContext, EmotionTone } from './thesaurus';

export interface EmotionalAnalysisResult {
    scenes: Scene[];
    emotionalArc: {
        points: Array<{
            paragraph: number;
            emotions: EmotionalScore;
        }>;
        overallTrend: string;
    };
    pacingSuggestions: string[];
}

export interface EmotionalHighPoint {
    scene: Scene;
    emotions: EmotionalScore;
    intensity: number;
}

// Extend McpServer to include setRequestHandler
declare module "@modelcontextprotocol/sdk/server/mcp.js" {
    interface McpServer {
        setRequestHandler(name: string, handler: (request: any) => Promise<any>): void;
    }
}
