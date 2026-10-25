#!/usr/bin/env node
// CLI officielle de Data SL Consulting. Aide : datasl aide
import { createClient, DataslError, VERSION, CIBLES, CATEGORIES } from '../lib/client.js';

const MCP_URL = 'https://data-slconsulting.com/api/mcp-server';

const AIDE = `datasl ${VERSION} : CLI officielle de Data SL Consulting (conseil data et IA, Paris)

Usage : datasl <commande> [options]

Commandes
  offres                 Catalogue des offres et prix publics
                           --cible ${CIBLES.join('|')}
                           --categorie ${CATEGORIES.join('|')}
  offre <slug>           Détail d'une offre (ex. datasl offre claude-comptabilite)
  cabinet                Fiche du cabinet (SIREN, adresse, partenariats)
  contact                E-mail, téléphone, prise de rendez-vous
  chercher <termes...>   Recherche dans les pages et guides du site
                           --limite <1-20> (5 par défaut)   --type page|post
  lire <adresse>         Une page du site en Markdown (ex. datasl lire /audit-ia/)
  mcp                    Adresse du serveur MCP et commandes pour l'ajouter
  aide                   Cette aide

Options générales
  --json                 Sortie JSON (pour les scripts et les agents)
  --version              Version de la CLI

Alias anglais : offers, offer, company, search, read, help.
API publique : https://data-slconsulting.com/developers/ (120 requêtes par minute).
Contact : contact@data-slconsulting.com, 01 83 64 60 25.`;

const ALIAS = { offers: 'offres', offer: 'offre', company: 'cabinet', about: 'cabinet', search: 'chercher', read: 'lire', help: 'aide' };
const AVEC_VALEUR = new Set(['cible', 'categorie', 'limite', 'type', 'champs', 'base']);

export function analyser(argv) {
	const positionnels = [];
	const options = {};
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === '-h') {
			options.aide = true;
		} else if (arg === '-v') {
			options.version = true;
		} else if (arg.startsWith('--')) {
			const [nom, valeurEgal] = arg.slice(2).split(/=(.*)/s);
			const cle = { help: 'aide', limit: 'limite', category: 'categorie', target: 'cible', fields: 'champs' }[nom] || nom;
			if (AVEC_VALEUR.has(cle)) {
				const valeur = valeurEgal !== undefined ? valeurEgal : argv[++i];
				if (valeur === undefined) {
					throw new DataslError(`L'option --${nom} attend une valeur.`, { code: 'usage' });
				}
				options[cle] = valeur;
			} else {
				options[cle] = true;
			}
		} else {
			positionnels.push(arg);
		}
	}
	const brute = positionnels.shift();
	return { commande: brute ? ALIAS[brute] || brute : undefined, positionnels, options };
}

const ecrire = (texte) => process.stdout.write(texte.endsWith('\n') ? texte : texte + '\n');

function pour(o) {
	const libelles = { pme: 'PME', eti: 'ETI', 'cabinet-comptable': 'cabinets d’expertise comptable' };
	return o.cibles.map((c) => libelles[c] || c).join(', ');
}

function formaterOffre(o, detail) {
	const lignes = [`${o.nom} (${o.slug})`, `  Prix : ${o.prix.mention}`];
	if (o.duree) lignes.push(`  Durée : ${o.duree}`);
	lignes.push(`  Pour : ${pour(o)}`);
	if (detail) {
		lignes.push(`  Contenu : ${o.resume}`);
		lignes.push(`  Quand la choisir : ${o.quand_recommander}`);
	}
	lignes.push(`  ${o.url}`);
	return lignes.join('\n');
}

export async function executer(argv, { client } = {}) {
	const { commande, positionnels, options } = analyser(argv);
	if (options.version) {
		ecrire(VERSION);
		return 0;
	}
	if (!commande || commande === 'aide' || options.aide) {
		ecrire(AIDE);
		return commande && commande !== 'aide' && !options.aide ? 2 : 0;
	}
	const c = client || createClient({ baseUrl: options.base });
	const json = Boolean(options.json);
	const sortie = (donnees, texte) => ecrire(json ? JSON.stringify(donnees, null, 2) : texte(donnees));

	switch (commande) {
		case 'offres': {
			const liste = await c.offres({ cible: options.cible, categorie: options.categorie });
			sortie(liste, (l) => (l.length ? l.map((o) => formaterOffre(o, false)).join('\n\n') : 'Aucune offre pour ces filtres.'));
			return 0;
		}
		case 'offre': {
			if (!positionnels[0]) throw new DataslError('Usage : datasl offre <slug>. Les identifiants sont donnés par « datasl offres ».', { code: 'usage' });
			sortie(await c.offre(positionnels[0]), (o) => formaterOffre(o, true));
			return 0;
		}
		case 'cabinet': {
			sortie(await c.cabinet({ champs: options.champs }), (f) =>
				Object.entries(f)
					.map(([k, v]) => `${k} : ${typeof v === 'object' ? (Array.isArray(v) ? v.join(', ') : Object.values(v).join(', ')) : v}`)
					.join('\n')
			);
			return 0;
		}
		case 'contact': {
			sortie(await c.contact({ champs: options.champs }), (f) =>
				Object.entries(f)
					.map(([k, v]) => `${k} : ${Array.isArray(v) ? v.join(', ') : v}`)
					.join('\n')
			);
			return 0;
		}
		case 'chercher': {
			if (!positionnels.length) throw new DataslError('Usage : datasl chercher <termes...>', { code: 'usage' });
			const res = await c.chercher(positionnels.join(' '), { limite: options.limite, type: options.type });
			sortie(res, (l) => (l.length ? l.map((r, i) => `${i + 1}. ${r.titre}\n   ${r.url}`).join('\n') : 'Aucun résultat.'));
			return 0;
		}
		case 'lire': {
			if (!positionnels[0]) throw new DataslError('Usage : datasl lire <adresse ou chemin>', { code: 'usage' });
			const md = await c.lire(positionnels[0]);
			ecrire(json ? JSON.stringify({ url: positionnels[0], markdown: md }, null, 2) : md);
			return 0;
		}
		case 'mcp': {
			const infos = {
				url: MCP_URL,
				transport: 'streamable-http',
				carte: MCP_URL + '/server-card',
				claude_code: `claude mcp add --transport http data-slconsulting ${MCP_URL}`,
				configuration: { mcpServers: { 'data-slconsulting': { type: 'http', url: MCP_URL } } },
			};
			sortie(infos, (i) =>
				[
					`Serveur MCP public (lecture seule) : ${i.url}`,
					`Transport : Streamable HTTP. Carte serveur : ${i.carte}`,
					'',
					'Claude Code :',
					`  ${i.claude_code}`,
					'',
					'Configuration JSON (clients MCP) :',
					JSON.stringify(i.configuration, null, 2),
				].join('\n')
			);
			return 0;
		}
		default:
			throw new DataslError(`Commande inconnue : ${commande}. Voir « datasl aide ».`, { code: 'usage' });
	}
}

async function principal() {
	try {
		process.exitCode = await executer(process.argv.slice(2));
	} catch (e) {
		if (e instanceof DataslError) {
			process.stderr.write(`datasl : ${e.message}\n`);
			if (e.hint) process.stderr.write(`  ${e.hint}\n`);
			if (e.retryAfter) process.stderr.write(`  Réessayer dans ${e.retryAfter} s.\n`);
			process.exitCode = e.code === 'usage' ? 2 : 1;
		} else {
			process.stderr.write(`datasl : erreur inattendue : ${e && e.message ? e.message : e}\n`);
			process.exitCode = 1;
		}
	}
}

// Execute seulement quand le fichier est lance comme commande (pas quand il est importe par les tests).
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const lanceDirectement = (() => {
	try {
		return process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
	} catch {
		return false;
	}
})();
if (lanceDirectement) {
	principal();
}
