export type FieldType = 'string' | 'text' | 'number' | 'boolean' | 'json' | 'select' | 'secret';

export interface Field {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  default?: string | number | boolean;
  options?: string[];
  placeholder?: string;
  hint?: string;
  rows?: number;
}

export interface Operation {
  id: string;
  group: string;
  label: string;
  method: string;
  path: string;
  stream?: boolean;
  description?: string;
  fields: Field[];
}

export interface ThemeColors {
  primary: string;
  bg: string;
  surface: string;
  surfaceAlt: string;
  text: string;
  muted: string;
  border: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  colors: ThemeColors;
  fontFamily: string;
  fontSize: number;
  radius: number;
  defaultModel: string;
  defaultTemperature: string;
  defaultMaxTokens: string;
  enableSecretFields: boolean;
  persistKey: boolean;
  numFieldWidth: number;
  selectFieldWidth: number;
  textFieldBasis: number;
  responseMaxVh: number;
}
