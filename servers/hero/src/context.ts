/** Kontext und Tool-Typ für die HERO-Tools. */
import type { Hero } from "./hero";
import type { TenantConfig } from "./tenant";
import type { ToolDef } from "../../../shared/src/types";

export interface ToolContext {
  hero: Hero;
  cfg: TenantConfig;
  kv: KVNamespace;
}

export type HeroTool = ToolDef<ToolContext>;

export { str, int, num, bool, req } from "../../../shared/src/types";
