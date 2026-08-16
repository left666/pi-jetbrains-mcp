# JetBrains MCP for pi

[![CI](https://github.com/giuseppe-trisciuoglio/pi-jetbrains-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/giuseppe-trisciuoglio/pi-jetbrains-mcp/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/%40giuseppe.trisciuoglio%2Fpi-jetbrains-mcp.svg)](https://www.npmjs.com/package/@giuseppe.trisciuoglio/pi-jetbrains-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![pi package](https://img.shields.io/badge/pi-package-purple.svg)](https://pi.dev/packages)

> Connect one or more JetBrains IDE MCP Server endpoints and use their tools directly from [pi](https://pi.dev).

Each endpoint defaults to `<endpoint>__<tool>`. You can opt an endpoint into `original` names in `config.json`; names are still sanitized for pi and collisions use `_2`, `_3`, and so on. Category filtering is also endpoint-specific and uses the exact headings from [`tools_Introduction.md`](tools_Introduction.md).

## Features

- Connect to multiple JetBrains IDE MCP Server endpoints in the same pi session.
- Discover and register MCP tools dynamically when pi starts or an endpoint reconnects.
- Keep tool names unambiguous with stable endpoint prefixes such as `phpstorm__rename_symbol`.
- Isolate endpoint failures: an unavailable IDE does not prevent other IDEs from working.
- Update an IDE's changing MCP port without restarting pi.
- Preserve structured MCP results, text output, and image content.
- Safely report tools that disappeared after an IDE reload.

## Requirements

- pi `0.80.0` or later
- Node.js `22.19.0` or later
- One or more running JetBrains IDEs with **MCP Server** enabled

Recent JetBrains IDEs expose the server under **Settings | Tools | AI Assistant | Developer**. Enable **MCP Server**, then copy the streamable HTTP URL shown by the IDE. It normally looks like this:

```json
{
  "type": "streamable-http",
  "url": "http://127.0.0.1:64342/stream"
}
```

The port changes when the IDE restarts.

## Installation

### From the pi package gallery

```bash
pi install npm:@giuseppe.trisciuoglio/pi-jetbrains-mcp
```

### From GitHub

```bash
pi install git:github.com/giuseppe-trisciuoglio/pi-jetbrains-mcp@v1.0.0
```

Restart pi or run `/reload` after installation. The package is installed globally by default. Add `-l` to install it only for the current project.

### Development checkout

```bash
git clone https://github.com/giuseppe-trisciuoglio/pi-jetbrains-mcp.git
cd pi-jetbrains-mcp
npm install
pi -e .
```

To make a checkout available to every pi session during development, symlink it into pi's extensions directory:

```bash
ln -s "$PWD" ~/.pi/agent/extensions/jetbrains-mcp
```

## Quick start

After installing the package, add the MCP endpoint shown by your IDE:

```text
/jetbrains add-endpoint phpstorm http://127.0.0.1:64342/stream
```

Then verify the connection:

```text
/jetbrains
/jetbrains tools
```

The discovered tools are immediately available to pi. For example, a PhpStorm tool named `rename_symbol` becomes `phpstorm__rename_symbol`.

When the IDE restarts, update its endpoint and reconnect it:

```text
/jetbrains set-url phpstorm http://127.0.0.1:<new-port>/stream
```

## Configuration

The extension stores its local configuration in `config.json` beside the installed package. The file is intentionally excluded from Git and npm packages because it can contain local endpoints and optional HTTP headers.

You can configure endpoints entirely through `/jetbrains add-endpoint` and `/jetbrains set-url`. To create the file manually, copy [`config.example.json`](config.example.json) to `config.json` and edit it:

```json
{
  "endpoints": [
    {
      "id": "phpstorm",
      "url": "http://127.0.0.1:64342/stream",
      "headers": {},
      "connectTimeoutMs": 10000,
      "nameMode": "prefixed",
      "includeCategories": [],
      "excludeCategories": []
    },
    {
      "id": "idea",
      "url": "http://127.0.0.1:64399/stream"
    }
  ]
}
```

| Field | Required | Description |
| --- | --- | --- |
| `id` | Yes | Unique lowercase identifier matching `^[a-z][a-z0-9_]*$`. It is used as the tool-name prefix. |
| `url` | Yes | Full streamable HTTP MCP endpoint URL. |
| `headers` | No | Additional HTTP request headers for that endpoint. |
| `connectTimeoutMs` | No | Connection timeout in milliseconds. Defaults to `10000`. |
| `nameMode` | No | `prefixed` (default) registers `<endpoint>__<tool>`; `original` registers the sanitized MCP name and adds suffixes on collisions. |
| `includeCategories` | No | Exact `tools_Introduction.md` headings to allow. Empty means all categories. |
| `excludeCategories` | No | Exact headings to reject after `includeCategories`; empty means none. |

### Environment override

`JETBRAINS_MCP_URL` overrides the endpoint named `default`, or creates it when it does not exist:

```bash
JETBRAINS_MCP_URL=http://127.0.0.1:64342/stream pi
```

### Legacy configuration

The former single-endpoint shape is migrated automatically the next time the extension loads:

```json
{
  "url": "http://127.0.0.1:64342/stream"
}
```

It becomes an `endpoints` array with the identifier `default`.

## Commands

| Command | Description |
| --- | --- |
| `/jetbrains` | Show every endpoint's URL, connection state, and live tool count. |
| `/jetbrains reconnect [id]` | Reconnect one endpoint, or every endpoint when no identifier is supplied. |
| `/jetbrains disconnect [id]` | Disconnect one endpoint or all endpoints. Registered tools report an offline error until reconnected. |
| `/jetbrains set-url <id> <url>` | Persist a new endpoint URL, reconnect, and refresh its tools. |
| `/jetbrains add-endpoint <id> <url>` | Persist a new endpoint, connect to it, and register its tools. |
| `/jetbrains tools` | List live registered tools grouped by endpoint. |

## Behavior and limitations

- Endpoint connections run independently. If one IDE is not running, tools from connected IDEs remain available.
- pi does not provide an API to unregister tools. When an IDE no longer exposes a previously discovered tool, the extension marks it unavailable and returns a useful error until the endpoint is reconnected or pi is reloaded.
- Removing an endpoint requires removing it from `config.json` and running `/reload`.
- The extension accepts any valid JSON Schema it can map to TypeBox. Unsupported schema constructs fall back to permissive input so the MCP tool remains callable.
- Only install extensions from sources you trust. An extension runs with the same permissions as pi.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| Endpoint is unreachable | Start the IDE, copy its new MCP URL, then run `/jetbrains set-url <id> <url>`. |
| Tools are missing | Confirm that MCP Server is enabled and run `/jetbrains reconnect <id>`. |
| Invalid endpoint identifier | Use lowercase letters, digits, and underscores, starting with a letter. |
| Invalid MCP URL | Include the full scheme and path, for example `http://127.0.0.1:64342/stream`. |
| No endpoints configured | Run `/jetbrains add-endpoint <id> <url>` or create `config.json` from the example. |

## Development

```bash
npm install
npm test
```

pi loads TypeScript extensions directly, so no compilation step is necessary. During local development, edit the source and run `/reload` in pi.

## Contributing

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the development and pull-request workflow. Please report security vulnerabilities according to [SECURITY.md](SECURITY.md).

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## License

This project is licensed under the [MIT License](LICENSE).
