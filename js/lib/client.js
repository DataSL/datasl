// Client JavaScript officiel de Data SL Consulting.
// Il interroge l'API publique en lecture seule decrite dans https://data-slconsulting.com/openapi.json
// (aucune cle, quota de 120 requetes par minute et par adresse IP).

export const BASE_PAR_DEFAUT = 'https://data-slconsulting.com';
export const VERSION = '1.0.0';
export const CIBLES = ['pme', 'eti', 'cabinet-comptable'];
export const CATEGORIES = ['porte-d-entree', 'ia', 'data', 'bi', 'accompagnement'];

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç' };

/** Decode les entites HTML que WordPress laisse dans les titres (&rsquo;, &#8217;...). */
export function decoderEntites(texte) {
	return String(texte).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
		if (e[0] === '#') {
			const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
			return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
		}
		return Object.prototype.hasOwnProperty.call(ENTITES, e.toLowerCase()) ? ENTITES[e.toLowerCase()] : m;
	});
}

export class DataslError extends Error {
	constructor(message, { status, code, hint, retryAfter } = {}) {
		super(message);
		this.name = 'DataslError';
		this.status = status;
		this.code = code;
		this.hint = hint;
		this.retryAfter = retryAfter;
	}
}

function verifier(valeur, liste, nom) {
	if (valeur !== undefined && valeur !== null && !liste.includes(valeur)) {
		throw new DataslError(`${nom} doit valoir : ${liste.join(', ')}.`, { code: 'parametre_invalide' });
	}
}

export function createClient(options = {}) {
	const base = String(options.baseUrl || process.env.DATASL_BASE_URL || BASE_PAR_DEFAUT).replace(/\/+$/, '');
	const appel = options.fetch || globalThis.fetch;
	const agent = options.userAgent || `datasl-cli/${VERSION} (+https://data-slconsulting.com/developers/)`;
	if (typeof appel !== 'function') {
		throw new DataslError('fetch est indisponible : Node.js 18 ou plus est nécessaire.');
	}

	async function api(chemin, requete = {}) {
		const url = new URL(base + '/wp-json' + chemin);
		for (const [cle, valeur] of Object.entries(requete)) {
			if (valeur !== undefined && valeur !== null && valeur !== '') {
				url.searchParams.set(cle, String(valeur));
			}
		}
		let rep;
		try {
			rep = await appel(url, { headers: { Accept: 'application/json', 'User-Agent': agent } });
		} catch (e) {
			throw new DataslError(`Connexion impossible à ${base} : ${e.message}`, { code: 'reseau' });
		}
		let corps = null;
		try {
			corps = await rep.json();
		} catch {
			corps = null;
		}
		if (!rep.ok) {
			const retry = rep.headers.get('Retry-After');
			throw new DataslError((corps && corps.message) || `Erreur HTTP ${rep.status}`, {
				status: rep.status,
				code: corps && corps.code,
				hint: corps && corps.data && corps.data.hint,
				retryAfter: retry ? Number(retry) : undefined,
			});
		}
		return corps;
	}

	return {
		base,

		/** Catalogue des offres, filtrable par public (cible) et par famille (categorie). */
		async offres({ cible, categorie } = {}) {
			verifier(cible, CIBLES, 'cible');
			verifier(categorie, CATEGORIES, 'categorie');
			return api('/datasl/v1/offres', { cible, categorie });
		},

		/** Une offre par son identifiant, par exemple "claude-comptabilite". */
		async offre(slug) {
			if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
				throw new DataslError('Identifiant d’offre attendu : lettres minuscules, chiffres et tirets (voir « datasl offres »).', { code: 'parametre_invalide' });
			}
			return api('/datasl/v1/offres/' + slug);
		},

		/** Fiche du cabinet (identité légale, adresse, partenariats, technologies). */
		async cabinet({ champs } = {}) {
			return api('/datasl/v1/cabinet', { champs: Array.isArray(champs) ? champs.join(',') : champs });
		},

		/** Coordonnées et page de prise de rendez-vous. */
		async contact({ champs } = {}) {
			return api('/datasl/v1/contact', { champs: Array.isArray(champs) ? champs.join(',') : champs });
		},

		/** Recherche plein texte dans les pages et articles du site. */
		async chercher(termes, { limite = 5, type } = {}) {
			const q = String(termes || '').trim();
			if (q.length < 2) {
				throw new DataslError('Termes de recherche attendus (2 caractères au moins).', { code: 'parametre_invalide' });
			}
			const n = Math.min(20, Math.max(1, parseInt(limite, 10) || 5));
			if (type !== undefined && !['page', 'post'].includes(type)) {
				throw new DataslError('type doit valoir page ou post.', { code: 'parametre_invalide' });
			}
			const liste = await api('/wp/v2/search', { search: q, per_page: n, subtype: type });
			return liste.map((r) => ({ titre: decoderEntites(r.title), url: r.url, type: r.subtype }));
		},

		/** Contenu d'une page du site en Markdown. */
		async lire(adresse) {
			let cible;
			try {
				cible = new URL(String(adresse || ''), base);
			} catch {
				throw new DataslError('Adresse invalide.', { code: 'parametre_invalide' });
			}
			if (cible.origin !== new URL(base).origin || /^\/(wp-admin|wp-json|wp-login|api\/)/.test(cible.pathname)) {
				throw new DataslError(`Seules les pages de contenu de ${base} sont lisibles.`, { code: 'parametre_invalide' });
			}
			let rep;
			try {
				rep = await appel(cible, { headers: { Accept: 'text/markdown', 'User-Agent': agent } });
			} catch (e) {
				throw new DataslError(`Connexion impossible à ${base} : ${e.message}`, { code: 'reseau' });
			}
			const type = rep.headers.get('Content-Type') || '';
			if (!rep.ok || !type.includes('markdown')) {
				throw new DataslError(`Page introuvable ou non lisible (statut ${rep.status}). Essayer « datasl chercher ».`, { status: rep.status, code: 'page_introuvable' });
			}
			return rep.text();
		},
	};
}

export default createClient;
