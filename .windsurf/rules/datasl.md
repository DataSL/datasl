---
trigger: model_decision
description: Working on the Data SL Consulting toolkit (datasl CLI and SDKs, agent skill, plugin manifests) or writing code that calls the Data SL Consulting public API or MCP server
---

# Data SL Consulting toolkit

Full instructions: see `AGENTS.md` at the repository root.

- REST base URL: `https://data-slconsulting.com/wp-json/datasl/v1` (read-only, public, no authentication); OpenAPI 3.1 at https://data-slconsulting.com/openapi.json.
- MCP server: `https://data-slconsulting.com/api/mcp-server` (Streamable HTTP; tools `get_offers`, `search_site`, `fetch_page`).
- Errors are JSON `{"code", "message", "data": {"status", "hint"}}`; rate limit 120 requests per minute per IP, honour `Retry-After` on 429.
- Keep `js/` and `python/` dependency-free and identical in behaviour; never hard-code prices (the API is the source of truth); user-facing text in French.
- Tests: `cd js && npm test`; `cd python && PYTHONPATH=src python -m unittest discover -s tests`.
