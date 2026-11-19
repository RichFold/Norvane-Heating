// The two MCP doors. Both are stateless Streamable HTTP servers built from the shared tool registry.
import { McpServer } from "@modelcontextprotocol/server";
import { createMcpHandler } from "agents/mcp/server";
import { LookupError } from "./data";
import { resultText, runTool, toolsFor } from "./tools";
import { NOTICE } from "./types";

function createServer(engineer: boolean) {
  const server = new McpServer(
    {
      name: engineer ? "norvane-engineer" : "norvane-public",
      title: engineer ? "Norvane Heating (registered engineers)" : "Norvane Heating",
      version: "1.0.0",
    },
    {
      instructions: engineer
        ? `Norvane Heating engineer connector: full diagnostics, installation data, parts, service checklists and technical bulletins for verified Norvane Registered Engineers, plus all the public homeowner tools. ${NOTICE}`
        : `Norvane Heating public connector: boiler range, specifications, homeowner user guides, homeowner fault code help, installers and warranty. Repair and diagnostic procedures are only in the engineer connector. ${NOTICE}`,
    },
  );

  for (const tool of toolsFor(engineer)) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.input,
        outputSchema: tool.output,
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      },
      async (args: unknown) => {
        try {
          const result = runTool(tool, args);
          return { content: [{ type: "text" as const, text: resultText(result) }], structuredContent: result };
        } catch (error) {
          if (!(error instanceof LookupError)) throw error;
          return { content: [{ type: "text" as const, text: `${error.message}\n\n${NOTICE}` }], isError: true };
        }
      },
    );
  }
  return server;
}

// A custom domain needs allowedHostnames and allowedOriginHostnames set here; workers.dev and localhost work by default.
export const publicMcp = createMcpHandler(() => createServer(false), { route: "/mcp" });
export const engineerMcp = createMcpHandler(() => createServer(true), { route: "/mcp/pro" });
