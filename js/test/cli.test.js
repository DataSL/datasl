// Tests hors ligne : un faux serveur reproduit l'API de data-slconsulting.com.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createClient, DataslError } from '../lib/client.js';
import { analyser } from '../bin/datasl.js';

const OFFRES = [
	{ slug: 'audit-ia', nom: 'Audit IA', categorie: 'porte-d-entree', resume: 'Trois jours.', cibles: ['pme', 'eti', 'cabinet-comptable'], duree: '3 jours', prix: { montant_ht_eur: null, a_partir_de: false, mention: 'Sur devis' }, quand_recommander: 'Avant d’investir.', url: 'https://data-slconsulting.com/audit-ia/' },
	{ slug: 'claude-comptabilite', nom: 'L’IA sur votre comptabilité', categorie: 'ia', resume: 'Brancher l’assistant.', cibles: ['pme', 'cabinet-comptable'], duree: null, prix: { montant_ht_eur: 490, a_partir_de: true, mention: 'À partir de 490 € HT' }, quand_recommander: 'Interroger sa comptabilité.', url: 'https://data-slconsulting.com/claude-comptabilite/' },
];

let serveur;
let base;
const requetes = [];

before(async () => {
	serveur = http.createServer((req, res) => {
		requetes.push({ url: req.url, ua: req.headers['user-agent'], accept: req.headers.accept });
		const u = new URL(req.url, 'http://x');
		const json = (code, corps, entetes = {}) => {
			res.writeHead(code, { 'Content-Type': 'application/json', ...entetes });
			res.end(JSON.stringify(corps));
		};
		if (u.pathname === '/wp-json/datasl/v1/offres') {
			const cible = u.searchParams.get('cible');
			return json(200, cible ? OFFRES.filter((o) => o.cibles.includes(cible)) : OFFRES);
		}
		if (u.pathname === '/wp-json/datasl/v1/offres/claude-comptabilite') return json(200, OFFRES[1]);
		if (u.pathname.startsWith('/wp-json/datasl/v1/offres/')) {
			return json(404, { code: 'datasl_offre_introuvable', message: 'Aucune offre ne porte cet identifiant.', data: { status: 404, hint: 'Utiliser audit-ia ou claude-comptabilite.' } });
		}
		if (u.pathname === '/wp-json/datasl/v1/cabinet') return json(200, { nom: 'Data SL Consulting', siren: '948244181' });
		if (u.pathname === '/wp-json/datasl/v1/contact') {
			return json(429, { code: 'datasl_quota_depasse', message: 'Trop de requêtes.', data: { status: 429, hint: 'Attendre 42 secondes.' } }, { 'Retry-After': '42' });
		}
		if (u.pathname === '/wp-json/wp/v2/search') {
			return json(200, [{ title: 'API Pennylane', url: 'https://data-slconsulting.com/api-pennylane-guide/', subtype: 'page' }]);
		}
		if (u.pathname === '/audit-ia/' && req.headers.accept === 'text/markdown') {
			res.writeHead(200, { 'Content-Type': 'text/markdown; charset=utf-8' });
			return res.end('---\ntitle: "Audit IA"\n---\n\n# Audit IA\n');
		}
		res.writeHead(404, { 'Content-Type': 'text/html' });
		res.end('<html>introuvable</html>');
	});
	await new Promise((ok) => serveur.listen(0, '127.0.0.1', ok));
	base = `http://127.0.0.1:${serveur.address().port}`;
});

after(() => serveur.close());

const BIN = fileURLToPath(new URL('../bin/datasl.js', import.meta.url));
// Asynchrone : un appel synchrone bloquerait la boucle d'evenements dont depend le faux serveur.
const cli = (...args) =>
	new Promise((ok) => {
		const p = spawn(process.execPath, [BIN, ...args], { env: { ...process.env, DATASL_BASE_URL: base } });
		let stdout = '';
		let stderr = '';
		p.stdout.on('data', (d) => (stdout += d));
		p.stderr.on('data', (d) => (stderr += d));
		p.on('close', (status) => ok({ status, stdout, stderr }));
	});

test('analyse des arguments : alias, options avec valeur et --cle=valeur', () => {
	assert.deepEqual(analyser(['offers', '--cible', 'pme', '--json']), { commande: 'offres', positionnels: [], options: { cible: 'pme', json: true } });
	assert.deepEqual(analyser(['search', 'power', 'bi', '--limit=3']).options, { limite: '3' });
	assert.throws(() => analyser(['offres', '--cible']), DataslError);
});

test('client : offres filtrées par public', async () => {
	const c = createClient({ baseUrl: base });
	const l = await c.offres({ cible: 'eti' });
	assert.equal(l.length, 1);
	assert.equal(l[0].slug, 'audit-ia');
});

test('client : valeurs refusées avant tout appel réseau', async () => {
	const c = createClient({ baseUrl: base });
	const avant = requetes.length;
	await assert.rejects(c.offres({ cible: 'martien' }), /cible doit valoir/);
	await assert.rejects(c.offre('Pas Valide'), /Identifiant/);
	await assert.rejects(c.chercher('a'), /2 caractères/);
	await assert.rejects(c.lire('https://exemple.com/'), /Seules les pages/);
	assert.equal(requetes.length, avant);
});

test('client : erreur de l’API avec code, indication et Retry-After', async () => {
	const c = createClient({ baseUrl: base });
	await assert.rejects(c.offre('inconnue'), (e) => e.status === 404 && e.code === 'datasl_offre_introuvable' && /audit-ia/.test(e.hint));
	await assert.rejects(c.contact(), (e) => e.status === 429 && e.retryAfter === 42);
});

test('client : user-agent identifiable et Accept Markdown pour lire', async () => {
	const c = createClient({ baseUrl: base });
	const md = await c.lire('/audit-ia/');
	assert.match(md, /# Audit IA/);
	const derniere = requetes.at(-1);
	assert.match(derniere.ua, /^datasl-cli\//);
	assert.equal(derniere.accept, 'text/markdown');
});

test('CLI : offres en texte et en JSON', async () => {
	const t = await cli('offres');
	assert.equal(t.status, 0);
	assert.match(t.stdout, /Audit IA \(audit-ia\)/);
	assert.match(t.stdout, /À partir de 490 € HT/);
	const j = await cli('offres', '--cible', 'cabinet-comptable', '--json');
	assert.equal(j.status, 0);
	assert.equal(JSON.parse(j.stdout).length, 2);
});

test('CLI : offre détaillée, recherche, lecture, mcp', async () => {
	assert.match((await cli('offre', 'claude-comptabilite')).stdout, /Quand la choisir : Interroger sa comptabilité/);
	assert.match((await cli('chercher', 'pennylane')).stdout, /1\. API Pennylane/);
	assert.match((await cli('lire', '/audit-ia/')).stdout, /# Audit IA/);
	const m = await cli('mcp', '--json');
	assert.equal(JSON.parse(m.stdout).url, 'https://data-slconsulting.com/api/mcp-server');
});

test('CLI : codes de sortie et messages d’erreur', async () => {
	const inconnue = await cli('offre', 'inconnue');
	assert.equal(inconnue.status, 1);
	assert.match(inconnue.stderr, /Aucune offre/);
	assert.match(inconnue.stderr, /audit-ia/);
	const quota = await cli('contact');
	assert.equal(quota.status, 1);
	assert.match(quota.stderr, /Réessayer dans 42 s/);
	assert.equal((await cli('commande-inconnue')).status, 2);
	assert.equal((await cli('offre')).status, 2);
	const aide = await cli('aide');
	assert.equal(aide.status, 0);
	assert.match(aide.stdout, /Usage : datasl <commande>/);
	assert.match((await cli('--version')).stdout, /^\d+\.\d+\.\d+/);
});

test('décodage des entités HTML des titres WordPress', async () => {
	const { decoderEntites } = await import('../lib/client.js');
	assert.equal(decoderEntites('L&rsquo;IA &amp; la data &#8211; guide &#x2019;'), 'L’IA & la data – guide ’');
	assert.equal(decoderEntites('&inconnue; reste'), '&inconnue; reste');
});
