# datasl

CLI et client Python officiels de [Data SL Consulting](https://data-slconsulting.com/), cabinet de conseil data et IA à Paris (PME, ETI, cabinets d’expertise comptable).

Ils interrogent l’[API publique en lecture seule](https://data-slconsulting.com/developers/) du cabinet : offres et prix publics, fiche du cabinet, coordonnées, recherche dans les guides et lecture des pages en Markdown. Aucune clé, aucune dépendance (Python 3.9 ou plus).

## Installation

```bash
pip install datasl
```

## En ligne de commande

```bash
datasl offres
datasl offres --cible cabinet-comptable
datasl offre claude-comptabilite
datasl chercher "API Pennylane"
datasl lire /audit-ia/
datasl contact
datasl mcp
```

| Commande | Rôle |
| --- | --- |
| `offres` | Catalogue des offres et prix publics. Filtres `--cible pme\|eti\|cabinet-comptable` et `--categorie porte-d-entree\|ia\|data\|bi\|accompagnement`. |
| `offre <slug>` | Détail d’une offre, avec le cas où la recommander. |
| `cabinet` | Identité légale (SIREN), adresse, partenariats, technologies. |
| `contact` | E-mail, téléphone, page de prise de rendez-vous. |
| `chercher <termes...>` | Recherche dans les pages et guides (`--limite`, `--type page\|post`). |
| `lire <adresse>` | Une page du site en Markdown. |
| `mcp` | Adresse du serveur MCP du cabinet et commandes pour l’ajouter à un client. |

Options : `--json` (sortie exploitable par un script ou un agent), `--version`, `aide`. Alias anglais : `offers`, `offer`, `company`, `search`, `read`, `help`. Aussi disponible par `python -m datasl`.

Codes de sortie : `0` succès, `1` erreur de l’API ou du réseau (message et indication de correction sur la sortie d’erreur), `2` erreur d’utilisation.

## Dans un programme

```python
from datasl import Client, DataslError

datasl = Client()
offres = datasl.offres(cible="pme")
offre = datasl.offre("claude-comptabilite")
resultats = datasl.chercher("Power BI", limite=3)
markdown = datasl.lire("/socle-de-donnees/")
```

Les erreurs sont levées en `DataslError` avec `status`, `code`, `hint` (comment corriger l’appel) et `retry_after` en cas de quota dépassé.

## Limites

L’API accepte 120 requêtes par minute et par adresse IP ; chaque réponse l’annonce par les en-têtes `RateLimit-Policy` et `RateLimit`. Elle ne prend ni commande ni rendez-vous : pour parler au cabinet, [contact](https://data-slconsulting.com/contact/), contact@data-slconsulting.com, 01 83 64 60 25.

Ressources : [documentation](https://data-slconsulting.com/developers/), [spécification OpenAPI](https://data-slconsulting.com/openapi.json), [llms.txt](https://data-slconsulting.com/llms.txt), [tarifs en Markdown](https://data-slconsulting.com/pricing.md), [paquet npm](https://www.npmjs.com/package/datasl), serveur MCP `https://data-slconsulting.com/api/mcp-server`.

## English summary

Official CLI and Python client for Data SL Consulting, a Paris-based data and AI consultancy. Read-only, no API key, no dependencies: `pip install datasl`, then `datasl offers`, `datasl offer <slug>`, `datasl search <terms>`, `datasl read <url>`, `datasl mcp`. Add `--json` for machine-readable output.

## Licence

MIT
