"""Test contre le site réel (quelques requêtes). Lancer avec : DATASL_LIVE=1 python -m unittest tests.test_live"""

import os
import unittest

from datasl import Client, DataslError


@unittest.skipUnless(os.environ.get("DATASL_LIVE") == "1", "test réseau : définir DATASL_LIVE=1")
class TestSiteReel(unittest.TestCase):
    def setUp(self):
        self.c = Client("https://data-slconsulting.com")

    def test_offres_cabinet_contact(self):
        offres = self.c.offres(cible="cabinet-comptable")
        self.assertTrue(offres and all("cabinet-comptable" in o["cibles"] for o in offres))
        self.assertEqual(self.c.offre("claude-comptabilite")["prix"]["montant_ht_eur"], 490)
        self.assertEqual(self.c.cabinet(champs=["nom", "siren"])["siren"], "948244181")
        self.assertTrue(self.c.contact()["email"].endswith("@data-slconsulting.com"))

    def test_recherche_lecture_erreur(self):
        res = self.c.chercher("Pennylane", limite=3)
        self.assertTrue(res and all(r["url"].startswith("https://data-slconsulting.com/") and "&" not in r["titre"] for r in res))
        self.assertIn("Audit IA", self.c.lire("/audit-ia/"))
        with self.assertRaises(DataslError) as e:
            self.c.offre("inconnue")
        self.assertEqual(e.exception.status, 404)
        self.assertTrue(e.exception.hint)


if __name__ == "__main__":
    unittest.main()
