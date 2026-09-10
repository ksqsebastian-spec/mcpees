/**
 * Was in dieser DocuWare-Installation steht — Organisation, Aktenschränke, Dialoge, Felder.
 *
 * Die Platform-API gibt keine Pfade her, sondern Beziehungen: von der Wurzel zur
 * Organisation, von dort zu den Aktenschränken, von einem Aktenschrank zu seinen Dialogen,
 * vom Suchdialog zum Ausdruck, über den gesucht wird. Wer das bei jedem Tool-Aufruf neu
 * abläuft, macht fünf Anfragen, bevor die erste Frage überhaupt gestellt ist.
 *
 * Deshalb wird es einmal abgelaufen und zwölf Stunden in KV gelegt — pro Zugang, wie bei
 * HERO die Mandanten-IDs und bei sevdesk die Pflicht-IDs. Aktenschränke und Indexfelder
 * ändern sich in DocuWare selten und nie im Vorbeigehen; ändert sich doch etwas, ist es
 * spätestens nach zwölf Stunden da.
 *
 * Zwei Feinheiten aus dem Quelltext von sniner/docuware-client sind hier eingebaut:
 *
 *  - Ein Aktenschrank mit `IsBasket` ist kein Archiv, sondern ein Briefkorb. Beides kommt
 *    aus derselben Liste; wer das nicht trennt, sucht im Posteingang nach Archivbelegen.
 *  - Unter den Dialogen stehen auch systemeigene Kopien für die mobile Ansicht. Sie sehen
 *    aus wie normale Suchdialoge, ihre Id trägt aber einen Unterstrich. Nimmt man sie,
 *    sucht man in etwas, das der Benutzer in DocuWare gar nicht sieht.
 */
import { Docuware, DocuwareError, link, links } from "./client";
import { sha256hex } from "../../../shared/src/crypto";

const TTL_SECONDS = 12 * 60 * 60;

export interface CabinetInfo {
  id: string;
  name: string;
  /** Briefkorb statt Aktenschrank — dieselbe Liste, anderer Zweck. */
  isBasket: boolean;
  /** Beziehung `documents`: hier hängen die Dokumente, hierhin wird abgelegt. */
  documents: string;
  /** Beziehung `dialogs`: Such- und Ablagedialoge dieses Schranks. */
  dialogs: string | null;
}

export interface Structure {
  version: string;
  organizationId: string;
  organizationName: string;
  cabinets: CabinetInfo[];
  fetchedAt: number;
}

export interface FieldInfo {
  /** Der Name, den die API will — DBFieldName, z. B. 'DOCDATE'. */
  id: string;
  /** Der Name, den der Benutzer in DocuWare sieht, z. B. 'Belegdatum'. */
  label: string;
  /** DWFieldType, wie DocuWare ihn meldet: Text, Numeric, Date, DateTime, Memo, Keywords … */
  type: string;
  length: number | null;
  /** Beziehung auf die Auswahlliste, falls das Feld eine hat. */
  selectList: string | null;
  /** In welchen Dialogen das Feld vorkommt — sagt, ob man danach suchen oder es füllen kann. */
  in: Array<"suche" | "ablage">;
}

export interface CabinetDetail {
  cabinet: CabinetInfo;
  /** Der Suchdialog, über den gesucht wird — samt Adresse seines Ausdrucks. */
  searchDialog: { id: string; name: string; expression: string } | null;
  storeDialog: { id: string; name: string } | null;
  fields: FieldInfo[];
  fetchedAt: number;
}

/** Umlaute weg, Kleinschreibung — macht den Vergleich von Namen robust. */
export function norm(s: unknown): string {
  return String(s ?? "")
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

async function keyFor(dw: Docuware, suffix: string): Promise<string> {
  return `dw:${suffix}:${await sha256hex(
    `${dw.credentials.url} ${dw.credentials.username} ${dw.credentials.password}`,
  )}`;
}

/**
 * Organisation und Aktenschränke.
 *
 * Mehrere Organisationen an einem Zugang sind bei DocuWare möglich, aber die Ausnahme.
 * Genommen wird die erste; welche es ist, steht in jeder Antwort von `system_info`, damit
 * niemand rätselt, in wessen Schränken gerade gesucht wird.
 */
export async function structure(dw: Docuware, kv: KVNamespace | null): Promise<Structure> {
  const key = await keyFor(dw, "struct");
  if (kv) {
    const cached = await kv.get<Structure>(key, "json");
    if (cached?.cabinets) return cached;
  }

  const root = await dw.json<any>("GET", dw.platform);
  const orgList = await dw.json<any>(
    "GET",
    link(root, "organizations", "Die DocuWare-Wurzel"),
  );
  const orgs: any[] = Array.isArray(orgList?.Organization) ? orgList.Organization : [];
  if (orgs.length === 0) {
    throw new DocuwareError(
      "Dieser Zugang sieht keine einzige Organisation. In DocuWare hängen die Rechte am " +
        "Benutzer — ohne Zuordnung zu einer Organisation ist die API leer.",
    );
  }
  const org = orgs[0];

  const cabinetList = await dw.json<any>(
    "GET",
    link(org, "filecabinets", `Die Organisation '${org?.Name ?? ""}'`),
  );
  const cabinets: CabinetInfo[] = (
    Array.isArray(cabinetList?.FileCabinet) ? cabinetList.FileCabinet : []
  ).map((fc: any) => {
    const rel = links(fc);
    return {
      id: String(fc?.Id ?? ""),
      name: String(fc?.Name ?? ""),
      isBasket: Boolean(fc?.IsBasket),
      documents: rel["documents"] ?? "",
      dialogs: rel["dialogs"] ?? null,
    };
  });

  const found: Structure = {
    version: String(root?.Version ?? "unbekannt"),
    organizationId: String(org?.Id ?? ""),
    organizationName: String(org?.Name ?? ""),
    cabinets,
    fetchedAt: Date.now(),
  };
  await kv?.put(key, JSON.stringify(found), { expirationTtl: TTL_SECONDS });
  return found;
}

/**
 * Einen Aktenschrank finden — nach Id oder Name.
 *
 * Nach Name, weil in DocuWare niemand die Ids kennt: der Benutzer sagt „Eingangsrechnungen",
 * nicht „a1b2c3…". Gibt es den Namen nicht, werden die vorhandenen genannt — eine
 * Fehlermeldung ohne die Auswahl wäre eine Sackgasse.
 */
export function findCabinet(struct: Structure, key: string, basketsToo = true): CabinetInfo {
  const wanted = String(key ?? "").trim();
  if (!wanted) throw new DocuwareError("Es fehlt die Angabe, welcher Aktenschrank gemeint ist.");
  const pool = basketsToo ? struct.cabinets : struct.cabinets.filter((c) => !c.isBasket);

  const hit =
    pool.find((c) => c.id === wanted) ?? pool.find((c) => norm(c.name) === norm(wanted));
  if (hit) return hit;

  const liste = pool.map((c) => `${c.name}${c.isBasket ? " (Briefkorb)" : ""}`).join(", ");
  throw new DocuwareError(
    `'${wanted}' ist kein Aktenschrank dieses Zugangs. Vorhanden: ${liste || "keiner"}.`,
  );
}

/**
 * Dialoge und Indexfelder eines Aktenschranks.
 *
 * Die Felder kommen aus den Dialogen, nicht aus dem Schrank selbst — so gibt DocuWare sie
 * her. Gesammelt werden die des Suchdialogs (danach lässt sich suchen) und die des
 * Ablagedialogs (die lassen sich beim Ablegen füllen); wo ein Feld in beiden vorkommt,
 * bleibt es ein Feld und trägt beide Vermerke.
 */
export async function cabinetDetail(
  dw: Docuware,
  kv: KVNamespace | null,
  cabinet: CabinetInfo,
): Promise<CabinetDetail> {
  const key = `${await keyFor(dw, "cab")}:${cabinet.id}`;
  if (kv) {
    const cached = await kv.get<CabinetDetail>(key, "json");
    if (cached?.fields) return cached;
  }

  if (!cabinet.dialogs) {
    throw new DocuwareError(
      `'${cabinet.name}' nennt keine Dialoge. Ohne Suchdialog gibt DocuWare weder die ` +
        `Indexfelder her noch eine Adresse, an die eine Suche gehen könnte.`,
    );
  }

  const dialogList = await dw.json<any>("GET", cabinet.dialogs);
  const all: any[] = Array.isArray(dialogList?.Dialog) ? dialogList.Dialog : [];
  /*
   * Nur echte, benutzersichtbare Dialoge. `$type` grenzt die Einträge ab, die bloß
   * Beschreibungen sind; der Unterstrich in der Id die systemeigenen Kopien für die
   * mobile Ansicht — die sehen aus wie das Original und sind es nicht.
   */
  const usable = all.filter(
    (d) => d?.$type === "DialogInfo" && !String(d?.Id ?? "").includes("_"),
  );

  const searchInfo =
    usable.find((d) => d?.Type === "Search" && d?.IsDefault) ??
    usable.find((d) => d?.Type === "Search") ??
    null;
  const storeInfo =
    usable.find((d) => d?.Type === "Store" && d?.IsDefault) ??
    usable.find((d) => d?.Type === "Store") ??
    null;

  const felder = new Map<string, FieldInfo>();
  const sammle = (config: any, woher: "suche" | "ablage") => {
    for (const f of Array.isArray(config?.Fields) ? config.Fields : []) {
      const id = String(f?.DBFieldName ?? "").trim();
      if (!id) continue;
      const vorhanden = felder.get(id);
      if (vorhanden) {
        if (!vorhanden.in.includes(woher)) vorhanden.in.push(woher);
        continue;
      }
      const laenge = Number(f?.Length);
      felder.set(id, {
        id,
        label: String(f?.DlgLabel ?? id),
        type: String(f?.DWFieldType ?? "unbekannt"),
        length: Number.isFinite(laenge) && laenge > 0 ? laenge : null,
        selectList: links(f)["simpleselectlist"] ?? null,
        in: [woher],
      });
    }
  };

  let searchDialog: CabinetDetail["searchDialog"] = null;
  if (searchInfo) {
    const config = await dw.json<any>(
      "GET",
      link(searchInfo, "self", `Der Suchdialog '${searchInfo?.DisplayName ?? searchInfo?.Id}'`),
    );
    sammle(config, "suche");
    searchDialog = {
      id: String(searchInfo?.Id ?? ""),
      name: String(searchInfo?.DisplayName ?? searchInfo?.Id ?? ""),
      // Gesucht wird nicht gegen den Dialog, sondern gegen den Ausdruck darunter.
      expression: link(
        config?.Query,
        "dialogExpression",
        `Der Suchdialog '${searchInfo?.DisplayName ?? searchInfo?.Id}'`,
      ),
    };
  }

  let storeDialog: CabinetDetail["storeDialog"] = null;
  if (storeInfo) {
    const config = await dw.json<any>(
      "GET",
      link(storeInfo, "self", `Der Ablagedialog '${storeInfo?.DisplayName ?? storeInfo?.Id}'`),
    );
    sammle(config, "ablage");
    storeDialog = {
      id: String(storeInfo?.Id ?? ""),
      name: String(storeInfo?.DisplayName ?? storeInfo?.Id ?? ""),
    };
  }

  const detail: CabinetDetail = {
    cabinet,
    searchDialog,
    storeDialog,
    fields: [...felder.values()],
    fetchedAt: Date.now(),
  };
  await kv?.put(key, JSON.stringify(detail), { expirationTtl: TTL_SECONDS });
  return detail;
}

/**
 * Einen Feldnamen auflösen — Id oder Anzeigename.
 *
 * Das ist die häufigste Falle beim Suchen: in DocuWare heißt das Feld auf dem Bildschirm
 * „Belegdatum", die API kennt aber nur `DOCDATE`. Wer den Anzeigenamen schickt, bekommt
 * 400 und weiß nicht, warum. Hier geht beides, und was es nicht gibt, wird mit der
 * vollständigen Liste beantwortet statt mit einem Fehlercode.
 */
export function findField(detail: CabinetDetail, name: string): FieldInfo {
  const wanted = String(name ?? "").trim();
  if (!wanted) throw new DocuwareError("Es fehlt der Feldname.");
  const hit =
    detail.fields.find((f) => f.id.toLowerCase() === wanted.toLowerCase()) ??
    detail.fields.find((f) => norm(f.label) === norm(wanted));
  if (hit) return hit;

  const liste = detail.fields.map((f) => `${f.id} (${f.label})`).join(", ");
  throw new DocuwareError(
    `'${wanted}' ist kein Indexfeld von '${detail.cabinet.name}'. Vorhanden: ${liste || "keine"}.`,
  );
}
