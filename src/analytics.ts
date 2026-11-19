// Tool-call analytics for the demo. Every tool call through MCP or WebMCP is logged to one small
// SQLite-backed Durable Object, and /demo/analytics reads it back.
// Deliberately minimal: which door, which tool, which model and fault code. No IP address, no
// engineer identity, no postcode, no free text.
import { DurableObject } from "cloudflare:workers";
import { faults, findBoiler, normaliseCode } from "./data";
import type { ToolDef } from "./tools";
import type { Env } from "./types";

export const DOORS = {
  "mcp-public": "MCP, public",
  "mcp-engineer": "MCP, engineer (OAuth)",
  "webmcp-public": "WebMCP, public",
  "webmcp-engineer": "WebMCP, engineer (portal session)",
} as const;
export type Door = keyof typeof DOORS;

interface ToolEvent {
  door: Door;
  tool: string;
  tier: string;
  model: string;
  code: string;
  ok: boolean;
}

export interface Summary {
  total: number;
  last24h: number;
  since: number | null;
  byDoor: { door: Door; calls: number }[];
  byTool: { tool: string; tier: string; door: Door; calls: number }[];
  byCode: { code: string; homeowner: number; engineer: number }[];
  byModel: { model: string; calls: number }[];
  recent: { ts: number; door: Door; tool: string; model: string; code: string; ok: number }[];
}

const KEEP_DAYS = 90;

export class ToolLog extends DurableObject {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS calls (ts INTEGER NOT NULL, door TEXT NOT NULL, tool TEXT NOT NULL, tier TEXT NOT NULL, model TEXT NOT NULL, code TEXT NOT NULL, ok INTEGER NOT NULL)",
    );
  }

  record(e: ToolEvent): void {
    const sql = this.ctx.storage.sql;
    sql.exec("INSERT INTO calls (ts, door, tool, tier, model, code, ok) VALUES (?, ?, ?, ?, ?, ?, ?)", Date.now(), e.door, e.tool, e.tier, e.model, e.code, e.ok ? 1 : 0);
    if (Math.random() < 0.02) sql.exec("DELETE FROM calls WHERE ts < ?", Date.now() - KEEP_DAYS * 86_400_000);
  }

  summary(): Summary {
    const sql = this.ctx.storage.sql;
    const all = <T>(query: string, ...args: unknown[]) => sql.exec(query, ...args).toArray() as T[];
    const [totals] = all<{ total: number; since: number | null }>("SELECT COUNT(*) AS total, MIN(ts) AS since FROM calls");
    const [recent] = all<{ n: number }>("SELECT COUNT(*) AS n FROM calls WHERE ts > ?", Date.now() - 86_400_000);
    return {
      total: totals.total,
      since: totals.since,
      last24h: recent.n,
      byDoor: all("SELECT door, COUNT(*) AS calls FROM calls GROUP BY door"),
      byTool: all("SELECT tool, tier, door, COUNT(*) AS calls FROM calls GROUP BY tool, tier, door"),
      byCode: all(
        "SELECT code, SUM(tool = 'lookup_fault_code_homeowner') AS homeowner, SUM(tool = 'diagnose_fault_code') AS engineer FROM calls WHERE code != '' GROUP BY code ORDER BY COUNT(*) DESC LIMIT 15",
      ),
      byModel: all("SELECT model, COUNT(*) AS calls FROM calls WHERE model != '' GROUP BY model ORDER BY calls DESC"),
      recent: all("SELECT ts, door, tool, model, code, ok FROM calls ORDER BY ts DESC LIMIT 25"),
    };
  }
}

const log = (env: Env) => env.TOOL_LOG.getByName("global");

/** Logs one tool call. Never throws: analytics must not break a tool. */
export async function recordCall(env: Env, door: Door, tool: ToolDef, args: unknown, ok: boolean): Promise<void> {
  try {
    const a = (args ?? {}) as Record<string, unknown>;
    const model = typeof a.model === "string" ? (findBoiler(a.model)?.name ?? "") : "";
    const code = typeof a.code === "string" ? normaliseCode(a.code) : "";
    await log(env).record({ door, tool: tool.name, tier: tool.tier, model, code: faults.some((f) => f.code === code) ? code : "", ok });
  } catch (error) {
    console.error("Could not record tool call", error);
  }
}

export const getSummary = (env: Env): Promise<Summary> => log(env).summary() as Promise<Summary>;
