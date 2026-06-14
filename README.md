# ImTakt

Open-source CLI + MCP client for Deutsche Bahn — journeys, boards, travel time, normalized and agent-ready.

**License:** MIT (see `LICENSE`)

```text
packages/
├── cli/          # imtakt binary
├── sdk/          # programmatic API
└── core/         # shared logic, schema, archiver
mcp/              # MCP server (stdio + SSE)
examples/
implementation-status.md
```

Company hub: [ImTakt/imtakt](https://github.com/ImTakt/imtakt) · Docs: [ImTakt/imtakt-docs](https://github.com/ImTakt/imtakt-docs)

## Quick start (planned)

```bash
imtakt journey "Berlin Hbf" "München Hbf"
imtakt board "Köln Hbf" --json
```

## Status

See [implementation-status.md](implementation-status.md). v1 spec: [imtakt).
