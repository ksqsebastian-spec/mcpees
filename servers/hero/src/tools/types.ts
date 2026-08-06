import type { Hero } from "../hero";
import type { TenantConfig } from "../tenant";

export interface ToolContext {
  hero: Hero;
  cfg: TenantConfig;
  kv: KVNamespace;
}

export interface ToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

export interface JsonSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: ToolAnnotations;
  handler: (args: Record<string, any>, ctx: ToolContext) => Promise<unknown>;
}

export const str = (description: string) => ({ type: "string", description });
export const int = (description: string) => ({ type: "integer", description });
export const num = (description: string) => ({ type: "number", description });
export const bool = (description: string) => ({ type: "boolean", description });

/** Pflichtargument prüfen — bevor ein Request rausgeht. */
export function req<T>(args: Record<string, any>, name: string): T {
  const v = args[name];
  if (v === undefined || v === null || v === "") {
    throw new Error(`Pflichtargument '${name}' fehlt.`);
  }
  return v as T;
}
