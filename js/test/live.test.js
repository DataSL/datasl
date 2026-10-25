// Test contre le site réel (quelques requêtes seulement). Lancer avec : npm run test:live
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../lib/client.js';

const c = createClient({ baseUrl: 'https://data-slconsulting.com' });

test('site réel : offres, offre, cabinet, contact', async () => {
	const offres = await c.offres({ cible: 'cabinet-comptable' });
	assert.ok(offres.length > 0 && offres.every((o) => o.cibles.includes('cabinet-comptable')));
	assert.equal((await c.offre('claude-comptabilite')).prix.montant_ht_eur, 490);
	assert.equal((await c.cabinet({ champs: ['nom', 'siren'] })).siren, '948244181');
	assert.match((await c.contact()).email, /@data-slconsulting\.com$/);
});

test('site réel : recherche et lecture', async () => {
	const res = await c.chercher('Pennylane', { limite: 3 });
	assert.ok(res.length >= 1 && res.every((r) => r.url.startsWith('https://data-slconsulting.com/')));
	assert.match(await c.lire('/audit-ia/'), /Audit IA/);
	await assert.rejects(c.offre('inconnue'), (e) => e.status === 404 && Boolean(e.hint));
});
