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
  relation?: string; // child-link style: biological (default) | adopted | foster | step
  twin?: string; // twin-group key; children of the same parents sharing it drop from one apex
  identical: boolean; // identical-twin bar across the group's legs (set on every member)
  color?: string; // shape stroke + decoration marks + badge border
  fill?: string; // shape interior
  badge?: string; // name badge background
  shape?: string; // overrides the sex-derived shape (e.g. miscarriage, pregnancy, abortion)
}

export interface Union {
  id: string;
  partners: string[];
  status: string;
  year?: number | string;
  decorations: string[];
  color?: string; // overrides the line color
  children?: string[]; // shorthand: sets each listed person's `parents` to this union
}

export interface EmotionalLink {
  id: string;
  between: string[];
  kind: string;
  color?: string; // overrides the kind's default color
}

export interface Annotation {
  id: string;
  text: string; // may contain newlines (TOML multiline strings render as multiple lines)
  attach?: string; // person id; layout entry becomes an offset from that person
  color?: string; // text color
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
