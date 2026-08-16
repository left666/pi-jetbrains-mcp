export const TOOL_CATEGORIES = [
	"Analysis tools",
	"Code Insight tools",
	"Database-specific tools",
	"Debugger tools",
	"Execution tools",
	"File tools",
	"Formatting tools",
	"Inspection Generator MCP Tools",
	"Inspection KTS MCP tools",
	"Patch tools",
	"Read tools",
	"Refactoring tools",
	"Search tools",
	"Skill Search tools",
	"Terminal tools",
	"Universal tools",
	"VCS tools",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export const MCP_TOOL_CATEGORIES: Record<string, ToolCategory> = {
	analyze_calls: "Analysis tools",
	build_project: "Analysis tools",
	get_file_problems: "Analysis tools",
	get_project_dependencies: "Analysis tools",
	get_project_modules: "Analysis tools",
	lint_files: "Analysis tools",
	get_symbol_info: "Code Insight tools",
	cancel_sql_query: "Database-specific tools",
	create_database_connection: "Database-specific tools",
	edit_database_connection: "Database-specific tools",
	execute_sql_query: "Database-specific tools",
	fetch_query_result: "Database-specific tools",
	get_database_object_description: "Database-specific tools",
	introspect_schema: "Database-specific tools",
	list_database_connections: "Database-specific tools",
	list_database_schemas: "Database-specific tools",
	list_recent_sql_queries: "Database-specific tools",
	list_schema_object_kinds: "Database-specific tools",
	list_schema_objects: "Database-specific tools",
	preview_table_data: "Database-specific tools",
	test_database_connection: "Database-specific tools",
	xdebug_control_session: "Debugger tools",
	xdebug_evaluate_expression: "Debugger tools",
	xdebug_get_debugger_status: "Debugger tools",
	xdebug_get_frame_values: "Debugger tools",
	xdebug_get_stack: "Debugger tools",
	xdebug_get_threads: "Debugger tools",
	xdebug_get_value_by_path: "Debugger tools",
	xdebug_list_breakpoints: "Debugger tools",
	xdebug_remove_breakpoint: "Debugger tools",
	xdebug_run_to_line: "Debugger tools",
	xdebug_set_breakpoint: "Debugger tools",
	xdebug_set_variable: "Debugger tools",
	xdebug_start_debugger_session: "Debugger tools",
	execute_run_configuration: "Execution tools",
	get_run_configurations: "Execution tools",
	create_new_file: "File tools",
	get_all_open_file_paths: "File tools",
	list_directory_tree: "File tools",
	open_file_in_editor: "File tools",
	reformat_file: "Formatting tools",
	validate_inspection_kts: "Inspection Generator MCP Tools",
	generate_inspection_kts_api: "Inspection KTS MCP tools",
	generate_inspection_kts_examples: "Inspection KTS MCP tools",
	generate_psi_tree: "Inspection KTS MCP tools",
	run_inspection_kts: "Inspection KTS MCP tools",
	apply_patch: "Patch tools",
	read_file: "Read tools",
	rename_refactoring: "Refactoring tools",
	search_file: "Search tools",
	search_regex: "Search tools",
	search_symbol: "Search tools",
	search_text: "Search tools",
	skill_search: "Skill Search tools",
	execute_terminal_command: "Terminal tools",
	execute_tool: "Universal tools",
	get_repositories: "VCS tools",
	git_status: "VCS tools",
};

export function categoryForTool(mcpName: string): ToolCategory | undefined {
	return MCP_TOOL_CATEGORIES[mcpName];
}

export function shouldRegisterTool(
	mcpName: string,
	includeCategories: readonly ToolCategory[],
	excludeCategories: readonly ToolCategory[],
): { register: boolean; category?: ToolCategory } {
	const category = categoryForTool(mcpName);
	if (includeCategories.length > 0 && (!category || !includeCategories.includes(category))) {
		return { register: false, category };
	}
	if (category && excludeCategories.includes(category)) {
		return { register: false, category };
	}
	return { register: true, category };
}
