// Single source of truth: every door (website, MCP, WebMCP) reads from data/*.json through here.
import boilersJson from "../data/boilers.json";
import guidesJson from "../data/guides.json";
import faultsJson from "../data/faults.json";
import partsJson from "../data/parts.json";
import checklistsJson from "../data/checklists.json";
import manualsJson from "../data/manuals.json";
import bulletinsJson from "../data/bulletins.json";
import installersJson from "../data/installers.json";
import engineersJson from "../data/engineers.json";
import warrantyJson from "../data/warranty.json";

export type Boiler = (typeof boilersJson)[number] & { heatPump?: Record<string, unknown> };
export type Guide = (typeof guidesJson)[number];
export type Fault = (typeof faultsJson)[number];
export type Part = (typeof partsJson)[number]["parts"][number];
export type Checklist = (typeof checklistsJson)[number];
export type Manual = (typeof manualsJson)[number];
export type Bulletin = (typeof bulletinsJson)[number];
export type Installer = (typeof installersJson)[number];
export type Engineer = (typeof engineersJson)[number];

export const boilers = boilersJson as Boiler[];
export const guides = guidesJson;
export const faults = faultsJson;
export const partsByModel = partsJson;
export const checklists = checklistsJson;
export const manuals = manualsJson;
export const bulletins = bulletinsJson;
export const installers = installersJson;
export const engineers = engineersJson;
export const warranty = warrantyJson;

export const MODEL_LIST = boilers.map((b) => b.name).join(", ");
export const CODE_LIST = faults.map((f) => f.code).join(", ");

/** A problem the caller can fix, such as an unknown model. Shown to the agent as-is. */
export class LookupError extends Error {}

/** Accepts "C30", "c-30", "Norvane C30", "H30 Hybrid" and so on. */
export function findBoiler(input: string): Boiler | undefined {
  const key = String(input ?? "")
    .toLowerCase()
    .replace(/norvane|hybrid|boiler|combi|system|regular/g, "")
    .replace(/[^a-z0-9]/g, "");
  return boilers.find((b) => b.id === key);
}

export function requireBoiler(input: string): Boiler {
  const boiler = findBoiler(input);
  if (!boiler) throw new LookupError(`Unknown model "${input}". Norvane models are: ${MODEL_LIST}.`);
  return boiler;
}

/** Accepts "F28", "f 28", "28" and so on. */
export function normaliseCode(input: string): string {
  const digits = String(input ?? "").replace(/[^0-9]/g, "");
  return digits ? `F${digits.padStart(2, "0")}` : String(input ?? "").trim().toUpperCase();
}

export function requireFault(codeInput: string, boiler: Boiler): Fault {
  const code = normaliseCode(codeInput);
  const fault = faults.find((f) => f.code === code);
  if (!fault) throw new LookupError(`Unknown fault code "${codeInput}". Norvane fault codes are: ${CODE_LIST}.`);
  if (!fault.appliesTo.includes(boiler.id)) {
    const applies = fault.appliesTo.map((id) => boilers.find((b) => b.id === id)!.name).join(", ");
    throw new LookupError(
      `${fault.code} (${fault.title}) does not apply to the ${boiler.fullName}. It applies to: ${applies}. Check the code on the display.`,
    );
  }
  return fault;
}

export const byModel = <T extends { model: string }>(list: T[], id: string): T => list.find((x) => x.model === id)!;

export function partsFor(id: string): Part[] {
  return byModel(partsByModel, id).parts;
}

/** The leading letters of a UK postcode: "LS6 2AB" gives "LS". */
export function postcodeArea(postcode: string): string | undefined {
  const match = String(postcode ?? "").trim().toUpperCase().match(/^([A-Z]{1,2})\d/);
  return match?.[1];
}

export type VerifyResult =
  | { ok: true; engineer: Engineer }
  | { ok: false; reason: "no_match" | "lapsed" | "suspended"; message: string };

export function normaliseRegNumber(input: string): string {
  const digits = String(input ?? "").replace(/[^0-9]/g, "");
  return `NV-${digits}`;
}

/** Checks a registration number and surname against the fictional Norvane Registered Engineer scheme. */
export function verifyEngineer(regNumber: string, surname: string): VerifyResult {
  const reg = normaliseRegNumber(regNumber);
  const name = String(surname ?? "").trim().toLowerCase();
  const engineer = engineers.find((e) => e.regNumber === reg);
  // The same message whether the number or the surname is wrong, so the form cannot be used to find valid numbers.
  if (!engineer || !name || engineer.surname.toLowerCase() !== name) {
    return {
      ok: false,
      reason: "no_match",
      message: "We couldn't match that registration number and surname. Check both and try again.",
    };
  }
  if (engineer.status === "lapsed") {
    return {
      ok: false,
      reason: "lapsed",
      message: `Registration ${engineer.regNumber} lapsed on ${engineer.registeredUntil}. Renew your Norvane Registered Engineer membership to get access again.`,
    };
  }
  if (engineer.status === "suspended") {
    return {
      ok: false,
      reason: "suspended",
      message: `Registration ${engineer.regNumber} is suspended. Engineer content is not available. Contact the Norvane registration team.`,
    };
  }
  return { ok: true, engineer };
}

export function isActiveEngineer(regNumber: string): boolean {
  return engineers.some((e) => e.regNumber === regNumber && e.status === "active");
}
