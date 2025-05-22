/**
 * Represents a scene in a story with text content, character information, and paragraph boundaries
 */
export interface Scene {
    /** The full text content of the scene */
    text: string;
    /** The starting paragraph number of this scene */
    startParagraph: number;
    /** The ending paragraph number of this scene */
    endParagraph: number;
    /** Set of character names that appear in this scene */
    characters: Set<string>;
    /** The scene's emotional score */
    emotionalScore: {
        joy: number;
        sadness: number;
        anger: number;
        fear: number;
        surprise: number;
    };
    /** The location where the scene takes place */
    location?: string;
}
