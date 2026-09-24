// Une partie : ouvrir des fichiers coûte de la vie privée, appeler des proches coûte du temps.
const $ = (id) => document.getElementById(id);
const DUREE = 180;
const COUT_FICHIER = 12;
const LIBELLES = { sms: "Message", mail: "Email", banque: "Bank", camera: "Camera", appel: "Call log", position: "Location" };

let partie = null, restant = DUREE, minuteur = null, viePrivee = 100, ouverts = new Set();
let fils = {}, enLigne = null;

async function api(route, corps) {
  const reponse = await fetch("/api/" + route, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corps || {}),
  });
  const donnees = await reponse.json();
  if (!reponse.ok) throw new Error(donnees.erreur || "Error");
  return donnees;
}

function afficher(section) {
  for (const id of ["accueil", "partie", "fin"]) $(id).hidden = id !== section;
}

function texte(balise, contenu, classe) {
  const el = document.createElement(balise);
  el.textContent = contenu;
  if (classe) el.className = classe;
  return el;
}

async function commencer() {
  $("commencer").disabled = true; $("erreur").hidden = true;
  try {
    partie = await api("enquete");
  } catch (e) {
    $("erreur").textContent = e.message; $("erreur").hidden = false;
    $("commencer").disabled = false; return;
  }
  $("commencer").disabled = false;
  restant = DUREE; viePrivee = 100; ouverts = new Set(); fils = {}; enLigne = null;
  $("nom").textContent = partie.person.name;
  $("details").textContent = `${partie.person.age} · ${partie.person.job} · ${partie.person.district}`;
  $("indices").replaceChildren(...partie.clues.map(ligneIndice));
  $("personnes").replaceChildren(...partie.people.map(lignePersonne));
  $("appel").hidden = true; majJauge();
  afficher("partie");
  $("chrono").hidden = false; tic();
  clearInterval(minuteur); minuteur = setInterval(tic, 1000);
}

function ligneIndice(indice) {
  const li = document.createElement("li");
  li.className = "ferme";
  li.append(texte("span", `${indice.time} · ${LIBELLES[indice.type] || indice.type}`, "meta"), texte("span", "Open file"));
  li.onclick = () => {
    if (ouverts.has(indice.id)) return;
    ouverts.add(indice.id); viePrivee = Math.max(0, viePrivee - COUT_FICHIER); majJauge();
    li.className = ""; li.lastChild.textContent = indice.text;
  };
  return li;
}

function lignePersonne(personne) {
  const li = document.createElement("li");
  const bouton = texte("button", "Call", "secondaire");
  bouton.onclick = () => appeler(personne);
  li.append(texte("span", `${personne.name}, ${personne.relation}`), bouton);
  return li;
}

function appeler(personne) {
  enLigne = personne; fils[personne.id] ||= [];
  $("interlocuteur").textContent = personne.name; $("appel").hidden = false;
  dessinerFil(); $("texte").focus();
}

function dessinerFil() {
  $("fil").replaceChildren(...fils[enLigne.id].map((m) =>
    texte("p", (m.role === "user" ? "You: " : enLigne.name + ": ") + m.content, m.role === "user" ? "joueur" : "")));
}

async function poser(evenement) {
  evenement.preventDefault();
  const question = $("texte").value.trim();
  if (!question || !enLigne) return;
  const fil = fils[enLigne.id];
  fil.push({ role: "user", content: question }); $("texte").value = ""; dessinerFil();
  try {
    const { reponse } = await api("interroger", { id: partie.id, personne: enLigne.id, historique: fil });
    fil.push({ role: "assistant", content: reponse });
  } catch (e) {
    fil.push({ role: "assistant", content: "(the line went dead)" });
  }
  dessinerFil();
}

function tic() {
  const m = String(Math.floor(restant / 60)).padStart(2, "0"), s = String(restant % 60).padStart(2, "0");
  $("chrono").textContent = `${m}:${s}`;
  $("chrono").classList.toggle("urgent", restant <= 30);
  if (restant-- <= 0) trancher(null);
}

function majJauge() { $("vie-privee").style.width = viePrivee + "%"; }

async function trancher(verdict) {
  clearInterval(minuteur); $("chrono").hidden = true;
  const r = await api("verdict", { id: partie.id, verdict });
  $("resultat").textContent = verdict === null ? "Time's up" : r.correct ? "You were right" : "You were wrong";
  $("verite").textContent = r.truth.verdict === "victim" ? `${partie.person.name} was the victim.` : `${partie.person.name} was the culprit.`;
  $("pourquoi").textContent = r.truth.what_happens + " " + r.explanation;
  const parId = Object.fromEntries(partie.clues.map((c) => [c.id, c]));
  $("decisifs").replaceChildren(...r.decisive.map((id) =>
    texte("li", `${ouverts.has(id) ? "Opened" : "Missed"} · ${parId[id].time} ${parId[id].text}`)));
  $("menteurs").replaceChildren(...r.liars.map((l) =>
    texte("li", `${l.name} said "${l.lie}". The file that proves it: ${l.contradicted_by.map((id) => parId[id].time + " " + LIBELLES[parId[id].type]).join(", ")}.`)));
  const score = r.correct ? Math.round(500 + restant * 2 + viePrivee * 3) : 0;
  $("score").textContent = `Score ${score} · ${ouverts.size} files opened · privacy left ${viePrivee}%`;
  afficher("fin");
}

$("commencer").onclick = commencer;
$("rejouer").onclick = commencer;
$("question").onsubmit = poser;
document.querySelectorAll("[data-verdict]").forEach((b) => (b.onclick = () => trancher(b.dataset.verdict)));
