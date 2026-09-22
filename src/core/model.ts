export type Sex = "M" | "F" | "U";

export interface Person {
  id: string;
  name?: string;
  sex: Sex;
  birth?: number | string;
  death?: number | string;
  index: boolean;
  decorations: string[];
  notes?: string;
  parents?: string; // union id, or person id for single-parent
}

export interface Union {
  id: string;
  partners: string[];
  status: string;
  year?: number | string;
  decorations: string[];
}

export interface EmotionalLink {
  id: string;
  between: string[];
  kind: string;
}

export interface Annotation {
  id: string;
  text: string;
  attach?: string; // person id; layout entry becomes an offset from that person
}

export interface GenoDocument {
  title?: string;
  people: Map<string, Person>;
  unions: Map<string, Union>;
  emotional: Map<string, EmotionalLink>;
  annotations: Map<string, Annotation>;
  layout: Map<string, [number, number]>;
}

export interface Diagnostic {
  severity: "error" | "warning";
  message: string;
  range: [number, number];
}
