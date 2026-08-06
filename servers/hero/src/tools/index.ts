import { readTools } from "./read";
import { writeTools } from "./write";
import type { ToolDef } from "./types";

export const tools: ToolDef[] = [...readTools, ...writeTools];

export const toolsByName = new Map<string, ToolDef>(tools.map((t) => [t.name, t]));

export type { ToolDef, ToolContext } from "./types";
