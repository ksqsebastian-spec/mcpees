import { readTools } from "./read";
import { writeTools } from "./write";
import type { HeroTool } from "../context";

export const tools: HeroTool[] = [...readTools, ...writeTools];
