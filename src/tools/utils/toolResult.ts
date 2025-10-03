// Minimal content type compatible with MCP 'content' items
type TextContent = { type: "text"; text: string; annotations?: Record<string, unknown> };

// Minimal type for structured error to keep consistency across tools
export interface StructuredError {
  error: true;
  message: string;
  status?: number;
  data?: unknown;
}

export interface SuccessOptions<T = unknown> {
  text: string;
  structured?: T;
  annotations?: Record<string, unknown>;
}

export interface FailureOptions {
  message: string;
  status?: number;
  data?: unknown;
  annotations?: Record<string, unknown>;
}

export function success<T = unknown>({ text, structured, annotations }: SuccessOptions<T>) {
  const content: TextContent[] = [
    { type: "text", text, ...(annotations ? { annotations } : {}) },
  ];
  const result: any = { content };
  if (typeof structured !== "undefined") {
    result.structuredContent = structured;
  }
  return result;
}

export function failure({ message, status, data, annotations }: FailureOptions) {
  const content: TextContent[] = [
    { type: "text", text: message, ...(annotations ? { annotations } : {}) },
  ];
  return {
    content,
    isError: true,
    structuredContent: {
      error: true,
      message,
      ...(typeof status !== "undefined" ? { status } : {}),
      ...(typeof data !== "undefined" ? { data } : {}),
    } satisfies StructuredError | (StructuredError & { status: number }) | (StructuredError & { data: unknown }),
  } as any;
}
