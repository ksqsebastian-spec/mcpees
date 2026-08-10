/** Kontext und Tool-Typ für die sevdesk-Tools. */
import type { Sevdesk } from "./client";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  sev: Sevdesk;
  /** Der API-Token — nur für das Versiegeln von Download-Links, nie im Ergebnis. */
  credential: string;
  kv: KVNamespace;
  /** Öffentliche Basis-URL dieses Workers — für Download-Links. */
  origin: string;
}

export type SevTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
