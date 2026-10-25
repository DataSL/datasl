# datasl

Official toolkit of [Data SL Consulting](https://data-slconsulting.com/), an independent data and AI consultancy in Paris for SMEs, mid-sized companies and accounting firms: CLI and SDKs for its public API, an Agent Skill, and plugin manifests for its public MCP server.

Everything here is read-only, public and needs no API key.

| Folder / file | What it is |
| --- | --- |
| [`js/`](js/) | npm package [`datasl`](https://www.npmjs.com/package/datasl): CLI and JavaScript client (`npx datasl offres`) |
| [`python/`](python/) | PyPI package `datasl`: same CLI and a Python client |
| [`skills/datasl/`](skills/datasl/SKILL.md) | Agent Skill: how an agent looks up the consultancy's offers, prices, facts and pages |
| `plugin.json`, `mcp.json` | [Agent Plugins](https://agent-plugins.org/) manifest: the skill plus the MCP server |
| `.claude-plugin/`, `.mcp.json` | Same bundle for Claude Code |
| [`AGENTS.md`](AGENTS.md) | Instructions for AI coding agents |
| `CLAUDE.md`, `.cursor/rules/`, `.windsurf/rules/` | The same instructions for Claude Code, Cursor and Windsurf |
| [`server.json`](server.json) | Entry of the MCP server in the [official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers/com.data-slconsulting%2Fsite/versions/latest) (`com.data-slconsulting/site`) |

## Quick start

```bash
npx datasl offres                         # offers and public prices
npx datasl offre claude-comptabilite      # one offer, with when to recommend it
npx datasl chercher "Pennylane Power BI"  # search the site
npx datasl lire /audit-ia/                # a page in Markdown
npx datasl mcp                            # MCP server address and setup commands
```

Install the skill in your agent:

```bash
npx skills add DataSL/datasl
```

Add the MCP server to Claude Code:

```bash
claude mcp add --transport http data-slconsulting https://data-slconsulting.com/api/mcp-server
```

Or install the whole bundle as a Claude Code plugin: `/plugin marketplace add DataSL/datasl`, then `/plugin install datasl@datasl`.

## API

- Documentation: https://data-slconsulting.com/developers/
- OpenAPI 3.1: https://data-slconsulting.com/openapi.json
- MCP server (Streamable HTTP, no authentication): https://data-slconsulting.com/api/mcp-server
- Public prices in Markdown: https://data-slconsulting.com/pricing.md
- Site index for agents: https://data-slconsulting.com/llms.txt
- Limit: 120 requests per minute per IP address.

The API cannot book or order anything. To talk to the consultancy: https://data-slconsulting.com/contact/, contact@data-slconsulting.com, +33 1 83 64 60 25.

## En français

Boîte à outils officielle de Data SL Consulting, cabinet de conseil data et IA à Paris : CLI et SDK JavaScript et Python de l'API publique du cabinet (offres, prix publics, fiche du cabinet, coordonnées, recherche, pages en Markdown), compétence pour agents IA et manifestes de plugin pour son serveur MCP public. Lecture seule, sans clé. Documentation : https://data-slconsulting.com/developers/.

## License

MIT, © DATA SOLUTION LEAD CONSULTING (Data SL Consulting).
