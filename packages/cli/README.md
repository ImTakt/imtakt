# @imtakt/cli

Agent CLI for **ImTakt Server** — JSON stdout, four commands.

## Install

```bash
curl -fsSL https://imtakt.dev/cli/install.sh | bash
```

One-off without install:

```bash
npx -y @imtakt/cli find "Berlin Hbf"
npx -y @imtakt/cli live --stop-id "de_297950"
npx -y @imtakt/cli journey "Berlin Hbf" "München Hbf"
npx -y @imtakt/cli train RUN_ID
```

## Docs

- [CLI guide](https://github.com/ImTakt/imtakt/blob/main/docs/cli.md)

## License

MIT
