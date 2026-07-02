# @imtakt/sdk

TypeScript client for **ImTakt Server** `/v1`.

```typescript
import { createImTakt } from "@imtakt/sdk"

const imtakt = createImTakt()
await imtakt.planJourney({ from: "Berlin Hbf", to: "München Hbf" })
```

Default base URL: `https://api.imtakt.dev`

## Docs

- [SDK guide](../docs/sdk.md)
- [API reference](../docs/api.md)

## License

MIT
