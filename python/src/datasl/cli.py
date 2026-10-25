"""CLI officielle de Data SL Consulting. Aide : datasl aide"""

from __future__ import annotations

import argparse
import json
import sys
from typing import Any, Sequence

from . import CATEGORIES, CIBLES, Client, DataslError, __version__

MCP_URL = "https://data-slconsulting.com/api/mcp-server"
ALIAS = {"offers": "offres", "offer": "offre", "company": "cabinet", "about": "cabinet",
         "search": "chercher", "read": "lire", "help": "aide"}
LIBELLES = {"pme": "PME", "eti": "ETI", "cabinet-comptable": "cabinets d’expertise comptable"}


class _Usage(Exception):
    pass


class _Parseur(argparse.ArgumentParser):
    def error(self, message: str) -> None:  # code 2 et message en français, sans trace
        raise _Usage(message)


def _parseur() -> _Parseur:
    commun = argparse.ArgumentParser(add_help=False)
    commun.add_argument("--json", action="store_true", help="sortie JSON (scripts et agents)")
    p = _Parseur(prog="datasl", description="CLI officielle de Data SL Consulting (conseil data et IA, Paris).",
                 epilog="API publique : https://data-slconsulting.com/developers/ (120 requêtes par minute). "
                        "Contact : contact@data-slconsulting.com, 01 83 64 60 25.")
    p.add_argument("--version", action="version", version=__version__)
    sous = p.add_subparsers(dest="commande", metavar="commande", parser_class=_Parseur)
    s = sous.add_parser("offres", parents=[commun], help="catalogue des offres et prix publics")
    s.add_argument("--cible", choices=CIBLES)
    s.add_argument("--categorie", choices=CATEGORIES)
    s = sous.add_parser("offre", parents=[commun], help="détail d'une offre")
    s.add_argument("slug")
    s = sous.add_parser("cabinet", parents=[commun], help="fiche du cabinet")
    s.add_argument("--champs", help="champs séparés par des virgules")
    s = sous.add_parser("contact", parents=[commun], help="coordonnées et prise de rendez-vous")
    s.add_argument("--champs", help="champs séparés par des virgules")
    s = sous.add_parser("chercher", parents=[commun], help="recherche dans les pages et guides")
    s.add_argument("termes", nargs="+")
    s.add_argument("--limite", type=int, default=5)
    s.add_argument("--type", choices=("page", "post"))
    s = sous.add_parser("lire", parents=[commun], help="une page du site en Markdown")
    s.add_argument("adresse")
    sous.add_parser("mcp", parents=[commun], help="adresse du serveur MCP et commandes pour l'ajouter")
    sous.add_parser("aide", help="cette aide")
    return p


def _pour(o: dict[str, Any]) -> str:
    return ", ".join(LIBELLES.get(c, c) for c in o.get("cibles", []))


def _offre(o: dict[str, Any], detail: bool) -> str:
    lignes = [f"{o['nom']} ({o['slug']})", f"  Prix : {o['prix']['mention']}"]
    if o.get("duree"):
        lignes.append(f"  Durée : {o['duree']}")
    lignes.append(f"  Pour : {_pour(o)}")
    if detail:
        lignes += [f"  Contenu : {o['resume']}", f"  Quand la choisir : {o['quand_recommander']}"]
    lignes.append(f"  {o['url']}")
    return "\n".join(lignes)


def _fiche(d: dict[str, Any]) -> str:
    def valeur(v: Any) -> str:
        if isinstance(v, list):
            return ", ".join(map(str, v))
        if isinstance(v, dict):
            return ", ".join(map(str, v.values()))
        return str(v)
    return "\n".join(f"{k} : {valeur(v)}" for k, v in d.items())


def executer(argv: Sequence[str], client: Client | None = None, sortie=None) -> int:
    ecrire = (sortie or sys.stdout).write
    argv = list(argv)
    if argv and argv[0] in ALIAS:
        argv[0] = ALIAS[argv[0]]
    parseur = _parseur()
    a = parseur.parse_args(argv)
    if a.commande in (None, "aide"):
        ecrire(parseur.format_help())
        return 0 if a.commande == "aide" or not argv else 2
    c = client or Client()

    def afficher(donnees: Any, texte) -> None:
        ecrire((json.dumps(donnees, ensure_ascii=False, indent=2) if a.json else texte(donnees)) + "\n")

    if a.commande == "offres":
        afficher(c.offres(cible=a.cible, categorie=a.categorie),
                 lambda l: "\n\n".join(_offre(o, False) for o in l) if l else "Aucune offre pour ces filtres.")
    elif a.commande == "offre":
        afficher(c.offre(a.slug), lambda o: _offre(o, True))
    elif a.commande == "cabinet":
        afficher(c.cabinet(champs=a.champs), _fiche)
    elif a.commande == "contact":
        afficher(c.contact(champs=a.champs), _fiche)
    elif a.commande == "chercher":
        afficher(c.chercher(" ".join(a.termes), limite=a.limite, type=a.type),
                 lambda l: "\n".join(f"{i}. {r['titre']}\n   {r['url']}" for i, r in enumerate(l, 1)) if l else "Aucun résultat.")
    elif a.commande == "lire":
        md = c.lire(a.adresse)
        ecrire((json.dumps({"url": a.adresse, "markdown": md}, ensure_ascii=False, indent=2) if a.json else md) + "\n")
    elif a.commande == "mcp":
        infos = {"url": MCP_URL, "transport": "streamable-http", "carte": MCP_URL + "/server-card",
                 "claude_code": f"claude mcp add --transport http data-slconsulting {MCP_URL}",
                 "configuration": {"mcpServers": {"data-slconsulting": {"type": "http", "url": MCP_URL}}}}
        afficher(infos, lambda i: "\n".join([
            f"Serveur MCP public (lecture seule) : {i['url']}",
            f"Transport : Streamable HTTP. Carte serveur : {i['carte']}", "",
            "Claude Code :", f"  {i['claude_code']}", "",
            "Configuration JSON (clients MCP) :", json.dumps(i["configuration"], indent=2)]))
    return 0


def main(argv: Sequence[str] | None = None) -> int:
    for flux in (sys.stdout, sys.stderr):
        try:
            # Sortie redirigee (agent, script, fichier) : toujours en UTF-8, sinon Windows ecrit en cp1252
            # et les accents arrivent abimes. Console interactive : Python gere deja l'Unicode.
            if flux.isatty():
                flux.reconfigure(errors="replace")
            else:
                flux.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError, OSError):
            pass
    try:
        return executer(sys.argv[1:] if argv is None else argv)
    except _Usage as e:
        sys.stderr.write(f"datasl : {e}. Voir « datasl aide ».\n")
        return 2
    except DataslError as e:
        sys.stderr.write(f"datasl : {e.message}\n")
        if e.hint:
            sys.stderr.write(f"  {e.hint}\n")
        if e.retry_after:
            sys.stderr.write(f"  Réessayer dans {e.retry_after} s.\n")
        return 2 if e.code == "parametre_invalide" else 1


if __name__ == "__main__":
    sys.exit(main())
