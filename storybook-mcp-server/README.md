# Storybook MCP Server

A Model Context Protocol server that provides advanced NLP-based analysis and improvement suggestions for fiction manuscripts. The server includes tools for dialogue enhancement, emotional resonance analysis, and character/event continuity tracking.

## Features

### 1. Dialogue Crafter Tool
- Analyzes and improves dialogue flow between characters
- Suggests improvements for natural conversation patterns
- Checks dialogue attribution and formatting
- Enhances character voice consistency

### 2. Emotional Resonance Analyzer
- Calculates emotional impact scores for scenes
- Provides scene-by-scene emotional arc visualization
- Suggests pacing improvements
- Identifies emotional high points and low points

### 3. Character Continuity Tracker
- Tracks character entrances and exits in scenes
- Monitors character locations throughout the manuscript
- Flags inconsistencies in character appearances
- Maintains character attribute consistency

### 4. Event Continuity Tracker
- Monitors plot events and their sequences
- Tracks timeline consistency
- Flags potential plot holes
- Maintains consistency of story elements

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

4. Start the server:
```bash
npm start
```

## Usage

The server provides several tools that can be accessed through the Model Context Protocol:

### Analyzing Dialogue
```typescript
{
  "tool": "dialogue-crafter",
  "params": {
    "text": "manuscript text",
    "focusCharacter": "optional character name",
    "analysisType": "flow|attribution|formatting|voice"
  }
}
```

### Analyzing Emotional Resonance
```typescript
{
  "tool": "emotional-resonance",
  "params": {
    "text": "manuscript text",
    "sceneDelimiter": "optional custom scene break marker"
  }
}
```

### Tracking Character Continuity
```typescript
{
  "tool": "character-continuity",
  "params": {
    "text": "manuscript text",
    "characters": ["optional list of main characters"]
  }
}
```

### Tracking Event Continuity
```typescript
{
  "tool": "event-continuity",
  "params": {
    "text": "manuscript text",
    "trackedEvents": ["optional list of specific events to track"]
  }
}
```

## Dependencies

- @modelcontextprotocol/sdk - Core MCP functionality
- compromise - Natural language processing
- natural - NLP toolkit
- sentiment - Sentiment analysis
- wink-nlp - Advanced NLP capabilities

## Testing

Run the test suite:
```bash
npm test
```

## License

MIT
