/** The parts of Gemini's generateContent REST shapes that the assistant uses. */
export interface GeminiFunctionCall {
  name: string;
  args?: Record<string, unknown>;
  id?: string;
}

export interface GeminiPart {
  text?: string;
  /** True for the model's private reasoning, which is never shown. */
  thought?: boolean;
  /** Opaque; has to be sent back unchanged with the part it came on. */
  thoughtSignature?: string;
  functionCall?: GeminiFunctionCall;
  functionResponse?: {
    name: string;
    id?: string;
    response: Record<string, unknown>;
  };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

export interface GeminiFunctionDeclaration {
  name: string;
  description: string;
  parameters?: {
    type: 'object';
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}
