# @imtakt/cli

Agent CLI for **ImTakt Server** — five verbs, JSON for pipes, markdown on TTY.

## Install

```bash
curl -fsSL https://imtakt.dev/cli/install.sh | bash
```

One-off without install:

```bash
npx -y @imtakt/cli find "Berlin Hbf"
npx -y @imtakt/cli plan "Berlin Hbf" "München Hbf" --view board --json
npx -y @imtakt/cli show <optionId> --json
npx -y @imtakt/cli status "Berlin Hbf"
npx -y @imtakt/cli follow RUN_ID
```

Flow: **plan → show → follow**.

## Docs

- [CLI guide](https://github.com/ImTakt/imtakt/blob/main/docs/cli.md)
- [Harness](https://github.com/ImTakt/imtakt/blob/main/docs/HARNESS.md)

## License

MIT
