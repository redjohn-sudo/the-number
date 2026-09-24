// Une partie : ouvrir des fichiers coûte de la vie privée, appeler des proches coûte du temps.
const $ = (id) => document.getElementById(id);
const DUREE = 180;
const COUT_FICHIER = 12;
const COULOIRS = [
  ["sms", "Messages"], ["mail", "Mails"], ["appel", "Appels"],
  ["banque", "Banque"], ["camera", "Caméras"], ["position", "Positions"],
];
const LIBELLES = Object.fromEntries(COULOIRS);

const CLE = "le-numero.v1";
const TITRES = { m: "opérateur", f: "opératrice", n: "analyste" };

let partie = null, restant = DUREE, minuteur = null, viePrivee = 100, ouverts = [];
let fils = {}, enLigne = null;

// Profil et dossier du joueur : gardés dans ce navigateur seulement.
function lireSauvegarde() {
  try { return JSON.parse(localStorage.getItem(CLE)) || null; } catch { return null; }
}
function ecrireSauvegarde(donnees) {
  try { localStorage.setItem(CLE, JSON.stringify(donnees)); } catch { /* navigation privée : on joue sans mémoire */ }
}
let sauvegarde = lireSauvegarde();

function titre() { return TITRES[sauvegarde.profil.genre] || TITRES.n; }

function majDossier() {
  const { profil, parties } = sauvegarde;
  $("identite").textContent = ` / ${titre().toUpperCase()} ${profil.nom.toUpperCase()}`;
  const bienvenue = $("bienvenue");
  bienvenue.replaceChildren(parties.length ? "Bon retour, " : "Bienvenue, ", el("b", `${titre()} ${profil.nom}`), ".");
  const resolues = parties.filter((x) => x.correct).length, ratees = parties.length - resolues;
  let serie = 0;
  for (let i = parties.length - 1; i >= 0 && parties[i].correct; i--) serie++;
  const ratio = parties.length ? Math.round((resolues / parties.length) * 100) : 0;
  $("st-resolues").textContent = resolues; $("st-ratees").textContent = ratees;
  $("st-serie").textContent = serie;
  $("st-record").textContent = Math.max(0, ...parties.map((x) => x.score));
  $("st-ratio").textContent = ratio + " %";
  requestAnimationFrame(() => ($("jauge-ratio").style.width = ratio + "%"));
  $("historique").replaceChildren(...parties.slice(-6).reverse().map((x) => {
    const li = el("li");
    li.append(el("span", x.sujet), el("span", x.correct ? "Résolue" : x.temps ? "Temps écoulé" : "Ratée", x.correct ? "ok" : "ko"),
      el("span", String(x.score)));
    return li;
  }));
  $("dossier").hidden = false;
}

function enregistrerProfil(evenement) {
  evenement.preventDefault();
  const nom = $("nom-code").value.trim().slice(0, 24);
  const genre = new FormData($("form-profil")).get("genre");
  if (!nom || !genre) return;
  sauvegarde = { profil: { nom, genre }, parties: sauvegarde?.parties || [] };
  ecrireSauvegarde(sauvegarde);
  majDossier(); afficher("accueil");
}

async function api(route, corps) {
  const reponse = await fetch("/api/" + route, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps || {}),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Erreur");
  return donnees;
}

function el(balise, contenu, classe) {
  const noeud = document.createElement(balise);
  if (contenu !== undefined) noeud.textContent = contenu;
  if (classe) noeud.className = classe;
  return noeud;
}

function afficher(section) {
  for (const id of ["profil", "accueil", "partie", "fin"]) $(id).hidden = id !== section;
  window.scrollTo(0, 0);
}

const numeroAleatoire = () =>
  "N° " + String(Math.floor(Math.random() * 9000) + 1000) + "-" + String(Math.floor(Math.random() * 90) + 10);
const heureEnMinutes = (h) => { const [a, b] = h.split(":").map(Number); return a * 60 + b; };
const heureLisible = (h) => h.replace(":", " h ");

async function commencer() {
  $("commencer").disabled = true; $("rejouer").disabled = true;
  $("erreur").hidden = true; $("attente").hidden = false;
  majDossier(); afficher("accueil");
  try {
    partie = await api("enquete");
  } catch (e) {
    $("erreur").textContent = "Le signal s'est perdu (" + e.message + "). Réessaie.";
    $("erreur").hidden = false;
    return;
  } finally {
    $("commencer").disabled = false; $("rejouer").disabled = false; $("attente").hidden = true;
  }
  restant = DUREE; viePrivee = 100; ouverts = []; fils = {}; enLigne = null;
  $("numero").textContent = numeroAleatoire();
  $("nom").textContent = partie.person.name;
  $("details").textContent = `${partie.person.age} ans · ${partie.person.job} · ${partie.person.district}`;
  dessinerFrise(); dessinerJournal(); dessinerPersonnes(); majExposition();
  $("appel").hidden = true;
  afficher("partie");
  $("chrono").hidden = false; tic();
  clearInterval(minuteur); minuteur = setInterval(tic, 1000);
}

function dessinerFrise() {
  const frise = $("frise");
  frise.replaceChildren();
  for (const [type, nom] of COULOIRS) {
    const indices = partie.clues.filter((c) => c.type === type);
    if (!indices.length) continue;
    const couloir = el("div", undefined, "couloir");
    for (const [debut, fin] of [[0, 6], [21, 24]]) {
      const zone = el("div", undefined, "nuit-zone");
      zone.style.left = (debut / 24) * 100 + "%"; zone.style.width = ((fin - debut) / 24) * 100 + "%";
      couloir.append(zone);
    }
    for (const indice of indices) {
      const repere = el("button", undefined, "repere");
      repere.style.left = (heureEnMinutes(indice.time) / 1440) * 100 + "%";
      repere.title = `${nom}, ${heureLisible(indice.time)}`;
      repere.setAttribute("aria-label", repere.title);
      repere.onclick = () => ouvrir(indice, repere);
      couloir.append(repere);
    }
    frise.append(el("div", nom, "couloir-nom"), couloir);
  }
  const graduations = el("div", undefined, "graduations");
  for (const h of [0, 6, 12, 18, 24]) {
    const g = el("span", String(h).padStart(2, "0") + " h");
    g.style.left = (h / 24) * 100 + "%";
    graduations.append(g);
  }
  frise.append(el("div"), graduations);
}

function ouvrir(indice, repere) {
  document.querySelectorAll(".repere.actif").forEach((r) => r.classList.remove("actif"));
  repere.classList.add("ouvert", "actif");
  if (!ouverts.includes(indice.id)) {
    ouverts.push(indice.id);
    viePrivee = Math.max(0, viePrivee - COUT_FICHIER); majExposition();
  }
  dessinerJournal(indice.id);
}

function dessinerJournal(nouveau) {
  const parId = Object.fromEntries(partie.clues.map((c) => [c.id, c]));
  const lignes = ouverts.map((id) => parId[id])
    .sort((a, b) => heureEnMinutes(a.time) - heureEnMinutes(b.time))
    .map((c) => {
      const li = el("li", undefined, c.id === nouveau ? "nouveau" : "");
      li.append(el("span", `${heureLisible(c.time)} · ${LIBELLES[c.type]}`, "entete"), el("span", c.text));
      return li;
    });
  $("journal").replaceChildren(...(lignes.length ? lignes : [el("li", "Aucun fichier ouvert.", "vide")]));
}

function majExposition() {
  $("pourcentage").textContent = viePrivee + " %";
  const pleins = Math.ceil(viePrivee / 10);
  $("segments").replaceChildren(...Array.from({ length: 10 }, (_, i) => el("span", undefined, i < pleins ? "" : "perdu")));
}

function dessinerPersonnes() {
  $("personnes").replaceChildren(...partie.people.map((personne) => {
    const li = el("li");
    li.dataset.id = personne.id;
    const identite = el("div");
    identite.append(el("strong", personne.name), el("small", personne.relation));
    const bouton = el("button", "Appeler");
    bouton.onclick = () => appeler(personne);
    li.append(identite, bouton);
    return li;
  }));
}

function appeler(personne) {
  enLigne = personne; fils[personne.id] ||= [];
  document.querySelectorAll(".personnes li").forEach((li) => li.classList.toggle("en-ligne", li.dataset.id === personne.id));
  $("interlocuteur").textContent = personne.name; $("appel").hidden = false;
  dessinerFil(); $("texte").focus();
}

function dessinerFil() {
  $("fil").replaceChildren(...fils[enLigne.id].map((m) => {
    const p = el("p", undefined, m.role === "user" ? "joueur" : "");
    p.append(el("span", (m.role === "user" ? "TOI" : enLigne.name.toUpperCase()) + " : ", "qui"), m.content);
    return p;
  }));
  $("fil").scrollTop = $("fil").scrollHeight;
}

async function poser(evenement) {
  evenement.preventDefault();
  const question = $("texte").value.trim();
  if (!question || !enLigne) return;
  const personne = enLigne, fil = fils[personne.id];
  fil.push({ role: "user", content: question }); $("texte").value = ""; dessinerFil();
  try {
    const { reponse } = await api("interroger", { id: partie.id, personne: personne.id, historique: fil });
    fil.push({ role: "assistant", content: reponse });
  } catch (e) {
    fil.push({ role: "assistant", content: "(la ligne a coupé)" });
  }
  if (enLigne === personne) dessinerFil();
}

function tic() {
  const m = String(Math.floor(restant / 60)).padStart(2, "0"), s = String(restant % 60).padStart(2, "0");
  $("chrono").textContent = `${m}:${s}`;
  $("chrono").classList.toggle("urgent", restant <= 30);
  if (restant-- <= 0) trancher(null);
}

async function trancher(verdict) {
  clearInterval(minuteur); $("chrono").hidden = true;
  const r = await api("verdict", { id: partie.id, verdict });
  const nom = partie.person.name;
  $("resultat").textContent = verdict === null ? "Temps écoulé" : r.correct ? "Juste" : "Erreur";
  $("resultat").className = "tampon" + (r.correct ? "" : " rate");
  $("verite").textContent = r.truth.verdict === "victim" ? `${nom} était la victime.` : `${nom} était coupable.`;
  $("pourquoi").textContent = r.truth.what_happens + " " + r.explanation;
  const parId = Object.fromEntries(partie.clues.map((c) => [c.id, c]));
  $("decisifs").replaceChildren(...r.decisive.map((id) => {
    const c = parId[id], vu = ouverts.includes(id), li = el("li");
    li.append(el("span", `${vu ? "Vu" : "Manqué"} · ${heureLisible(c.time)} · ${LIBELLES[c.type]}`, "entete" + (vu ? "" : " manque")), el("span", c.text));
    return li;
  }));
  $("menteurs").replaceChildren(...r.liars.map((l) => {
    const li = el("li");
    const preuves = l.contradicted_by.map((id) => `${LIBELLES[parId[id].type]} de ${heureLisible(parId[id].time)}`).join(", ");
    li.append(el("span", l.name, "entete"), el("span", `« ${l.lie} » Démenti par : ${preuves}.`));
    return li;
  }));
  const score = r.correct ? Math.round(500 + Math.max(restant, 0) * 2 + viePrivee * 3) : 0;
  $("score").textContent = `Score ${score} · ${ouverts.length} fichier${ouverts.length > 1 ? "s" : ""} ouvert${ouverts.length > 1 ? "s" : ""} · vie privée restante ${viePrivee} %`;
  sauvegarde.parties.push({ sujet: nom, correct: r.correct, temps: verdict === null, score, date: Date.now() });
  sauvegarde.parties = sauvegarde.parties.slice(-200);
  ecrireSauvegarde(sauvegarde);
  afficher("fin");
}

$("numero-accueil").textContent = numeroAleatoire();
$("form-profil").onsubmit = enregistrerProfil;
$("changer").onclick = () => { $("nom-code").value = sauvegarde.profil.nom; afficher("profil"); };
if (sauvegarde?.profil) { majDossier(); afficher("accueil"); } else afficher("profil");
$("commencer").onclick = commencer;
$("rejouer").onclick = commencer;
$("question").onsubmit = poser;
document.querySelectorAll("[data-verdict]").forEach((b) => (b.onclick = () => trancher(b.dataset.verdict)));
