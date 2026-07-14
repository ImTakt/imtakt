# ImTakt

**Dein Agent versteht Bus und Bahn - im Takt.**

Verbindungen planen, Abfahrten prüfen, Haltestellen finden - deutschlandweit, mit echten Fahrplandaten. Kostenlos nutzbar, ohne Account.

**Loslegen:** [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding) · **Ausprobieren:** [imtakt.dev/try](https://imtakt.dev/try)

---

## Was ImTakt macht

- **Für deinen Agenten** - funktioniert in Cursor, Claude, Codex und anderen MCP-fähigen Tools
- **Ganz Deutschland** - Fernverkehr, Regionalbahn, S-Bahn, U-Bahn, Tram und Bus
- **Echte Daten** - Fahrplan und Echtzeit, wo verfügbar
- **Einfach starten** - eine Konfiguration einfügen, fertig
- **Kein Login** - der gehostete Dienst ist ohne API-Schlüssel nutzbar

---

## Agent verbinden (empfohlen)

1. Öffne [imtakt.dev/agent-onboarding](https://imtakt.dev/agent-onboarding)
2. Wähle deinen Editor (Cursor, Claude, Codex, …)
3. Kopiere die MCP-Konfiguration:

```json
{
  "mcpServers": {
    "imtakt": {
      "command": "npx",
      "args": ["-y", "@imtakt/mcp"]
    }
  }
}
```

4. Frag deinen Agenten z. B.: *„Wie komme ich morgen früh von Berlin Hbf nach München Hbf?“*

Skill-Datei für Agenten: `https://imtakt.dev/agent-onboarding/SKILL.md`

→ [Anleitung](docs/agent-onboarding.md) · [imtakt.dev/mcp](https://imtakt.dev/mcp)

---

## Was dein Agent kann

| Fähigkeit | Beispiel |
| --- | --- |
| Haltestelle finden | „Finde Stationen bei Alexanderplatz“ |
| Verbindung planen | „ICE von Hamburg nach Köln, ab 9 Uhr“ |
| Abfahrten anzeigen | „Nächste Züge ab Berlin Hbf“ |
| Zug verfolgen | Verspätungen und Halte eines Zuglaufs |

---

## Im Browser testen

Ohne Installation: [imtakt.dev/try](https://imtakt.dev/try)

---

## Für Entwickler

| Thema | Link |
| --- | --- |
| CLI | [docs/cli.md](docs/cli.md) · `npx @imtakt/cli` |
| HTTP API | [docs/api.md](docs/api.md) |
| SDK & Integration | [docs/integrators.md](docs/integrators.md) |

```bash
curl -s https://api.imtakt.dev/health
```

---

## Pakete

| Paket | Install |
| --- | --- |
| [`@imtakt/mcp`](mcp/) | `npx -y @imtakt/mcp` |
| [`@imtakt/cli`](packages/cli/) | `npx @imtakt/cli` |

---

## Mitentwickeln

```bash
bun install && bun run typecheck && bun run build
```

→ [CONTRIBUTING.md](CONTRIBUTING.md) · [STATUS.md](STATUS.md)

**Lizenz:** MIT
