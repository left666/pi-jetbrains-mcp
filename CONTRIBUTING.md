# Contributing to JetBrains MCP for pi

Thank you for contributing.

## Before you start

- Search existing issues before opening a new one.
- Discuss substantial behavior changes in an issue before implementing them.
- Keep changes focused and include tests when behavior changes.
- Use English for source code, comments, documentation, issue text, and pull requests.

## Development setup

```bash
git clone https://github.com/giuseppe-trisciuoglio/pi-jetbrains-mcp.git
cd pi-jetbrains-mcp
npm install
npm test
```

pi loads the TypeScript entry point directly. To exercise a local checkout, run:

```bash
pi -e .
```

Enable MCP Server in a JetBrains IDE, then add its displayed streamable HTTP URL with `/jetbrains add-endpoint <id> <url>`.

## Pull requests

1. Create a branch from `main`.
2. Make the smallest change that solves the problem.
3. Run `npm test`.
4. Update `README.md` and `CHANGELOG.md` when user-facing behavior changes.
5. Open a pull request that explains the motivation, implementation, and validation.

## Reporting bugs

Include the following information:

- pi version and Node.js version
- JetBrains IDE product and version
- Extension version
- The command you ran and the observed behavior
- Relevant non-sensitive error output

Do not include endpoint headers, credentials, or other secrets in issues.

## Releasing

Maintainers publish a release as follows:

1. Before the first release, configure npm Trusted Publishing for `@giuseppe.trisciuoglio/pi-jetbrains-mcp`, GitHub repository `giuseppe-trisciuoglio/pi-jetbrains-mcp`, and workflow `.github/workflows/publish.yml`.
2. Update `package.json` and move relevant entries from `Unreleased` in `CHANGELOG.md` to a versioned section.
3. Merge the release commit into `main`.
4. Create a GitHub Release with a `v<version>` tag that matches `package.json`.
5. The publish workflow validates the package and publishes it to npm with provenance.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](LICENSE).
