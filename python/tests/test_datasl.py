"""Tests hors ligne : un faux serveur reproduit l'API de data-slconsulting.com."""

import io
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

from datasl import Client, DataslError, __version__
from datasl.cli import executer, main

OFFRES = [
    {"slug": "audit-ia", "nom": "Audit IA", "categorie": "porte-d-entree", "resume": "Trois jours.",
     "cibles": ["pme", "eti", "cabinet-comptable"], "duree": "3 jours",
     "prix": {"montant_ht_eur": None, "a_partir_de": False, "mention": "Sur devis"},
     "quand_recommander": "Avant d’investir.", "url": "https://data-slconsulting.com/audit-ia/"},
    {"slug": "claude-comptabilite", "nom": "L’IA sur votre comptabilité", "categorie": "ia", "resume": "Brancher l’assistant.",
     "cibles": ["pme", "cabinet-comptable"], "duree": None,
     "prix": {"montant_ht_eur": 490, "a_partir_de": True, "mention": "À partir de 490 € HT"},
     "quand_recommander": "Interroger sa comptabilité.", "url": "https://data-slconsulting.com/claude-comptabilite/"},
]
REQUETES = []


class FauxSite(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, code, corps, entetes=None):
        donnees = json.dumps(corps).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        for k, v in (entetes or {}).items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(donnees)))
        self.end_headers()
        self.wfile.write(donnees)

    def do_GET(self):
        REQUETES.append({"chemin": self.path, "ua": self.headers.get("User-Agent"), "accept": self.headers.get("Accept")})
        u = urlsplit(self.path)
        q = parse_qs(u.query)
        if u.path == "/wp-json/datasl/v1/offres":
            cible = q.get("cible", [None])[0]
            return self._json(200, [o for o in OFFRES if not cible or cible in o["cibles"]])
        if u.path == "/wp-json/datasl/v1/offres/claude-comptabilite":
            return self._json(200, OFFRES[1])
        if u.path.startswith("/wp-json/datasl/v1/offres/"):
            return self._json(404, {"code": "datasl_offre_introuvable", "message": "Aucune offre ne porte cet identifiant.",
                                    "data": {"status": 404, "hint": "Utiliser audit-ia ou claude-comptabilite."}})
        if u.path == "/wp-json/datasl/v1/cabinet":
            return self._json(200, {"nom": "Data SL Consulting", "siren": "948244181"})
        if u.path == "/wp-json/datasl/v1/contact":
            return self._json(429, {"code": "datasl_quota_depasse", "message": "Trop de requêtes.",
                                    "data": {"status": 429, "hint": "Attendre 42 secondes."}}, {"Retry-After": "42"})
        if u.path == "/wp-json/wp/v2/search":
            return self._json(200, [{"title": "L&rsquo;API Pennylane &#8211; guide", "url": "https://data-slconsulting.com/api-pennylane-guide/", "subtype": "page"}])
        if u.path == "/audit-ia/" and self.headers.get("Accept") == "text/markdown":
            corps = "---\ntitle: \"Audit IA\"\n---\n\n# Audit IA\n".encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/markdown; charset=utf-8")
            self.send_header("Content-Length", str(len(corps)))
            self.end_headers()
            return self.wfile.write(corps)
        self.send_response(404)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<html>introuvable</html>")


class TestDatasl(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.serveur = ThreadingHTTPServer(("127.0.0.1", 0), FauxSite)
        threading.Thread(target=cls.serveur.serve_forever, daemon=True).start()
        cls.base = f"http://127.0.0.1:{cls.serveur.server_address[1]}"
        cls.client = Client(cls.base)

    @classmethod
    def tearDownClass(cls):
        cls.serveur.shutdown()

    def cli(self, *args):
        sortie = io.StringIO()
        code = executer(list(args), client=self.client, sortie=sortie)
        return code, sortie.getvalue()

    # ---------- client ----------

    def test_offres_filtrees(self):
        self.assertEqual([o["slug"] for o in self.client.offres(cible="eti")], ["audit-ia"])

    def test_valeurs_refusees_sans_appel_reseau(self):
        avant = len(REQUETES)
        for appel in (lambda: self.client.offres(cible="martien"), lambda: self.client.offre("Pas Valide"),
                      lambda: self.client.chercher("a"), lambda: self.client.lire("https://exemple.com/")):
            with self.assertRaises(DataslError):
                appel()
        self.assertEqual(len(REQUETES), avant)

    def test_erreurs_api(self):
        with self.assertRaises(DataslError) as e:
            self.client.offre("inconnue")
        self.assertEqual((e.exception.status, e.exception.code), (404, "datasl_offre_introuvable"))
        self.assertIn("audit-ia", e.exception.hint)
        with self.assertRaises(DataslError) as e:
            self.client.contact()
        self.assertEqual((e.exception.status, e.exception.retry_after), (429, 42))

    def test_recherche_entites_decodees(self):
        self.assertEqual(self.client.chercher("pennylane")[0]["titre"], "L’API Pennylane – guide")

    def test_lire_markdown_et_user_agent(self):
        self.assertIn("# Audit IA", self.client.lire("/audit-ia/"))
        self.assertEqual(REQUETES[-1]["accept"], "text/markdown")
        self.assertTrue(REQUETES[-1]["ua"].startswith("datasl-python/"))

    # ---------- CLI ----------

    def test_cli_offres_texte_et_json(self):
        code, out = self.cli("offres")
        self.assertEqual(code, 0)
        self.assertIn("Audit IA (audit-ia)", out)
        self.assertIn("À partir de 490 € HT", out)
        code, out = self.cli("offers", "--cible", "cabinet-comptable", "--json")
        self.assertEqual(len(json.loads(out)), 2)

    def test_cli_offre_recherche_lecture_mcp(self):
        self.assertIn("Quand la choisir : Interroger sa comptabilité", self.cli("offre", "claude-comptabilite")[1])
        self.assertIn("1. L’API Pennylane", self.cli("search", "pennylane")[1])
        self.assertIn("# Audit IA", self.cli("lire", "/audit-ia/")[1])
        self.assertEqual(json.loads(self.cli("mcp", "--json")[1])["url"], "https://data-slconsulting.com/api/mcp-server")

    def test_main_codes_de_sortie(self):
        import os
        ancien = os.environ.get("DATASL_BASE_URL")
        os.environ["DATASL_BASE_URL"] = self.base
        try:
            self.assertEqual(main(["offre", "inconnue"]), 1)
            self.assertEqual(main(["contact"]), 1)
            self.assertEqual(main(["commande-inconnue"]), 2)
            self.assertEqual(main(["offres", "--cible", "martien"]), 2)
            self.assertEqual(main(["aide"]), 0)
            with self.assertRaises(SystemExit) as e:
                main(["--version"])
            self.assertEqual(e.exception.code, 0)
        finally:
            if ancien is None:
                os.environ.pop("DATASL_BASE_URL", None)
            else:
                os.environ["DATASL_BASE_URL"] = ancien

    def test_version(self):
        self.assertRegex(__version__, r"^\d+\.\d+\.\d+$")


if __name__ == "__main__":
    unittest.main()
