# @imtakt/sdk

HTTP client for ImTakt Server `/v1`.

```typescript
import { createImTakt } from "@imtakt/sdk"

const imtakt = createImTakt() // default: https://api.imtakt.dev
const stops = await imtakt.findStops({ place: "Alexanderplatz" })
```

## Docs

- [SDK guide](https://github.com/ImTakt/imtakt/blob/main/docs/sdk.md)

## License

MIT
