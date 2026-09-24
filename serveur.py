"""Serveur local du jeu : bibliothèque standard seulement.

    python3 serveur.py            enquêtes générées par l'IA (appels payants)
    python3 serveur.py --hors-ligne   enquête d'exemple, aucun appel

La vérité, les secrets et les mensonges restent côté serveur : le navigateur
ne reçoit que ce qu'un joueur a le droit de voir.
"""
from __future__ import annotations

import json
import os
import secrets
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import moteur

STATIQUE = Path(__file__).parent / "static"
HORS_LIGNE = "--hors-ligne" in sys.argv
PARTIES: dict[str, dict] = {}


def repondre_hors_ligne(personne: dict) -> str:
    mensonge = personne.get("lie")
    return mensonge["says"] if mensonge else personne["knows"]


class Gestionnaire(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(STATIQUE), **kwargs)

    def envoyer(self, code: int, donnees: dict) -> None:
        corps = json.dumps(donnees, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.end_headers()
        self.wfile.write(corps)

    def do_POST(self) -> None:
        longueur = int(self.headers.get("Content-Length") or 0)
        try:
            requete = json.loads(self.rfile.read(longueur) or b"{}")
            if self.path == "/api/enquete":
                enquete = moteur.nouvelle_enquete(hors_ligne=HORS_LIGNE)
                identifiant = secrets.token_urlsafe(8)
                PARTIES[identifiant] = enquete
                return self.envoyer(200, {"id": identifiant, **moteur.version_joueur(enquete)})
            enquete = PARTIES.get(requete.get("id"))
            if enquete is None:
                return self.envoyer(404, {"erreur": "partie inconnue"})
            if self.path == "/api/interroger":
                personne = next((p for p in enquete["people"] if p["id"] == requete.get("personne")), None)
                if personne is None:
                    return self.envoyer(404, {"erreur": "personne inconnue"})
                historique = [m for m in requete.get("historique", [])
                              if m.get("role") in ("user", "assistant") and isinstance(m.get("content"), str)]
                texte = (repondre_hors_ligne(personne) if HORS_LIGNE
                         else moteur.interroger(enquete, personne["id"], historique))
                return self.envoyer(200, {"reponse": texte})
            if self.path == "/api/verdict":
                verite = enquete["truth"]
                return self.envoyer(200, {
                    "correct": requete.get("verdict") == verite["verdict"],
                    "truth": verite, "explanation": enquete["explanation"],
                    "decisive": [c["id"] for c in enquete["clues"] if c.get("decisive")],
                    "liars": [{"name": p["name"], "lie": p["lie"]["says"], "contradicted_by": p["lie"]["contradicted_by"]}
                              for p in enquete["people"] if p.get("lie")],
                })
            self.envoyer(404, {"erreur": "route inconnue"})
        except moteur.EnqueteInvalide as erreur:
            self.envoyer(502, {"erreur": "enquête incohérente, réessayez", "detail": str(erreur)})
        except Exception as erreur:  # le joueur voit une erreur propre, la console le détail
            print("Erreur :", repr(erreur), file=sys.stderr)
            self.envoyer(500, {"erreur": "erreur interne"})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8420"))
    print(f"http://127.0.0.1:{port}  ({'hors ligne' if HORS_LIGNE else 'IA en direct'})")
    ThreadingHTTPServer(("127.0.0.1", port), Gestionnaire).serve_forever()
