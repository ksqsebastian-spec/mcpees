/** Kontext und Tool-Typ für die Lexware-Tools. */
import type { Lexware } from "./client";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  lex: Lexware;
  /** Der API-Key — nur für das Versiegeln von Download-Links, nie im Ergebnis. */
  credential: string;
  kv: KVNamespace;
  /** Öffentliche Basis-URL dieses Workers — für Download-Links. */
  origin: string;
}

export type LexTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
