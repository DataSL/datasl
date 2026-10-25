# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, Cursor, Copilot, Gemini CLI and others) working in this repository or writing code that uses the Data SL Consulting API.

## What this repository is

The official, public toolkit of [Data SL Consulting](https://data-slconsulting.com/), a Paris data and AI consultancy:

- `js/`: the npm package `datasl` (CLI + JavaScript client, Node 18+, no dependencies).
- `python/`: the PyPI package `datasl` (CLI + Python client, Python 3.9+, no dependencies).
- `skills/datasl/SKILL.md`: an Agent Skill that teaches an agent to look up the consultancy's offers, prices and content.
- `plugin.json` + `mcp.json` (Agent Plugins format) and `.claude-plugin/` + `.mcp.json` (Claude Code): plugin manifests that bundle the skill with the public MCP server.

## The API these packages wrap

- Base URL: `https://data-slconsulting.com/wp-json/datasl/v1`. Read-only, public, no authentication.
- Contract: OpenAPI 3.1 at https://data-slconsulting.com/openapi.json. Documentation: https://data-slconsulting.com/developers/.
- Routes: `GET /offres` (filters `cible`, `categorie`, `champs`), `GET /offres/{slug}`, `GET /cabinet`, `GET /contact`; search via `GET /wp-json/wp/v2/search?search=...`.
- MCP server: `https://data-slconsulting.com/api/mcp-server` (Streamable HTTP; tools `get_offers`, `search_site`, `fetch_page`).
- Errors: JSON `{"code", "message", "data": {"status", "hint"}}`. Surface `hint` to the user; it says how to fix the call.
- Rate limit: 120 requests per minute per IP, announced by `RateLimit-Policy` and `RateLimit` headers; on 429, honour `Retry-After`.

## Rules when changing code here

- Keep both packages dependency-free and behaviourally identical: same commands (`offres`, `offre`, `cabinet`, `contact`, `chercher`, `lire`, `mcp`), same `--json` output, same exit codes (0 success, 1 API or network error, 2 usage error).
- Validate inputs before any network call (offer slugs match `^[a-z0-9-]+$`; `lire` only reads pages of data-slconsulting.com, never `wp-admin`, `wp-json`, `wp-login` or `/api/`).
- Never hard-code prices or offer lists: they come from the API, which is the source of truth.
- Decode HTML entities in search result titles (the WordPress search API returns them encoded).
- User-facing text is in French; code identifiers follow the existing French naming.
- Do not add telemetry, analytics or calls to any host other than data-slconsulting.com.

## Tests

```bash
cd js && npm test                       # offline, against a local mock server
cd python && python -m unittest discover -s tests   # offline
DATASL_LIVE=1 python -m unittest tests.test_live    # a few requests to the real site
```

Run the offline suites before any change. Keep live tests to a handful of requests (the site is a small WordPress install; never send bursts of concurrent requests).

## Releasing

Version numbers live in `js/package.json`, `python/pyproject.toml` and `python/src/datasl/__init__.py`; bump all three together. Packages are published by Data SL Consulting from its own npm and PyPI accounts.
