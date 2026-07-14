# Getting started

**Dein Agent soll Bus und Bahn verstehen? So startest du.**

Kein Account. Kein API-Schlüssel.

| Weg | Wo | Für wen |
| --- | --- | --- |
| **Agent verbinden** | [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) | Cursor, Claude, Codex |
| **Im Browser testen** | [imtakt.dev/try](https://imtakt.dev/try) | Schnell ausprobieren, ohne Installation |
| **CLI** | `npx @imtakt/cli` | Skripte und Terminal (optional) |

## 1. Im Browser ausprobieren (optional)

Öffne [imtakt.dev/try](https://imtakt.dev/try), gib Start und Ziel ein, und sieh eine echte Verbindung.

## 2. Agent verbinden

Öffne [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding), wähle deinen Editor, und kopiere die MCP-Konfiguration.

Oder direkt die Skill-Datei:

```
https://imtakt.dev/agent-onboarding/SKILL.md
```

Vollständige Anleitung: [agent-onboarding.md](./agent-onboarding.md)

## 3. Erste Frage stellen

Beispiele:

- „Plane morgen um 9 Uhr von Berlin Hbf nach München Hbf.“
- „Welche Züge fahren als Nächstes ab Köln Hbf?“
- „Finde Haltestellen in der Nähe vom Brandenburger Tor.“

## Entwickler

- MCP-Details: [mcp.md](./mcp.md)
- CLI: [cli.md](./cli.md)
- HTTP API: [api.md](./api.md)

```bash
curl -s https://api.imtakt.dev/health
```
