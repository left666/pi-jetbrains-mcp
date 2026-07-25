/**
 * Convert a JSON Schema (the `inputSchema` reported by an MCP tool) into a
 * TypeBox schema that pi's `registerTool` accepts as `parameters`.
 *
 * The MCP spec guarantees tool inputSchema is an object schema, but we stay
 * defensive: anything we cannot map falls back to Type.Any() so the tool is
 * still registered and the LLM can still pass arguments through.
 */

import { Type, type TSchema } from "typebox";

export type JsonSchema = {
	type?: string | string[];
	properties?: Record<string, JsonSchema>;
	required?: string[];
	items?: JsonSchema | JsonSchema[];
	enum?: unknown[];
	description?: string;
	[k: string]: unknown;
};

function pickFirstType(type: string | string[] | undefined): string | undefined {
	if (Array.isArray(type)) return type.find((t) => t !== "null");
	return type;
}

function withDescription(schema: TSchema, description?: string): TSchema {
	return description ? { ...schema, description } : schema;
}

export function jsonSchemaToTypebox(schema: JsonSchema | undefined): TSchema {
	if (!schema || typeof schema !== "object") {
		return Type.Any();
	}

	const description =
		typeof schema.description === "string" ? schema.description : undefined;

	// Enums -> union of literals (works for strings/numbers/booleans).
	if (Array.isArray(schema.enum) && schema.enum.length > 0) {
		const literals = schema.enum
			.filter((v) => v !== null && v !== undefined)
			.map((v) => Type.Literal(v as string | number | boolean));
		if (literals.length === 0) return withDescription(Type.Any(), description);
		const union = literals.length === 1 ? literals[0] : Type.Union(literals);
		return withDescription(union, description);
	}

	const type = pickFirstType(schema.type);

	switch (type) {
		case "string":
			return withDescription(Type.String(), description);
		case "integer":
		case "number":
			return withDescription(Type.Number(), description);
		case "boolean":
			return withDescription(Type.Boolean(), description);
		case "array": {
			const items = Array.isArray(schema.items) ? schema.items[0] : schema.items;
			const itemSchema = items ? jsonSchemaToTypebox(items) : Type.Any();
			return withDescription(Type.Array(itemSchema), description);
		}
		case "object":
		case undefined: {
			if (schema.properties && typeof schema.properties === "object") {
				const required = new Set(schema.required ?? []);
				const props: Record<string, TSchema> = {};
				for (const [key, sub] of Object.entries(schema.properties)) {
					const converted = jsonSchemaToTypebox(sub);
					props[key] = required.has(key) ? converted : Type.Optional(converted);
				}
				return withDescription(Type.Object(props), description);
			}
			// No properties and no recognized type -> permissive passthrough.
			return withDescription(Type.Any(), description);
		}
		default:
			return withDescription(Type.Any(), description);
	}
}
