"""Moteur d'enquête : l'IA écrit d'abord la vérité, puis les indices et les mensonges.

Chaque enquête générée est vérifiée par du code avant d'être jouée : un
suspect qui ment doit pouvoir être contredit par au moins un indice, et la
vérité doit reposer sur au moins deux indices décisifs. Une enquête qui ne
passe pas ces contrôles est refusée, jamais « réparée » en silence.
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

BASE = "https://api.tokenfactory.nebius.com/v1"
MODELE = os.environ.get("ENQUETE_MODELE", "deepseek-ai/DeepSeek-V4.1-Flash")
EXEMPLE = Path(__file__).parent / "exemples" / "enquete-1.json"
TYPES_INDICES = {"sms", "mail", "banque", "camera", "appel", "position"}

CONSIGNE_ENQUETE = """You write one case for a short investigation game set in a fictional city.
The player is an AI watching the city. A person's number comes up: in the next 24 hours
this person will be involved in a serious incident, either as the VICTIM or as the CULPRIT.
The player has three minutes to find out which.

Write the TRUTH FIRST, then the evidence, then the people around the person.
Rules:
- Fictional names and places only. No real brands, no real cities, no real public figures.
- No gore, no sexual content, no minors involved in the incident. Tone of a TV crime drama.
- 6 to 8 clues. Types: sms, mail, banque (bank record), camera, appel (call log), position.
- Each clue is a short realistic fragment (max 2 sentences) with a time (HH:MM).
- At least 2 clues are decisive: together they prove the truth. Mark them "decisive": true.
- At least 2 clues are red herrings that point the wrong way.
- Exactly 3 people around the person. At least one of them LIES about one thing.
  For each lie, give the ids of the clues that contradict it.
- Answer with JSON only, following the schema exactly."""

SCHEMA = {
    "truth": {"verdict": "victim|culprit", "what_happens": "", "why": ""},
    "person": {"name": "", "age": 0, "job": "", "district": ""},
    "clues": [{"id": "c1", "type": "sms", "time": "HH:MM", "text": "", "decisive": False}],
    "people": [{"id": "p1", "name": "", "relation": "", "knows": "", "secret": "",
                "lie": {"says": "", "contradicted_by": ["c1"]}}],
    "explanation": "",
}

CONSIGNE_PERSONNAGE = """You play {name}, {relation} of {person}, in an investigation game.
An AI is questioning you through a phone line. Answer in 1 to 3 short sentences, in the
player's language, like a real person: hesitant, defensive or warm depending on the question.
What you know: {knows}
Your secret, which you protect: {secret}
{mensonge}
Never mention the game, the clues' ids or that you are an AI. Never reveal the final verdict."""


class EnqueteInvalide(ValueError):
    pass


def charger_cle() -> str:
    cle = os.environ.get("NEBIUS_API_KEY", "").strip()
    fichier = Path.home() / ".config/jeu-enquete/nebius.env"
    if not cle and fichier.exists():
        for ligne in fichier.read_text().splitlines():
            if ligne.startswith("NEBIUS_API_KEY="):
                cle = ligne.split("=", 1)[1].strip().strip("'\"")
    if not cle:
        raise RuntimeError("Clé absente : NEBIUS_API_KEY ou ~/.config/jeu-enquete/nebius.env")
    return cle


def appeler(messages: list[dict], json_strict: bool, max_tokens: int = 3000) -> tuple[str, dict]:
    # Sans raisonnement caché : sinon le modèle épuise le budget avant d'écrire la réponse.
    corps = {"model": MODELE, "messages": messages, "max_tokens": max_tokens, "temperature": 0.9,
             "reasoning_effort": "none"}
    if json_strict:
        corps["response_format"] = {"type": "json_object"}
    requete = urllib.request.Request(
        BASE + "/chat/completions", data=json.dumps(corps).encode(),
        headers={"Authorization": "Bearer " + charger_cle(), "Content-Type": "application/json"})
    with urllib.request.urlopen(requete, timeout=120) as reponse:
        sortie = json.load(reponse)
    return sortie["choices"][0]["message"]["content"], sortie.get("usage", {})


def valider(enquete: dict) -> list[str]:
    """Problèmes de cohérence. Vide seulement si l'enquête est jouable et juste."""
    problemes = []
    verite = enquete.get("truth") or {}
    if verite.get("verdict") not in ("victim", "culprit"):
        problemes.append("verdict absent ou différent de victim/culprit")
    indices = enquete.get("clues") or []
    ids = [c.get("id") for c in indices]
    if not 6 <= len(indices) <= 8:
        problemes.append(f"{len(indices)} indices au lieu de 6 à 8")
    if len(set(ids)) != len(ids):
        problemes.append("identifiants d'indices en double")
    for indice in indices:
        if indice.get("type") not in TYPES_INDICES:
            problemes.append(f"type d'indice inconnu : {indice.get('type')}")
        if not str(indice.get("text", "")).strip():
            problemes.append(f"indice {indice.get('id')} vide")
    if sum(bool(c.get("decisive")) for c in indices) < 2:
        problemes.append("moins de deux indices décisifs")
    personnes = enquete.get("people") or []
    if len(personnes) != 3:
        problemes.append(f"{len(personnes)} personnes au lieu de 3")
    menteurs = 0
    for personne in personnes:
        mensonge = personne.get("lie")
        if not mensonge:
            continue
        menteurs += 1
        contredit = mensonge.get("contradicted_by") or []
        if not contredit or any(c not in ids for c in contredit):
            problemes.append(f"le mensonge de {personne.get('name')} n'est contredit par aucun indice existant")
    if menteurs == 0:
        problemes.append("aucun personnage ne ment")
    return problemes


def nouvelle_enquete(hors_ligne: bool = False, essais: int = 2) -> dict:
    """Génère une enquête vérifiée. Hors ligne : l'enquête d'exemple, sans appel payant."""
    if hors_ligne:
        enquete = json.loads(EXEMPLE.read_text())
        problemes = valider(enquete)
        if problemes:
            raise EnqueteInvalide("; ".join(problemes))
        return enquete
    derniers = []
    for _ in range(essais):
        texte, usage = appeler([
            {"role": "system", "content": CONSIGNE_ENQUETE},
            {"role": "user", "content": "Schema:\n" + json.dumps(SCHEMA, ensure_ascii=False)},
        ], json_strict=True)
        try:
            enquete = json.loads(texte)
        except json.JSONDecodeError:
            derniers = ["réponse qui n'est pas du JSON"]
            continue
        derniers = valider(enquete)
        if not derniers:
            enquete["_usage"] = usage
            return enquete
    raise EnqueteInvalide("; ".join(derniers))


def version_joueur(enquete: dict) -> dict:
    """Ce que le navigateur reçoit : ni la vérité, ni les secrets, ni les mensonges."""
    return {
        "person": enquete["person"],
        "clues": sorted(({k: c[k] for k in ("id", "type", "time", "text")} for c in enquete["clues"]),
                        key=lambda c: c["time"]),
        "people": [{k: p[k] for k in ("id", "name", "relation")} for p in enquete["people"]],
    }


def interroger(enquete: dict, id_personne: str, historique: list[dict]) -> str:
    personne = next(p for p in enquete["people"] if p["id"] == id_personne)
    mensonge = personne.get("lie")
    consigne = CONSIGNE_PERSONNAGE.format(
        name=personne["name"], relation=personne["relation"], person=enquete["person"]["name"],
        knows=personne["knows"], secret=personne["secret"],
        mensonge=(f"You lie about this: you claim \"{mensonge['says']}\". Keep the lie unless the player "
                  "quotes a precise fact that proves it false; then you admit it, reluctantly.")
        if mensonge else "You do not lie, but you are not eager to talk.")
    messages = [{"role": "system", "content": consigne}] + historique[-12:]
    texte, _ = appeler(messages, json_strict=False, max_tokens=200)
    # Un proche au téléphone ne parle pas avec des tirets longs.
    return texte.strip().replace(" — ", ", ").replace("—", ", ")
