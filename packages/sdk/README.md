# @imtakt/sdk

HTTP client + **agent harness** for ImTakt Server `/v1`.

```typescript
import { createImTakt, createAgentHarness } from "@imtakt/sdk"

const harness = createAgentHarness(createImTakt()) // default: https://api.imtakt.dev

const board = await harness.plan({
  from: "Berlin Hbf",
  to: "München Hbf",
  preferences: { view: "board" },
})
// board.agent — imtakt.agent.board/v1 or plan/v1
```

Five verbs: `find` · `plan` · `show` · `status` · `follow`.

## Docs

- [Agent harness](https://github.com/ImTakt/imtakt/blob/main/docs/agent-harness.md)
- [SDK guide](https://github.com/ImTakt/imtakt/blob/main/docs/sdk.md)

## License

MIT
