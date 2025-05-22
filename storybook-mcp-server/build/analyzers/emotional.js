import nlp from 'compromise';
import sentiment from 'sentiment';
import logger from '../utils/logger';
export class EmotionalAnalyzer {
    constructor() {
        this.sentimentAnalyzer = new sentiment();
        this.emotionKeywords = {
            joy: ['happy', 'joy', 'laugh', 'smile', 'delight', 'pleasure', 'excited'],
            sadness: ['sad', 'cry', 'tears', 'grief', 'sorrow', 'depressed', 'miserable'],
            anger: ['angry', 'rage', 'fury', 'hostile', 'irritated', 'mad', 'furious'],
            fear: ['afraid', 'fear', 'terror', 'panic', 'dread', 'horror', 'scared'],
            surprise: ['surprise', 'shock', 'amazed', 'astonished', 'stunned', 'unexpected']
        };
    }
    /**
     * Analyzes the emotional content of a manuscript
     */
    analyzeEmotions(text, sceneDelimiter = '***') {
        try {
            const doc = nlp(text);
            const scenes = this.splitIntoScenes(doc, sceneDelimiter);
            // Analyze each scene's emotional content
            scenes.forEach(scene => {
                this.analyzeSceneEmotions(scene);
            });
            const emotionalArc = this.generateEmotionalArc(scenes);
            const highPoints = this.findEmotionalHighPoints(scenes);
            const suggestions = this.generatePacingSuggestions(scenes);
            return {
                scenes,
                emotionalArc,
                pacingSuggestions: suggestions,
                emotionalHighPoints: highPoints,
            };
        }
        catch (error) {
            logger.error('Error in emotional analysis:', { error });
            throw new Error(`Failed to analyze emotions: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Splits the manuscript into scenes
     */
    splitIntoScenes(doc, delimiter) {
        const scenes = [];
        let currentScene = null;
        // Get all paragraphs first
        const paragraphs = doc.paragraphs();
        paragraphs.forEach((p, index) => {
            const paragraph = p;
            const text = paragraph.text();
            if (text.includes(delimiter) || !currentScene) {
                if (currentScene !== null) {
                    currentScene.endParagraph = index - 1;
                    scenes.push(currentScene);
                }
                currentScene = {
                    text,
                    startParagraph: index,
                    endParagraph: index,
                    characters: new Set(),
                    emotionalScore: this.createEmptyEmotionalScore(),
                    location: undefined
                };
            }
            if (currentScene !== null) {
                this.updateSceneCharacters(currentScene, text);
                this.updateSceneLocation(currentScene, text);
            }
        });
        // Add final scene
        if (currentScene !== null) {
            currentScene.endParagraph = paragraphs.length - 1;
            scenes.push(currentScene);
        }
        return scenes;
    }
    /**
     * Creates an empty emotional score object
     */
    createEmptyEmotionalScore() {
        return {
            joy: 0,
            sadness: 0,
            anger: 0,
            fear: 0,
            surprise: 0
        };
    }
    /**
     * Analyzes the emotional content of a scene
     */
    analyzeSceneEmotions(scene) {
        Object.keys(this.emotionKeywords).forEach(emotion => {
            const keywords = this.emotionKeywords[emotion];
            const score = keywords.reduce((total, word) => {
                const regex = new RegExp(word, 'gi');
                const matches = scene.text?.match(regex) || [];
                return total + matches.length;
            }, 0);
            scene.emotionalScore[emotion] = score;
        });
        // Add sentiment analysis score
        const sentimentResult = this.sentimentAnalyzer.analyze(scene.text || '');
        scene.emotionalScore.joy += Math.max(0, sentimentResult.score);
        scene.emotionalScore.sadness += Math.abs(Math.min(0, sentimentResult.score));
    }
    /**
     * Updates the character list for a scene
     */ updateSceneCharacters(scene, text) {
        const doc = nlp(text);
        const names = doc.match('#Person+').out('array');
        names.forEach((name) => scene.characters.add(name));
    }
    /**
     * Updates the location for a scene
     */
    updateSceneLocation(scene, text) {
        const doc = nlp(text);
        const locations = doc.places().out('array');
        if (locations.length > 0) {
            scene.location = locations[0];
        }
    }
    /**
     * Generates the emotional arc for the manuscript
     */
    generateEmotionalArc(scenes) {
        const points = scenes.map((scene, index) => ({
            paragraph: scene.startParagraph,
            emotions: scene.emotionalScore
        }));
        // Calculate overall emotional trend
        const overallTrend = this.calculateEmotionalTrend(points);
        return {
            points,
            overallTrend
        };
    }
    /**
     * Calculates the overall emotional trend
     */
    calculateEmotionalTrend(points) {
        const emotionTrends = Object.keys(points[0].emotions).map(emotion => {
            const values = points.map(p => p.emotions[emotion]);
            const trend = this.calculateTrendSlope(values);
            return { emotion, trend };
        });
        const dominantTrend = emotionTrends.reduce((prev, curr) => Math.abs(curr.trend) > Math.abs(prev.trend) ? curr : prev);
        return `${dominantTrend.emotion} ${dominantTrend.trend > 0 ? 'increasing' : 'decreasing'}`;
    }
    /**
     * Calculates the slope of a trend line
     */
    calculateTrendSlope(values) {
        const n = values.length;
        const indices = Array.from({ length: n }, (_, i) => i);
        const sumX = indices.reduce((a, b) => a + b, 0);
        const sumY = values.reduce((a, b) => a + b, 0);
        const sumXY = indices.reduce((acc, x, i) => acc + x * values[i], 0);
        const sumXX = indices.reduce((acc, x) => acc + x * x, 0);
        return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }
    /**
     * Finds emotional high points in the manuscript
     */
    findEmotionalHighPoints(scenes) {
        const highPoints = [];
        const threshold = 3; // Minimum score to be considered a high point
        scenes.forEach((scene, index) => {
            Object.entries(scene.emotionalScore).forEach(([emotion, score]) => {
                if (score >= threshold) {
                    highPoints.push({
                        paragraph: scene.startParagraph,
                        emotion: emotion,
                        intensity: score,
                        context: this.getSceneContext(scene)
                    });
                }
            });
        });
        return highPoints.sort((a, b) => b.intensity - a.intensity);
    }
    /**
     * Gets a brief context description for a scene
     */
    getSceneContext(scene) {
        return `Scene at ${scene.location || 'unknown location'} with characters: ${Array.from(scene.characters).join(', ')}`;
    }
    /**
     * Generates pacing suggestions based on emotional analysis
     */
    generatePacingSuggestions(scenes) {
        const suggestions = [];
        // Check for emotional monotony
        const emotionalVariation = this.calculateEmotionalVariation(scenes);
        if (emotionalVariation < 2) {
            suggestions.push('Consider adding more emotional variety to scenes');
        }
        // Check for pacing issues
        const pacingIssues = this.analyzePacing(scenes);
        suggestions.push(...pacingIssues);
        return suggestions;
    }
    /**
     * Calculates the emotional variation across scenes
     */
    calculateEmotionalVariation(scenes) {
        const emotionTypes = Object.keys(scenes[0].emotionalScore);
        const variations = emotionTypes.map(emotion => {
            const values = scenes.map(s => s.emotionalScore[emotion]);
            return Math.max(...values) - Math.min(...values);
        });
        return Math.max(...variations);
    }
    /**
     * Analyzes the pacing of scenes
     */
    analyzePacing(scenes) {
        const suggestions = [];
        const consecutiveHighIntensity = scenes.reduce((count, scene) => {
            const totalIntensity = Object.values(scene.emotionalScore).reduce((a, b) => a + b, 0);
            return totalIntensity > 5 ? count + 1 : 0;
        }, 0);
        if (consecutiveHighIntensity > 3) {
            suggestions.push('Consider adding quieter moments between high-intensity scenes');
        }
        const consecutiveLowIntensity = scenes.reduce((count, scene) => {
            const totalIntensity = Object.values(scene.emotionalScore).reduce((a, b) => a + b, 0);
            return totalIntensity < 2 ? count + 1 : 0;
        }, 0);
        if (consecutiveLowIntensity > 3) {
            suggestions.push('Consider adding more emotional intensity to maintain reader engagement');
        }
        return suggestions;
    }
}
