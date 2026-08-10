/** Kontext und Tool-Typ für die FLOWWER-Tools. */
import type { Flowwer } from "./client";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  flw: Flowwer;
  kv: KVNamespace;
  /** Salz für den Schema-Cache, damit er an den Zugang gebunden ist. */
  cacheSalt: string;
}

export type FlowwerTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
