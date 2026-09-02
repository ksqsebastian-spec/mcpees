/** Kontext und Tool-Typ für die Plausible-Tools. */
import type { Plausible } from "./client";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  pl: Plausible;
}

export type PlausibleTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
