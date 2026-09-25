// Le Numéro : un bureau, un ordinateur, et le système « Veille » avec ses fenêtres.
// Ouvrir un fichier coûte de la vie privée au sujet ; appeler un proche coûte du temps.
const $ = (id) => document.getElementById(id);
const DUREE = 180;
const COUT_FICHIER = 12;
const CLE = "le-numero.v1";
const TITRES = { m: "opérateur", f: "opératrice", n: "analyste" };
const TYPES = {
  sms: { nom: "Message", icone: "message" }, mail: { nom: "Mail", icone: "mail" },
  appel: { nom: "Appel", icone: "telephone" }, banque: { nom: "Banque", icone: "banque" },
  camera: { nom: "Caméra", icone: "camera" }, position: { nom: "Position", icone: "position" },
};
const TRAIT = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
const ICONES = {
  dossier: `<svg viewBox="0 0 24 24" ${TRAIT}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.6 4-5.2 7-5.2s5.8 1.6 7 5.2"/></svg>`,
  fichiers: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v8.3a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/></svg>`,
  ecoute: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M4 13v-1a8 8 0 0 1 16 0v1"/><rect x="3" y="13" width="4" height="7" rx="1.5"/><rect x="17" y="13" width="4" height="7" rx="1.5"/></svg>`,
  verdict: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M12 3v18M5 7h14M7 7l-3 7a3.2 3.2 0 0 0 6 0zM17 7l-3 7a3.2 3.2 0 0 0 6 0z"/></svg>`,
  message: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M4 5h16v11H9l-5 4z"/></svg>`,
  mail: `<svg viewBox="0 0 24 24" ${TRAIT}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></svg>`,
  telephone: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M6.5 3.5h3l1.5 4-2 1.3a11 11 0 0 0 6.2 6.2l1.3-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/></svg>`,
  banque: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3.5 20h17"/></svg>`,
  camera: `<svg viewBox="0 0 24 24" ${TRAIT}><rect x="3" y="7" width="13" height="10" rx="2"/><path d="m16 11 5-3v8l-5-3"/></svg>`,
  position: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>`,
  fermer: `<svg viewBox="0 0 24 24" ${TRAIT}><path d="M7 7l10 10M17 7 7 17"/></svg>`,
  operateur: `<svg viewBox="0 0 24 24" ${TRAIT}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></svg>`,
};

let partie = null, restant = DUREE, minuteur = null, viePrivee = 100, ouverts = [];
let fils = {}, enLigne = null, pileZ = 10, cascade = 0;

// ---------- Outils ----------
function el(balise, contenu, classe) {
  const noeud = document.createElement(balise);
  if (contenu !== undefined && contenu !== null) noeud.textContent = contenu;
  if (classe) noeud.className = classe;
  return noeud;
}
function icone(nom) {
  const span = el("span", undefined, "icone");
  span.innerHTML = ICONES[nom] || "";
  return span;
}
const heureEnMinutes = (h) => { const [a, b] = String(h).split(":").map(Number); return a * 60 + b; };
const heureLisible = (h) => String(h).replace(":", " h ");
const initiales = (nom) => nom.split(/\s+/).map((m) => m[0]).slice(0, 2).join("").toUpperCase();
const petitEcran = () => matchMedia("(max-width: 820px)").matches;
const hasard = (graine) => () => ((graine = (graine * 16807) % 2147483647) / 2147483647);

async function api(route, corps) {
  const reponse = await fetch("/api/" + route, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps || {}),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Erreur");
  return donnees;
}

// ---------- Sauvegarde du joueur (ce navigateur seulement) ----------
function lireSauvegarde() { try { return JSON.parse(localStorage.getItem(CLE)) || null; } catch { return null; } }
function ecrireSauvegarde() { try { localStorage.setItem(CLE, JSON.stringify(sauvegarde)); } catch { /* navigation privée */ } }
let sauvegarde = lireSauvegarde();
const titre = () => TITRES[sauvegarde?.profil?.genre] || TITRES.n;

// ---------- Fond d'écran : une ville imaginaire vue d'en haut ----------
function dessinerCarte(cible) {
  const svg = $("carte"), W = 1600, H = 1000, alea = hasard(424242);
  svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  let traces = `<path class="fleuve" d="M-50 720 C 300 640, 520 820, 820 700 S 1300 560, 1700 640"/>`;
  for (let x = 40; x < W; x += 38 + alea() * 50) {
    const d = (alea() - .5) * 60;
    traces += `<path class="${alea() > .88 ? "axe" : "rue"}" d="M${x} -10 C ${x + d} 300, ${x - d} 700, ${x + d / 2} ${H + 10}"/>`;
  }
  for (let y = 30; y < H; y += 34 + alea() * 46) {
    const d = (alea() - .5) * 50;
    traces += `<path class="${alea() > .88 ? "axe" : "rue"}" d="M-10 ${y} C 500 ${y + d}, 1100 ${y - d}, ${W + 10} ${y + d / 3}"/>`;
  }
  if (cible) {
    traces += `<circle class="onde" cx="${cible.x}" cy="${cible.y}" r="14" stroke-width="2"/>`;
    traces += `<circle class="cible" cx="${cible.x}" cy="${cible.y}" r="6"/>`;
  }
  svg.innerHTML = traces;
}

// ---------- Gestionnaire de fenêtres ----------
const fenetres = new Map();

function ouvrirFenetre(cle, { titre: nomFenetre, icone: nomIcone, corps, x, y, largeur }) {
  let fenetre = fenetres.get(cle);
  if (!fenetre) {
    fenetre = el("section", undefined, "fenetre");
    fenetre.dataset.cle = cle;
    const barre = el("div", undefined, "fenetre-titre");
    const fermer = el("button", undefined, "fermer");
    fermer.setAttribute("aria-label", "Fermer");
    fermer.append(icone("fermer"));
    fermer.onclick = (e) => { e.stopPropagation(); fermerFenetre(cle); };
    barre.append(icone(nomIcone), el("strong", nomFenetre), fermer);
    fenetre.append(barre, el("div", undefined, "fenetre-corps"));
    fenetre.addEventListener("pointerdown", () => focaliser(cle));
    rendreDeplacable(fenetre, barre);
    const bureau = $("bureau").getBoundingClientRect();
    const l = Math.min(largeur || 420, bureau.width - 24);
    fenetre.style.width = l + "px";
    fenetre.style.left = Math.max(12, Math.min(x ?? (bureau.width - l) / 2, bureau.width - l - 12)) + "px";
    fenetre.style.top = Math.max(12, y ?? 40) + "px";
    $("bureau").append(fenetre);
    fenetres.set(cle, fenetre);
  } else {
    fenetre.querySelector(".fenetre-titre strong").textContent = nomFenetre;
  }
  if (corps) fenetre.querySelector(".fenetre-corps").replaceChildren(corps);
  focaliser(cle);
  return fenetre;
}

function fermerFenetre(cle) {
  const fenetre = fenetres.get(cle);
  if (!fenetre) return;
  fenetres.delete(cle);
  fenetre.classList.add("fermeture");
  setTimeout(() => fenetre.remove(), 160);
  const restantes = [...fenetres.keys()];
  if (restantes.length) focaliser(restantes[restantes.length - 1]);
  else majActive(null);
}

function toutFermer() { for (const cle of [...fenetres.keys()]) fermerFenetre(cle); }

function focaliser(cle) {
  const fenetre = fenetres.get(cle);
  if (!fenetre) return;
  for (const f of fenetres.values()) f.classList.toggle("focus", f === fenetre);
  fenetre.style.zIndex = ++pileZ;
  // Garde l'ordre d'ouverture à jour : la dernière focalisée passe en fin de liste.
  fenetres.delete(cle); fenetres.set(cle, fenetre);
  majActive(cle, fenetre.querySelector(".fenetre-titre strong").textContent);
}

function majActive(cle, nom) {
  $("app-active").textContent = nom || "Bureau";
  const app = cle && (cle.startsWith("f-") ? "fichiers" : cle);
  document.querySelectorAll(".dock button").forEach((b) => b.classList.toggle("actif", b.dataset.app === app));
}

function rendreDeplacable(fenetre, poignee) {
  poignee.addEventListener("pointerdown", (e) => {
    if (petitEcran() || e.target.closest("button")) return;
    const depart = { x: e.clientX, y: e.clientY, l: fenetre.offsetLeft, t: fenetre.offsetTop };
    const bureau = $("bureau").getBoundingClientRect();
    poignee.setPointerCapture(e.pointerId);
    const bouger = (m) => {
      fenetre.style.left = Math.min(Math.max(depart.l + m.clientX - depart.x, -fenetre.offsetWidth + 80), bureau.width - 80) + "px";
      fenetre.style.top = Math.min(Math.max(depart.t + m.clientY - depart.y, 0), bureau.height - 60) + "px";
    };
    poignee.addEventListener("pointermove", bouger);
    poignee.addEventListener("pointerup", () => poignee.removeEventListener("pointermove", bouger), { once: true });
  });
}

// ---------- Scène : le bureau, puis le zoom dans l'écran ----------
function entrer() {
  const scene = $("scene"), image = $("scene-image"), ecran = $("ecran-bureau").getBoundingClientRect();
  if (scene.classList.contains("entree")) return;
  const echelle = Math.max(innerWidth / ecran.width, innerHeight / ecran.height);
  const dx = innerWidth / 2 - (ecran.left + ecran.width / 2), dy = innerHeight / 2 - (ecran.top + ecran.height / 2);
  image.style.transform = `translate(-50%, -50%) translate(${dx}px, ${dy}px) scale(${echelle})`;
  scene.classList.add("entree");
  setTimeout(() => { $("os").hidden = false; dessinerCarte(); afficherVerrou(); }, 1150);
  setTimeout(() => { scene.hidden = true; }, 1400);
}

// ---------- Verrouillage : nom de code et genre ----------
function afficherVerrou(forcerNouveau) {
  const connu = sauvegarde?.profil && !forcerNouveau;
  $("verrou").hidden = false;
  $("champs-profil").hidden = connu;
  $("changer").hidden = !connu;
  $("avatar").textContent = connu ? initiales(sauvegarde.profil.nom) : "?";
  $("verrou-titre").textContent = connu ? `Bon retour, ${titre()} ${sauvegarde.profil.nom}.` : "Qui veille cette nuit ?";
  $("form-profil").querySelector(".principal").textContent = connu ? "Déverrouiller" : "Se connecter";
  $("erreur-profil").hidden = true;
  if (!connu) setTimeout(() => $("nom-code").focus(), 50);
}

function connexion(evenement) {
  evenement.preventDefault();
  if ($("champs-profil").hidden) return ouvrirSession();
  const nom = $("nom-code").value.trim().slice(0, 24);
  const genre = new FormData($("form-profil")).get("genre");
  if (!nom || !genre) {
    $("erreur-profil").textContent = !nom ? "Choisis un nom de code." : "Choisis opérateur, opératrice ou analyste.";
    $("erreur-profil").hidden = false;
    return;
  }
  sauvegarde = { profil: { nom, genre }, parties: sauvegarde?.parties || [] };
  ecrireSauvegarde();
  ouvrirSession();
}

function ouvrirSession() {
  $("verrou").hidden = true;
  $("m-operateur").textContent = `${titre()[0].toUpperCase()}${titre().slice(1)} ${sauvegarde.profil.nom}`;
  ouvrirAccueil();
}

// ---------- Application « Opérateur » : dossier du joueur et nouveau signal ----------
function ouvrirAccueil(message) {
  const { profil, parties } = sauvegarde;
  const corps = el("div", undefined, "accueil");
  const resolues = parties.filter((p) => p.correct).length;
  let serie = 0;
  for (let i = parties.length - 1; i >= 0 && parties[i].correct; i--) serie++;
  const ratio = parties.length ? Math.round((resolues / parties.length) * 100) : 0;
  corps.append(el("h2", "Un numéro vient de tomber."),
    el("p", message || "Cette nuit, quelqu'un dans cette ville sera mêlé à un drame. Victime ou coupable ? Tu as trois minutes.", "sous"));
  const stats = el("div", undefined, "stats");
  for (const [valeur, libelle] of [[resolues, "Résolues"], [parties.length - resolues, "Ratées"], [serie, "Série"],
    [Math.max(0, ...parties.map((p) => p.score)), "Record"]]) {
    const bloc = el("div"); bloc.append(el("b", String(valeur)), el("span", libelle)); stats.append(bloc);
  }
  const barre = el("div", undefined, "ratio"), piste = el("div", undefined, "piste"), jauge = el("span");
  piste.append(jauge); barre.append(el("span", "Taux de réussite"), piste, el("b", ratio + " %"));
  requestAnimationFrame(() => requestAnimationFrame(() => (jauge.style.width = ratio + "%")));
  const historique = el("ol", undefined, "historique");
  for (const p of parties.slice(-5).reverse()) {
    const li = el("li");
    li.append(el("span", p.sujet), el("span", p.correct ? "Résolue" : p.temps ? "Temps écoulé" : "Ratée", p.correct ? "ok" : "ko"), el("span", String(p.score)));
    historique.append(li);
  }
  const bouton = el("button", "Recevoir le signal", "bouton principal");
  bouton.onclick = () => commencer(bouton, corps);
  corps.append(stats, barre);
  if (parties.length) corps.append(historique);
  corps.append(bouton);
  ouvrirFenetre("operateur", { titre: `Opérateur · ${profil.nom}`, icone: "operateur", corps, largeur: 520, y: 70 });
}

async function commencer(bouton, corps) {
  bouton.disabled = true;
  const attente = el("p", undefined, "attente");
  attente.append(el("span", undefined, "roue"), "Recoupement des flux de la ville…");
  corps.append(attente);
  try {
    partie = await api("enquete");
  } catch (e) {
    attente.replaceChildren(el("span", `Le signal s'est perdu (${e.message}). Réessaie.`, "erreur"));
    bouton.disabled = false;
    return;
  }
  lancerPartie();
}

// ---------- Une partie ----------
function lancerPartie() {
  toutFermer();
  restant = DUREE; viePrivee = 100; ouverts = []; fils = {}; enLigne = null; cascade = 0;
  const alea = hasard(partie.person.name.length * 7919 + partie.clues.length);
  dessinerCarte({ x: 500 + alea() * 700, y: 250 + alea() * 450 });
  $("dock").hidden = false; $("m-vie").hidden = false; $("m-chrono").hidden = false;
  majVie();
  const W = $("bureau").clientWidth;
  ouvrirFenetre("dossier", { titre: "Dossier du sujet", icone: "dossier", corps: vueDossier(), x: 24, y: 24, largeur: 380 });
  ouvrirFenetre("fichiers", { titre: "Fichiers", icone: "fichiers", corps: vueFichiers(), x: Math.min(424, W - 400), y: 24, largeur: 380 });
  ouvrirFenetre("ecoute", { titre: "Écoute", icone: "ecoute", corps: vueEcoute(), x: W - 24 - 480, y: 64, largeur: 480 });
  focaliser("dossier");
  clearInterval(minuteur); tic(); minuteur = setInterval(tic, 1000);
}

function vueDossier() {
  const corps = el("div");
  const portrait = el("div", undefined, "portrait"), texte = el("div");
  texte.append(el("h2", partie.person.name), el("p", `${partie.person.age} ans · ${partie.person.job}`), el("p", partie.person.district));
  portrait.append(el("div", initiales(partie.person.name), "avatar"), texte);
  const menace = el("div", undefined, "menace"), entete = el("div", undefined, "menace-entete");
  entete.append(el("span", undefined, "point"), "Menace détectée · " + partie.threat.kind);
  menace.append(entete, el("p", partie.threat.briefing),
    el("small", `${partie.threat.place} · ${partie.threat.window.split("-").map(heureLisible).join(" à ")}`));
  corps.append(portrait, menace);
  return corps;
}

function vueFichiers() {
  const corps = el("div");
  const frise = el("div", undefined, "frise");
  const [debut, fin] = partie.threat.window.split("-").map(heureEnMinutes);
  if (!Number.isNaN(debut) && !Number.isNaN(fin)) {
    const zone = el("div", undefined, "fenetre-menace"), f = fin > debut ? fin : 1440;
    zone.style.left = (debut / 1440) * 100 + "%"; zone.style.width = ((f - debut) / 1440) * 100 + "%";
    frise.append(zone);
  }
  for (const c of partie.clues) {
    const tic = el("span", undefined, "tic" + (ouverts.includes(c.id) ? " vu" : ""));
    tic.style.left = (heureEnMinutes(c.time) / 1440) * 100 + "%";
    frise.append(tic);
  }
  const heures = el("div", undefined, "frise-heures");
  for (const h of ["0 h", "6 h", "12 h", "18 h", "24 h"]) heures.append(el("span", h));
  const liste = el("ul", undefined, "liste-fichiers");
  for (const c of partie.clues) {
    const vu = ouverts.includes(c.id), li = el("li"), bouton = el("button", undefined, vu ? "vu" : "");
    bouton.append(icone(TYPES[c.type]?.icone || "fichiers"), el("span", TYPES[c.type]?.nom || c.type),
      el("span", heureLisible(c.time), "heure"));
    bouton.lastChild.after(el("span", vu ? "Ouvert" : "Verrouillé", "etat"));
    bouton.style.gridTemplateColumns = "22px 1fr auto auto";
    bouton.onclick = () => ouvrirFichier(c);
    li.append(bouton); liste.append(li);
  }
  corps.append(frise, heures, liste, el("p", `Chaque fichier ouvert coûte ${COUT_FICHIER} % de vie privée au sujet.`, "cout"));
  return corps;
}

function ouvrirFichier(indice) {
  if (!ouverts.includes(indice.id)) {
    ouverts.push(indice.id);
    viePrivee = Math.max(0, viePrivee - COUT_FICHIER); majVie();
    if (fenetres.has("fichiers")) ouvrirFenetre("fichiers", { titre: "Fichiers", icone: "fichiers", corps: vueFichiers() });
  }
  const W = $("bureau").clientWidth, H = $("bureau").clientHeight;
  cascade = (cascade + 1) % 6;
  ouvrirFenetre("f-" + indice.id, {
    titre: `${TYPES[indice.type]?.nom || "Fichier"} · ${heureLisible(indice.time)}`, icone: TYPES[indice.type]?.icone || "fichiers",
    // À droite de la liste des fichiers, pour ne jamais la recouvrir.
    corps: vueFichier(indice), largeur: 400, x: Math.min(820, W - 420) + cascade * 24, y: Math.min(H * .3, 240) + cascade * 24,
  });
}

function vueFichier(c) {
  const corps = el("div");
  if (c.type === "sms") {
    corps.append(el("div", `Aujourd'hui, ${heureLisible(c.time)}`, "bulle-entete"), el("div", c.text, "bulle"));
  } else if (c.type === "mail") {
    const mail = el("div", undefined, "mail"), dl = el("dl");
    dl.append(el("dt", "Reçu"), el("dd", `Aujourd'hui à ${heureLisible(c.time)}`), el("dt", "Compte"), el("dd", partie.person.name));
    mail.append(dl, el("p", c.text)); corps.append(mail);
  } else if (c.type === "banque") {
    const releve = el("div", undefined, "releve"), entete = el("div", undefined, "releve-banque");
    entete.append(el("span", "Relevé d'opérations"), el("span", "Aujourd'hui"));
    const ligne = el("div", undefined, "ligne"), montant = (c.text.match(/\d[\d\s. ]*(?:,\d+)?\s?€/) || [])[0];
    const texte = el("span", c.text);
    ligne.append(el("span", c.time), texte);
    releve.append(entete, ligne);
    if (montant) releve.append(Object.assign(el("p", "Montant : " + montant.trim(), "montant"), { style: "margin:12px 0 0" }));
    corps.append(releve);
  } else if (c.type === "camera") {
    const cam = el("div", undefined, "cam"), info = el("div", undefined, "cam-info");
    info.append(el("span", "CAM " + String(heureEnMinutes(c.time) % 17 + 1).padStart(2, "0")), el("span", c.time, "rec"));
    cam.append(info); corps.append(cam, el("p", c.text));
  } else if (c.type === "position") {
    const carte = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    carte.setAttribute("viewBox", "0 0 400 160"); carte.setAttribute("class", "mini-carte");
    let lignes = "";
    for (let x = 20; x < 400; x += 44) lignes += `<path d="M${x} 0 L${x + 14} 160" stroke="rgba(150,180,230,.16)"/>`;
    for (let y = 18; y < 160; y += 36) lignes += `<path d="M0 ${y} L400 ${y - 8}" stroke="rgba(150,180,230,.16)"/>`;
    lignes += `<circle cx="230" cy="78" r="26" fill="rgba(106,166,255,.15)"/><circle cx="230" cy="78" r="6" fill="#6aa6ff"/>`;
    carte.innerHTML = lignes;
    corps.append(carte, el("p", c.text));
  } else {
    const vue = el("div", undefined, "appel-vue"), rond = el("div", undefined, "rond");
    rond.append(icone("telephone")); vue.append(rond, el("p", c.text)); corps.append(vue);
  }
  return corps;
}

function vueEcoute() {
  const corps = el("div", undefined, "ecoute");
  const contacts = el("div", undefined, "contacts");
  for (const p of partie.people) {
    const bouton = el("button", undefined, enLigne?.id === p.id ? "actif" : "");
    bouton.append(el("strong", p.name), el("span", p.relation));
    bouton.onclick = () => { enLigne = p; fils[p.id] ||= []; ouvrirFenetre("ecoute", { titre: "Écoute · " + p.name, icone: "ecoute", corps: vueEcoute() }); $("question")?.focus(); };
    contacts.append(bouton);
  }
  const ligne = el("div", undefined, "ligne-ecoute"), fil = el("div", undefined, "fil");
  fil.id = "fil";
  if (!enLigne) fil.append(el("p", "Choisis quelqu'un à appeler. Ses réponses peuvent être fausses.", "vide"));
  else for (const m of fils[enLigne.id]) fil.append(el("div", m.content, "msg " + (m.role === "user" ? "toi" : "eux") + (m.attente ? " attente-msg" : "")));
  const saisie = el("form", undefined, "saisie"), champ = el("input");
  champ.id = "question"; champ.placeholder = enLigne ? `Parler à ${enLigne.name}…` : "Aucune ligne ouverte";
  champ.disabled = !enLigne; champ.autocomplete = "off";
  const envoyer = el("button", "Envoyer", "bouton"); envoyer.disabled = !enLigne;
  saisie.append(champ, envoyer);
  saisie.onsubmit = poser;
  ligne.append(fil, saisie);
  corps.append(contacts, ligne);
  requestAnimationFrame(() => (fil.scrollTop = fil.scrollHeight));
  return corps;
}

async function poser(evenement) {
  evenement.preventDefault();
  const question = $("question").value.trim();
  if (!question || !enLigne) return;
  const personne = enLigne, fil = fils[personne.id];
  fil.push({ role: "user", content: question });
  const attente = { role: "assistant", content: "…", attente: true };
  fil.push(attente);
  rafraichirEcoute();
  try {
    const { reponse } = await api("interroger", { id: partie.id, personne: personne.id, historique: fil.filter((m) => !m.attente) });
    Object.assign(attente, { content: reponse, attente: false });
  } catch {
    Object.assign(attente, { content: "(la ligne a coupé)", attente: false });
  }
  rafraichirEcoute();
}

function rafraichirEcoute() {
  if (fenetres.has("ecoute")) {
    ouvrirFenetre("ecoute", { titre: enLigne ? "Écoute · " + enLigne.name : "Écoute", icone: "ecoute", corps: vueEcoute() });
    $("question")?.focus();
  }
}

function vueVerdict() {
  const corps = el("div", undefined, "verdict"), choix = el("div", undefined, "choix");
  corps.append(el("p", `${partie.person.name} sera mêlé·e à « ${partie.threat.kind.toLowerCase()} ». De quel côté ?`));
  for (const [valeur, libelle] of [["victim", "Victime"], ["culprit", "Coupable"]]) {
    const b = el("button", libelle); b.onclick = () => trancher(valeur); choix.append(b);
  }
  corps.append(choix);
  return corps;
}

function majVie() {
  $("m-vie-texte").textContent = viePrivee + " %";
  $("m-vie-jauge").style.width = viePrivee + "%";
}

function tic() {
  const m = String(Math.floor(restant / 60)).padStart(2, "0"), s = String(restant % 60).padStart(2, "0");
  $("m-chrono").textContent = `${m}:${s}`;
  $("m-chrono").classList.toggle("urgent", restant <= 30);
  if (restant-- <= 0) trancher(null);
}

async function trancher(verdict) {
  if (!partie) return;
  clearInterval(minuteur);
  const r = await api("verdict", { id: partie.id, verdict });
  const nom = partie.person.name, parId = Object.fromEntries(partie.clues.map((c) => [c.id, c]));
  const score = r.correct ? Math.round(500 + Math.max(restant, 0) * 2 + viePrivee * 3) : 0;
  sauvegarde.parties.push({ sujet: nom, correct: r.correct, temps: verdict === null, score, date: Date.now() });
  sauvegarde.parties = sauvegarde.parties.slice(-200);
  ecrireSauvegarde();

  const corps = el("div", undefined, "rapport");
  corps.append(el("span", verdict === null ? "Temps écoulé" : r.correct ? "Juste" : "Erreur", "tampon" + (r.correct ? "" : " rate")),
    el("h2", r.truth.verdict === "victim" ? `${nom} était la victime.` : `${nom} était coupable.`),
    el("p", r.truth.what_happens + " " + r.explanation));
  const decisifs = el("ul");
  for (const id of r.decisive) {
    const c = parId[id], vu = ouverts.includes(id), li = el("li");
    li.append(el("b", `${vu ? "Vu" : "Manqué"} · ${TYPES[c.type]?.nom} de ${heureLisible(c.time)}. `, vu ? "ok" : "ko"), c.text);
    decisifs.append(li);
  }
  const menteurs = el("ul");
  for (const l of r.liars) {
    const li = el("li"), preuves = l.contradicted_by.map((id) => `${TYPES[parId[id].type]?.nom.toLowerCase()} de ${heureLisible(parId[id].time)}`).join(", ");
    li.append(el("b", l.name + " : "), `« ${l.lie} » Démenti par ${preuves}.`);
    menteurs.append(li);
  }
  const actions = el("div", undefined, "actions");
  const suivant = el("button", "Signal suivant", "bouton principal"), retour = el("button", "Mon dossier", "bouton");
  suivant.onclick = () => { partie = null; toutFermer(); ouvrirAccueil(); };
  retour.onclick = suivant.onclick;
  actions.append(suivant, retour);
  corps.append(el("h3", "Ce qu'il fallait voir"), decisifs, el("h3", "Qui a menti"), menteurs,
    el("p", `Score ${score} · ${ouverts.length} fichier${ouverts.length > 1 ? "s" : ""} ouvert${ouverts.length > 1 ? "s" : ""} · vie privée restante ${viePrivee} %`, "sous"),
    actions);
  partie = null;
  toutFermer();
  $("dock").hidden = true; $("m-vie").hidden = true; $("m-chrono").hidden = true;
  dessinerCarte();
  setTimeout(() => ouvrirFenetre("rapport", { titre: "Rapport d'enquête", icone: "verdict", corps, largeur: 560, y: 40 }), 170);
}

// ---------- Branchements ----------
document.querySelectorAll("[data-icone]").forEach((span) => (span.innerHTML = ICONES[span.dataset.icone]));
document.querySelectorAll(".dock button").forEach((bouton) => (bouton.onclick = () => {
  if (!partie) return;
  const app = bouton.dataset.app, W = $("bureau").clientWidth;
  if (app === "dossier") ouvrirFenetre("dossier", { titre: "Dossier du sujet", icone: "dossier", corps: vueDossier(), x: 24, y: 24, largeur: 380 });
  if (app === "fichiers") ouvrirFenetre("fichiers", { titre: "Fichiers", icone: "fichiers", corps: vueFichiers(), x: Math.min(424, W - 400), y: 24, largeur: 380 });
  if (app === "ecoute") ouvrirFenetre("ecoute", { titre: enLigne ? "Écoute · " + enLigne.name : "Écoute", icone: "ecoute", corps: vueEcoute(), x: W - 504, y: 64, largeur: 480 });
  if (app === "verdict") ouvrirFenetre("verdict", { titre: "Trancher", icone: "verdict", corps: vueVerdict(), largeur: 420, y: 120 });
}));
$("ecran-bureau").onclick = entrer;
$("form-profil").onsubmit = connexion;
$("changer").onclick = () => afficherVerrou(true);
// La même heure sur l'écran de la photo et sur l'écran de verrouillage : on passe de l'un à l'autre.
const heureActuelle = () => new Date().toTimeString().slice(0, 5);
$("ecran-heure").textContent = $("verrou-heure").textContent = heureActuelle();
setInterval(() => ($("ecran-heure").textContent = $("verrou-heure").textContent = heureActuelle()), 15000);
