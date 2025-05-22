import { ReaderDemographics } from "./reader";

export interface AnalyzerInput {
  text: string;
  focusCharacter?: string;
  sceneDelimiter?: string;
  mainCharacters?: string[];
}

export interface ServerRequest {
  params: {
    uri: string;
  };
}

export interface SimulateReaderInput {
  text: string;
  demographics: ReaderDemographics;
}

export type MpcResponse = {
  content: Array<{
    type: "text";
    text: string;
  } | {
    type: "image";
    data: string;
    mimeType: string;
  } | {
    type: "audio";
    data: string;
    mimeType: string;
  } | {
    type: "resource";
    resource: {
      text: string;
      uri: string;
      mimeType?: string;
    } | {
      uri: string;
      blob: string;
      mimeType?: string;
    };
  }>;
  _meta?: {
    [key: string]: unknown;
  };
  structuredContent?: {
    [key: string]: unknown;
  };
};
