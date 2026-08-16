import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { IsObject } from "typebox";
import extension from "../src/index.ts";
import { jsonSchemaToTypebox } from "../src/schema.ts";
import { MCP_TOOL_CATEGORIES, TOOL_CATEGORIES, shouldRegisterTool } from "../src/tool-categories.ts";

const root = process.cwd();
const packageJson = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
	keywords?: string[];
	pi?: { extensions?: string[] };
};

assert.ok(packageJson.keywords?.includes("pi-package"), "package must be discoverable by pi");
assert.deepEqual(packageJson.pi?.extensions, ["./src/index.ts"]);
assert.ok(existsSync(join(root, "src", "index.ts")), "pi extension entry point must exist");

const configExample = JSON.parse(readFileSync(join(root, "config.example.json"), "utf8")) as {
	endpoints?: Array<{
		id?: string;
		url?: string;
		nameMode?: string;
		includeCategories?: unknown[];
		excludeCategories?: unknown[];
	}>;
};
assert.ok(configExample.endpoints && configExample.endpoints.length > 0);
assert.equal(configExample.endpoints?.[0]?.nameMode, "prefixed");
assert.deepEqual(configExample.endpoints?.[0]?.includeCategories, []);
assert.deepEqual(configExample.endpoints?.[0]?.excludeCategories, []);
assert.equal(TOOL_CATEGORIES.length, 17);
assert.equal(Object.keys(MCP_TOOL_CATEGORIES).length, 58);
assert.equal(shouldRegisterTool("read_file", ["Read tools"], []).register, true);
assert.equal(shouldRegisterTool("read_file", ["Read tools"], ["Read tools"]).register, false);
assert.equal(shouldRegisterTool("unknown_tool", [], []).register, true);
assert.equal(shouldRegisterTool("unknown_tool", ["Read tools"], []).register, false);

const parameters = jsonSchemaToTypebox({
	type: "object",
	properties: {
		name: { type: "string", description: "A display name." },
		attempts: { type: "integer" },
	},
	required: ["name"],
});
assert.ok(IsObject(parameters));
const objectParameters = parameters as {
	properties: Record<string, { type?: string }>;
	required?: string[];
};
assert.equal(objectParameters.properties.name.type, "string");
assert.equal(objectParameters.required?.includes("name"), true);
assert.equal(objectParameters.required?.includes("attempts"), false);

const handlers = new Map<string, unknown>();
let commandName = "";
const fakePi = {
	on(event: string, handler: unknown) {
		handlers.set(event, handler);
	},
	registerCommand(name: string) {
		commandName = name;
	},
	getAllTools() {
		return [];
	},
	registerTool() {},
};

extension(fakePi as unknown as ExtensionAPI);
assert.ok(handlers.has("session_start"));
assert.ok(handlers.has("session_shutdown"));
assert.equal(commandName, "jetbrains");

console.log("Smoke tests passed.");
