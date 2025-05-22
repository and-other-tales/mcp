export interface NlpDocument {
  terms(): NlpDocument;
  text(): string;
  sentences(): NlpDocument;
  match(pattern: string): NlpDocument;
  out(format: string): any;
  places(): NlpDocument;
  forEach(fn: (term: any) => void): void;
  length: number;
  paragraphs(): NlpDocument[];
  quotations(): NlpDocument[];
  dates(): NlpDocument;
  parent(): NlpDocument;
  prev(): NlpDocument | null;
  document: NlpDocument;
  data(): Array<{text: string}>;
}

declare module 'compromise' {
  interface NlpFunction {
    (text: string): NlpDocument;
  }

  const nlp: NlpFunction;
  export default nlp;
  export { NlpDocument };
}
