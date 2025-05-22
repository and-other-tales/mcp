/**
 * Types for the human reader simulator
 */

export interface ReaderDemographics {
  age: number;
  educationLevel: 'primary' | 'secondary' | 'undergraduate' | 'postgraduate' | 'professional';
  readingSpeed: 'slow' | 'average' | 'fast';
  attentionSpan: 'short' | 'medium' | 'long';
  interests: string[];
  genre_preferences: string[];
  language_proficiency: 'basic' | 'intermediate' | 'advanced' | 'native';
}

export interface ReadingBehavior {
  elapsed_time: number;
  paragraph_number: number;
  attention_level: number; // 0-1
  comprehension_level: number; // 0-1
  is_skimming: boolean;
  reading_speed_wpm: number;
  engagement_markers: EngagementMarker[];
}

export interface EngagementMarker {
  type: 'interest_peak' | 'attention_drop' | 'confusion' | 'emotional_response' | 'skimming_start' | 'skimming_end';
  paragraph_number: number;
  intensity: number; // 0-1
  reason: string;
}

export interface ReaderSimulationResult {
  demographics: ReaderDemographics;
  reading_timeline: ReadingBehavior[];
  engagement_summary: {
    most_engaging_sections: Array<{
      start_paragraph: number;  
      end_paragraph: number;
      engagement_score: number;
      reason: string;
    }>;
    least_engaging_sections: Array<{
      start_paragraph: number;
      end_paragraph: number;
      engagement_score: number;
      reason: string;
    }>;
    skimmed_sections: Array<{
      start_paragraph: number;
      end_paragraph: number;
      reason: string;
    }>;
    overall_engagement_score: number;
    reading_completion_rate: number;
    average_comprehension: number;
  };
  suggestions: Array<{
    type: 'pacing' | 'complexity' | 'engagement' | 'structure';
    target_paragraph_range?: [number, number];
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}
