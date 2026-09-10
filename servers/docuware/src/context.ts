/** Kontext und Tool-Typ für die DocuWare-Tools. */
import type { Docuware } from "./client";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  dw: Docuware;
  kv: KVNamespace;
  /** Öffentliche Basis-URL dieses Workers — für Download-Links. */
  origin: string;
}

export type DwTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
