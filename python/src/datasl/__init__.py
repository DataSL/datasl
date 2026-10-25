"""Client Python officiel de Data SL Consulting.

Interroge l'API publique en lecture seule décrite dans https://data-slconsulting.com/openapi.json
(aucune clé, 120 requêtes par minute et par adresse IP).

    >>> from datasl import Client
    >>> Client().offre("claude-comptabilite")["prix"]["mention"]
"""

from __future__ import annotations

import html
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

__version__ = "1.0.0"
__all__ = ["Client", "DataslError", "CIBLES", "CATEGORIES", "BASE_PAR_DEFAUT", "__version__"]

BASE_PAR_DEFAUT = "https://data-slconsulting.com"
CIBLES = ("pme", "eti", "cabinet-comptable")
CATEGORIES = ("porte-d-entree", "ia", "data", "bi", "accompagnement")


class DataslError(Exception):
    """Erreur de l'API ou du réseau, avec code machine et indication de correction."""

    def __init__(self, message: str, *, status: int | None = None, code: str | None = None,
                 hint: str | None = None, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.status = status
        self.code = code
        self.hint = hint
        self.retry_after = retry_after


def _verifier(valeur: str | None, liste: tuple[str, ...], nom: str) -> None:
    if valeur is not None and valeur not in liste:
        raise DataslError(f"{nom} doit valoir : {', '.join(liste)}.", code="parametre_invalide")


class Client:
    """Accès aux offres, à la fiche du cabinet, aux coordonnées et aux pages du site."""

    def __init__(self, base_url: str | None = None, *, timeout: float = 30.0, user_agent: str | None = None) -> None:
        self.base = (base_url or os.environ.get("DATASL_BASE_URL") or BASE_PAR_DEFAUT).rstrip("/")
        self.timeout = timeout
        self.user_agent = user_agent or f"datasl-python/{__version__} (+https://data-slconsulting.com/developers/)"

    # ---------- transport ----------

    def _requete(self, url: str, accept: str) -> tuple[int, dict[str, str], bytes]:
        req = urllib.request.Request(url, headers={"Accept": accept, "User-Agent": self.user_agent})
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as rep:
                return rep.status, {k.lower(): v for k, v in rep.headers.items()}, rep.read()
        except urllib.error.HTTPError as e:
            return e.code, {k.lower(): v for k, v in (e.headers or {}).items()}, e.read() or b""
        except (urllib.error.URLError, OSError) as e:
            raison = getattr(e, "reason", e)
            raise DataslError(f"Connexion impossible à {self.base} : {raison}", code="reseau") from None

    def _api(self, chemin: str, **params: Any) -> Any:
        requete = {k: v for k, v in params.items() if v not in (None, "")}
        url = f"{self.base}/wp-json{chemin}" + (("?" + urllib.parse.urlencode(requete)) if requete else "")
        statut, entetes, corps = self._requete(url, "application/json")
        try:
            donnees = json.loads(corps.decode("utf-8")) if corps else None
        except ValueError:
            donnees = None
        if statut >= 400:
            info = donnees if isinstance(donnees, dict) else {}
            data = info.get("data") if isinstance(info.get("data"), dict) else {}
            retry = entetes.get("retry-after")
            raise DataslError(
                info.get("message") or f"Erreur HTTP {statut}",
                status=statut,
                code=info.get("code"),
                hint=data.get("hint"),
                retry_after=int(retry) if retry and retry.isdigit() else None,
            )
        return donnees

    # ---------- API ----------

    def offres(self, cible: str | None = None, categorie: str | None = None) -> list[dict[str, Any]]:
        """Catalogue des offres, filtrable par public (cible) et par famille (categorie)."""
        _verifier(cible, CIBLES, "cible")
        _verifier(categorie, CATEGORIES, "categorie")
        return self._api("/datasl/v1/offres", cible=cible, categorie=categorie)

    def offre(self, slug: str) -> dict[str, Any]:
        """Une offre par son identifiant, par exemple « claude-comptabilite »."""
        if not slug or not re.fullmatch(r"[a-z0-9-]+", slug):
            raise DataslError("Identifiant d’offre attendu : lettres minuscules, chiffres et tirets (voir « datasl offres »).",
                              code="parametre_invalide")
        return self._api("/datasl/v1/offres/" + slug)

    def cabinet(self, champs: list[str] | str | None = None) -> dict[str, Any]:
        """Fiche du cabinet : identité légale (SIREN), adresse, partenariats, technologies."""
        return self._api("/datasl/v1/cabinet", champs=",".join(champs) if isinstance(champs, (list, tuple)) else champs)

    def contact(self, champs: list[str] | str | None = None) -> dict[str, Any]:
        """Coordonnées et page de prise de rendez-vous."""
        return self._api("/datasl/v1/contact", champs=",".join(champs) if isinstance(champs, (list, tuple)) else champs)

    def chercher(self, termes: str, limite: int = 5, type: str | None = None) -> list[dict[str, str]]:
        """Recherche plein texte dans les pages et articles du site."""
        q = (termes or "").strip()
        if len(q) < 2:
            raise DataslError("Termes de recherche attendus (2 caractères au moins).", code="parametre_invalide")
        if type is not None and type not in ("page", "post"):
            raise DataslError("type doit valoir page ou post.", code="parametre_invalide")
        n = min(20, max(1, int(limite or 5)))
        liste = self._api("/wp/v2/search", search=q, per_page=n, subtype=type)
        return [{"titre": html.unescape(r.get("title", "")), "url": r.get("url", ""), "type": r.get("subtype", "")} for r in liste]

    def lire(self, adresse: str) -> str:
        """Contenu d'une page du site en Markdown."""
        cible = urllib.parse.urlsplit(urllib.parse.urljoin(self.base + "/", adresse or ""))
        origine = urllib.parse.urlsplit(self.base)
        if (cible.scheme, cible.netloc) != (origine.scheme, origine.netloc) or re.match(r"/(wp-admin|wp-json|wp-login|api/)", cible.path or "/"):
            raise DataslError(f"Seules les pages de contenu de {self.base} sont lisibles.", code="parametre_invalide")
        statut, entetes, corps = self._requete(urllib.parse.urlunsplit(cible), "text/markdown")
        if statut != 200 or "markdown" not in entetes.get("content-type", ""):
            raise DataslError(f"Page introuvable ou non lisible (statut {statut}). Essayer « datasl chercher ».",
                              status=statut, code="page_introuvable")
        return corps.decode("utf-8")
