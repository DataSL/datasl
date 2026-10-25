# datasl

CLI et client JavaScript officiels de [Data SL Consulting](https://data-slconsulting.com/), cabinet de conseil data et IA à Paris (PME, ETI, cabinets d’expertise comptable).

Ils interrogent l’[API publique en lecture seule](https://data-slconsulting.com/developers/) du cabinet : offres et prix publics, fiche du cabinet, coordonnées, recherche dans les guides et lecture des pages en Markdown. Aucune clé n’est nécessaire.

## En ligne de commande

```bash
npx datasl offres
npx datasl offres --cible cabinet-comptable
npx datasl offre claude-comptabilite
npx datasl chercher "API Pennylane"
npx datasl lire /audit-ia/
npx datasl contact
npx datasl mcp
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

Options : `--json` pour une sortie exploitable par un script ou un agent, `--version`, `aide`. Des alias anglais existent (`offers`, `offer`, `company`, `search`, `read`, `help`).

Codes de sortie : `0` succès, `1` erreur de l’API ou du réseau (le message et l’indication de correction sont écrits sur la sortie d’erreur), `2` erreur d’utilisation.

## Dans un programme

```js
import { createClient } from 'datasl';

const datasl = createClient();
const offres = await datasl.offres({ cible: 'pme' });
const offre = await datasl.offre('claude-comptabilite');
const resultats = await datasl.chercher('Power BI', { limite: 3 });
const markdown = await datasl.lire('/socle-de-donnees/');
```

Les erreurs sont levées en `DataslError` avec `status`, `code`, `hint` (comment corriger l’appel) et `retryAfter` en cas de quota dépassé.

## Limites

L’API accepte 120 requêtes par minute et par adresse IP ; chaque réponse l’annonce par les en-têtes `RateLimit-Policy` et `RateLimit`. Elle ne prend ni commande ni rendez-vous : pour parler au cabinet, [contact](https://data-slconsulting.com/contact/), contact@data-slconsulting.com, 01 83 64 60 25.

Ressources : [documentation](https://data-slconsulting.com/developers/), [spécification OpenAPI](https://data-slconsulting.com/openapi.json), [llms.txt](https://data-slconsulting.com/llms.txt), [tarifs en Markdown](https://data-slconsulting.com/pricing.md), serveur MCP `https://data-slconsulting.com/api/mcp-server`.

## English summary

Official CLI and JavaScript client for Data SL Consulting, a Paris-based data and AI consultancy. Read-only, no API key: `npx datasl offers`, `npx datasl offer <slug>`, `npx datasl search <terms>`, `npx datasl read <url>`, `npx datasl mcp`. Add `--json` for machine-readable output. Node.js 18 or later, no dependencies.

## Licence

MIT
