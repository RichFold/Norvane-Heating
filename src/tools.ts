// One tool registry for all three doors. The MCP endpoints register these with the MCP SDK;
// the website exposes the same definitions to WebMCP through /api/tools.
import { z } from "zod";
import {
  boilers,
  bulletins,
  byModel,
  checklists,
  findBoiler,
  guides,
  installers,
  LookupError,
  manuals,
  MODEL_LIST,
  CODE_LIST,
  partsFor,
  postcodeArea,
  requireBoiler,
  requireFault,
  warranty,
  type Boiler,
} from "./data";
import { ENGINEER_POINTER, NOTICE } from "./types";

export type Tier = "public" | "engineer";

export interface ToolDef {
  name: string;
  title: string;
  tier: Tier;
  description: string;
  input: Record<string, z.ZodType>;
  output: Record<string, z.ZodType>;
  run: (args: any) => Record<string, unknown>;
}

const modelArg = z
  .string()
  .describe(`Norvane boiler model, for example "C30" or "Norvane C30". Models: ${MODEL_LIST}.`);
const codeArg = z
  .string()
  .describe(`Fault code shown on the boiler display, for example "F28". Codes: ${CODE_LIST}.`);
const notice = z.string().describe("Disclaimer that applies to every response.");

const summaryShape = {
  model: z.string(),
  name: z.string(),
  type: z.enum(["combi", "system", "regular", "hybrid"]),
  typeLabel: z.string(),
  summary: z.string(),
  centralHeatingKw: z.number(),
  hotWaterKw: z.number().describe("0 for boilers that heat a separate cylinder."),
  hotWaterFlowRateLpm: z.number().describe("Litres per minute at a 35 °C rise. 0 where a cylinder is used."),
  erpHeating: z.string(),
  seasonalEfficiencyPercent: z.number(),
  dimensionsMm: z.object({ heightMm: z.number(), widthMm: z.number(), depthMm: z.number() }),
  weightKg: z.number(),
  warrantyYears: z.number(),
  priceBand: z.string(),
  suitableFor: z.object({ homeSizes: z.array(z.string()), bedrooms: z.string(), bathrooms: z.string() }),
  url: z.string(),
};

const summarise = (b: Boiler) => ({
  model: b.name,
  name: b.fullName,
  type: b.type as "combi" | "system" | "regular" | "hybrid",
  typeLabel: b.typeLabel,
  summary: b.summary,
  centralHeatingKw: b.output.centralHeatingKw,
  hotWaterKw: b.output.hotWaterKw,
  hotWaterFlowRateLpm: b.output.hotWaterFlowRateLpm,
  erpHeating: b.efficiency.erpHeating,
  seasonalEfficiencyPercent: b.efficiency.seasonalSpaceHeatingPercent,
  dimensionsMm: b.dimensions,
  weightKg: b.weightKg,
  warrantyYears: b.warrantyYears,
  priceBand: b.priceBand,
  suitableFor: b.suitableFor,
  url: `/boilers/${b.id}`,
});

const headlineKw = (b: Boiler) => Math.max(b.output.centralHeatingKw, b.output.hotWaterKw);
const loose = z.record(z.string(), z.unknown());

const partShape = z.object({
  partNumber: z.string(),
  description: z.string(),
  category: z.string(),
  tradePriceGbp: z.number(),
});

export const tools: ToolDef[] = [
  // ───────────── Public tools: homeowner level ─────────────
  {
    name: "search_boilers",
    title: "Search Norvane boilers",
    tier: "public",
    description:
      "Find Norvane boilers that suit a home. Use this when someone is choosing a boiler or asks what Norvane makes. Filter by boiler type, output in kW, or home size; call it with no filters to list the whole range of six models. Returns a short summary of each match. Use get_boiler for one model's full specification.",
    input: {
      type: z
        .enum(["combi", "system", "regular", "hybrid"])
        .optional()
        .describe("Boiler type. Combi: instant hot water, no cylinder. System and regular: heat a hot water cylinder. Hybrid: heat pump plus gas boiler."),
      minKw: z.number().optional().describe("Minimum output in kW (the larger of heating and hot water output)."),
      maxKw: z.number().optional().describe("Maximum output in kW (the larger of heating and hot water output)."),
      homeSize: z
        .enum(["small", "medium", "large"])
        .optional()
        .describe("Small: flat or 1 to 2 bedrooms. Medium: 3 bedrooms, 1 to 2 bathrooms. Large: 4 or more bedrooms or 2 or more bathrooms."),
    },
    output: { count: z.number(), boilers: z.array(z.object(summaryShape)), notice },
    run: ({ type, minKw, maxKw, homeSize }) => {
      const matches = boilers.filter(
        (b) =>
          (!type || b.type === type) &&
          (minKw === undefined || headlineKw(b) >= minKw) &&
          (maxKw === undefined || headlineKw(b) <= maxKw) &&
          (!homeSize || b.suitableFor.homeSizes.includes(homeSize)),
      );
      return { count: matches.length, boilers: matches.map(summarise), notice: NOTICE };
    },
  },
  {
    name: "get_boiler",
    title: "Get boiler specification",
    tier: "public",
    description:
      "Get the full public specification for one Norvane boiler: outputs, efficiency and ErP rating, dimensions, weight, flue options, clearances, warranty length and price band. Use this for questions about a specific model, such as whether it will fit a cupboard or how much hot water it delivers.",
    input: { model: modelArg },
    output: { model: z.string(), boiler: loose.describe("Full specification."), url: z.string(), notice },
    run: ({ model }) => {
      const b = requireBoiler(model);
      return { model: b.name, boiler: b, url: `/boilers/${b.id}`, notice: NOTICE };
    },
  },
  {
    name: "compare_boilers",
    title: "Compare boilers",
    tier: "public",
    description:
      "Compare two or more Norvane boilers side by side: type, outputs, hot water flow rate, efficiency, size, weight, warranty and price band. Use this when someone is deciding between models.",
    input: { models: z.array(modelArg).min(2).max(6).describe("Two to six model names to compare.") },
    output: { count: z.number(), boilers: z.array(z.object(summaryShape)), notice },
    run: ({ models }) => {
      const list = (models as string[]).map(requireBoiler);
      return { count: list.length, boilers: list.map(summarise), notice: NOTICE };
    },
  },
  {
    name: "get_user_guide",
    title: "Get homeowner user guide",
    tier: "public",
    description:
      "Get the homeowner user guide for a Norvane boiler: what the controls do, how to top up the pressure, how to reset the boiler, frost protection and the annual service reminder. Use this for everyday how-do-I questions from someone who owns the boiler. It contains nothing that requires opening the boiler case.",
    input: { model: modelArg },
    output: { model: z.string(), guide: loose.describe("The user guide, section by section."), url: z.string(), notice },
    run: ({ model }) => {
      const b = requireBoiler(model);
      return { model: b.name, guide: byModel(guides, b.id), url: `/guides/${b.id}`, notice: NOTICE };
    },
  },
  {
    name: "lookup_fault_code_homeowner",
    title: "Look up a fault code (homeowner)",
    tier: "public",
    description:
      "Explain a fault code shown on a Norvane boiler display, for a homeowner. Returns what the code means in plain English, the one safe thing the homeowner can try, and when to call an engineer. Use this whenever someone reports a code such as F28. It deliberately contains no repair or diagnostic procedures: those are only available to registered engineers through the engineer connector.",
    input: { model: modelArg, code: codeArg },
    output: {
      model: z.string(),
      code: z.string(),
      title: z.string(),
      effect: z.string().describe("What the boiler does when this code appears."),
      whatItMeans: z.string(),
      safeThingToTry: z.string(),
      whenToCallAnEngineer: z.string(),
      safetyNote: z.string(),
      url: z.string(),
      notice,
      engineerPointer: z.string().describe("Where a registered engineer can get the full diagnostic."),
    },
    run: ({ model, code }) => {
      const b = requireBoiler(model);
      const f = requireFault(code, b);
      return {
        model: b.name,
        code: f.code,
        title: f.title,
        effect: f.severity,
        ...f.homeowner,
        url: `/fault-codes#${f.code}`,
        notice: NOTICE,
        engineerPointer: ENGINEER_POINTER,
      };
    },
  },
  {
    name: "find_installer",
    title: "Find an approved installer",
    tier: "public",
    description:
      "Find Norvane Approved Installers that cover a UK postcode. Use this when someone wants a boiler fitted, serviced or repaired, or asks who to call. Give a full postcode or just the first half, such as LS6 or SW11. Returns installer names, towns, phone numbers and the boiler types they fit.",
    input: { postcode: z.string().describe('UK postcode or outward code, for example "LS6 2AB" or "BS3".') },
    output: {
      postcodeArea: z.string(),
      count: z.number(),
      installers: z.array(
        z.object({
          name: z.string(),
          town: z.string(),
          phone: z.string(),
          installs: z.array(z.string()),
          rating: z.number(),
          accreditation: z.string(),
          covers: z.array(z.string()),
        }),
      ),
      message: z.string(),
      notice,
    },
    run: ({ postcode }) => {
      const area = postcodeArea(postcode);
      if (!area) throw new LookupError(`"${postcode}" does not look like a UK postcode. Try something like "LS6 2AB" or "BS3".`);
      const matches = installers
        .filter((i) => i.postcodeAreas.includes(area))
        .map((i) => ({
          name: i.name,
          town: i.town,
          phone: i.phone,
          installs: i.installs,
          rating: i.rating,
          accreditation: i.accreditation,
          covers: i.postcodeAreas,
        }));
      return {
        postcodeArea: area,
        count: matches.length,
        installers: matches,
        message: matches.length
          ? `${matches.length} Norvane Approved Installer${matches.length > 1 ? "s" : ""} cover${matches.length > 1 ? "" : "s"} the ${area} postcode area.`
          : `No Norvane Approved Installer covers the ${area} postcode area yet. Call the Norvane helpline on ${warranty.helpline} and we will find the nearest one.`,
        notice: NOTICE,
      };
    },
  },
  {
    name: "get_warranty",
    title: "Get warranty terms",
    tier: "public",
    description:
      "Get the warranty for a Norvane boiler: how many years it lasts, the conditions that keep it valid (registration and annual servicing), what is and is not covered, and how to make a claim. Use this for any warranty or guarantee question.",
    input: { model: modelArg },
    output: {
      model: z.string(),
      warrantyYears: z.number(),
      extendedWarranty: z.string(),
      registration: z.string(),
      conditions: z.array(z.string()),
      covered: z.array(z.string()),
      notCovered: z.array(z.string()),
      howToClaim: z.string(),
      url: z.string(),
      notice,
    },
    run: ({ model }) => {
      const b = requireBoiler(model);
      const { helpline: _helpline, ...terms } = warranty;
      return { model: b.name, warrantyYears: b.warrantyYears, ...terms, url: "/warranty", notice: NOTICE };
    },
  },

  // ───────────── Engineer tools: behind the gate ─────────────
  {
    name: "diagnose_fault_code",
    title: "Diagnose a fault code (engineer)",
    tier: "engineer",
    description:
      "Full engineer diagnostic for a fault code on a Norvane boiler. Returns the step-by-step diagnostic sequence, the readings to take with expected values, the likely parts with part numbers for that exact model, model-specific notes and any related technical bulletins. Use this when a registered engineer is fault-finding on site. For a homeowner explanation use lookup_fault_code_homeowner instead.",
    input: { model: modelArg, code: codeArg },
    output: {
      model: z.string(),
      code: z.string(),
      title: z.string(),
      effect: z.string(),
      diagnosticSequence: z.array(z.object({ step: z.number(), action: z.string() })),
      readings: z.array(z.object({ measurement: z.string(), expected: z.string() })),
      likelyParts: z.array(partShape),
      modelNote: z.string(),
      relatedBulletins: z.array(z.object({ id: z.string(), title: z.string() })),
      url: z.string(),
      notice,
    },
    run: ({ model, code }) => {
      const b = requireBoiler(model);
      const f = requireFault(code, b);
      const parts = partsFor(b.id);
      const note = f.engineer.modelNotes.find((n) => n.model === b.id)?.note;
      return {
        model: b.name,
        code: f.code,
        title: f.title,
        effect: f.severity,
        diagnosticSequence: f.engineer.diagnosticSequence.map((action, i) => ({ step: i + 1, action })),
        readings: f.engineer.readings,
        likelyParts: f.engineer.likelyPartKeys.flatMap((key) => {
          const p = parts.find((x) => x.key === key);
          return p ? [{ partNumber: p.partNumber, description: p.description, category: p.category, tradePriceGbp: p.tradePriceGbp }] : [];
        }),
        modelNote: note ?? `No model-specific notes for the ${b.name}. Follow the standard sequence.`,
        relatedBulletins: bulletins
          .filter((t) => t.affectedModels.includes(b.id) && (note?.includes(t.id) || t.summary.includes(f.code)))
          .map((t) => ({ id: t.id, title: t.title })),
        url: `/portal/faults/${f.code}?model=${b.id}`,
        notice: NOTICE,
      };
    },
  },
  {
    name: "get_installation_spec",
    title: "Get installation specification (engineer)",
    tier: "engineer",
    description:
      "Installation and servicing manual data for a Norvane boiler: siting, clearances, flue options and maximum lengths, flue terminal positions, gas inlet pressures and gas rate, condensate, electrical supply, system requirements, commissioning steps, key parameters and combustion settings. Use this when a registered engineer is planning, installing or commissioning a boiler.",
    input: { model: modelArg },
    output: {
      model: z.string(),
      documentNumber: z.string(),
      specification: loose.describe("Technical data: outputs, flue, gas, water, electrical, clearances, condensate."),
      manual: loose.describe("Siting, terminal positions, system requirements, commissioning, parameters, combustion settings."),
      url: z.string(),
      notice,
    },
    run: ({ model }) => {
      const b = requireBoiler(model);
      const manual = byModel(manuals, b.id);
      const { summary: _s, priceBand: _p, priceFromGbp: _f, priceToGbp: _t, suitableFor: _u, ...specification } = b;
      return { model: b.name, documentNumber: manual.documentNumber, specification, manual, url: `/portal/manuals/${b.id}`, notice: NOTICE };
    },
  },
  {
    name: "get_parts",
    title: "Get parts list (engineer)",
    tier: "engineer",
    description:
      "Spare parts list for a Norvane boiler with part numbers, categories and trade prices. Use this when a registered engineer needs a part number or wants to know which parts fit a model. Part numbers differ between models, so always pass the exact model.",
    input: { model: modelArg },
    output: { model: z.string(), count: z.number(), parts: z.array(partShape), url: z.string(), notice },
    run: ({ model }) => {
      const b = requireBoiler(model);
      const parts = partsFor(b.id).map(({ key: _key, ...p }) => p);
      return { model: b.name, count: parts.length, parts, url: `/portal/parts/${b.id}`, notice: NOTICE };
    },
  },
  {
    name: "get_service_checklist",
    title: "Get service checklist (engineer)",
    tier: "engineer",
    description:
      "Annual service checklist for a Norvane boiler: every task in order, grouped by section, with the target readings and the service kit part number. Use this when a registered engineer is carrying out or preparing for a service visit.",
    input: { model: modelArg },
    output: {
      model: z.string(),
      title: z.string(),
      intervalMonths: z.number(),
      estimatedMinutes: z.number(),
      serviceKitPartNumber: z.string(),
      sections: z.array(z.object({ section: z.string(), tasks: z.array(z.object({ step: z.number(), task: z.string() })) })),
      url: z.string(),
      notice,
    },
    run: ({ model }) => {
      const b = requireBoiler(model);
      return { ...byModel(checklists, b.id), model: b.name, url: `/portal/checklists/${b.id}`, notice: NOTICE };
    },
  },
  {
    name: "list_technical_bulletins",
    title: "List technical bulletins (engineer)",
    tier: "engineer",
    description:
      "List Norvane technical bulletins: field notices to registered engineers about known issues, firmware updates and revised parts, with affected models, serial ranges and the action to take. Use this before fault-finding or servicing to check whether a known issue applies. Optionally filter to one model.",
    input: { model: modelArg.optional().describe("Optional. Only return bulletins that affect this model.") },
    output: {
      count: z.number(),
      bulletins: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          date: z.string(),
          severity: z.string(),
          affectedModels: z.array(z.string()),
          affectedSerialRange: z.string(),
          summary: z.string(),
          detail: z.string(),
          action: z.array(z.string()),
          partsRequired: z.string(),
          url: z.string(),
        }),
      ),
      notice,
    },
    run: ({ model }) => {
      const b = model ? requireBoiler(model) : undefined;
      const list = bulletins
        .filter((t) => !b || t.affectedModels.includes(b.id))
        .map((t) => ({ ...t, affectedModels: t.affectedModels.map((id) => findBoiler(id)!.name), url: `/portal/bulletins/${t.id}` }));
      return { count: list.length, bulletins: list, notice: NOTICE };
    },
  },
];

export const toolsFor = (engineer: boolean) => tools.filter((t) => engineer || t.tier === "public");

/** Validates the arguments and runs a tool. Throws LookupError for anything the caller can correct. */
export function runTool(tool: ToolDef, rawArgs: unknown): Record<string, unknown> {
  const parsed = z.object(tool.input).safeParse(rawArgs ?? {});
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ");
    throw new LookupError(`Invalid input for ${tool.name}. ${problems}`);
  }
  return tool.run(parsed.data);
}

/** The text an agent reads. Public fault-code answers end with the pointer to the engineer door. */
export function resultText(result: Record<string, unknown>): string {
  const { engineerPointer, ...rest } = result;
  return `${JSON.stringify(rest, null, 2)}${engineerPointer ? `\n\n${engineerPointer}` : ""}`;
}

/** Tool definitions with JSON Schemas, for the WebMCP script. */
export function toolManifest(engineer: boolean) {
  return toolsFor(engineer).map((t) => ({
    name: t.name,
    title: t.title,
    tier: t.tier,
    description: t.description,
    inputSchema: z.toJSONSchema(z.object(t.input)),
    outputSchema: z.toJSONSchema(z.object(t.output)),
    annotations: { readOnlyHint: true },
  }));
}
