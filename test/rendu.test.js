import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "dist", "v1", "simulateur.js");

async function monter() {
  assert.ok(existsSync(bundle), "dist/v1/simulateur.js absent : lance `npm run build`");

  const dom = new JSDOM("<!doctype html><html><head></head><body><div data-mandare-simulateur></div></body></html>", {
    runScripts: "outside-only",
    pretendToBeVisual: true
  });

  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve, { once: true });
  });

  const sorties = [];
  for (const niveau of ["error", "warn"]) {
    dom.window.console[niveau] = (...args) => sorties.push(niveau + " : " + args.join(" "));
  }

  dom.window.eval(readFileSync(bundle, "utf8"));

  const sim = dom.window.document.querySelector("[data-mandare-simulateur]");
  return {
    fenetre: dom.window,
    sim,
    sorties,
    texte: () => sim.textContent.replace(/\s+/g, " ").trim(),
    bouton: (label) => [...sim.querySelectorAll("button")].find((b) => b.textContent.trim() === label),
    cliquer(cible) {
      assert.ok(cible, "élément introuvable");
      cible.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }));
    }
  };
}

function silencieux(page, etape) {
  assert.deepEqual(page.sorties, [], "console non vide " + etape);
}

test("le bundle se monte et expose son API", async () => {
  const page = await monter();
  silencieux(page, "au montage");

  const api = page.fenetre.MandareSimulateur;
  assert.ok(api, "window.MandareSimulateur absent");
  assert.equal(api.instances.length, 1, "le simulateur ne s'est pas monté");
  assert.match(api.version, /^\d+\.\d+\.\d+$/);
  assert.ok(page.fenetre.document.getElementById("mandare-simulateur-styles"), "styles non injectés");
});

test("la première étape rend ses structures", async () => {
  const page = await monter();
  const t = page.texte();
  assert.match(t, /Votre situation/);
  assert.match(t, /Sociétés/);
  assert.match(t, /Micro-entreprises/);
  silencieux(page, "étape 1");
});

test("le parcours complet se déroule sans erreur", async () => {
  const page = await monter();

  page.cliquer(page.bouton("Suivant"));
  assert.match(page.texte(), /PLATEFORME|Plateforme/, "l'étape société n'a pas rendu");
  assert.match(page.texte(), /Accompagnement/);
  silencieux(page, "à l'étape société");

  const essentiel = [...page.sim.querySelectorAll('[data-group="acc"]')]
    .find((b) => /Essentiel/.test(b.textContent));
  page.cliquer(essentiel);
  silencieux(page, "après le choix d'un accompagnement");

  assert.match(page.texte(), /Plateforme Comptabilité/, "détail du calcul absent");
  assert.match(page.texte(), /Accompagnement Essentiel/);

  for (let i = 0; i < 5; i++) {
    const suivant = page.bouton("Suivant");
    if (!suivant) break;
    page.cliquer(suivant);
  }
  silencieux(page, "en fin de parcours");
});

test("le total et le CTA suivent les choix", async () => {
  const page = await monter();
  const total = () => page.sim.querySelector('[data-el="total"]').textContent.trim();
  const cta = () => page.sim.querySelector('[data-el="cta"]');

  assert.equal(total(), "40", "plateforme Comptabilité par défaut");
  assert.equal(cta().getAttribute("aria-disabled"), "true", "CTA actif avant tout choix");

  page.cliquer(page.bouton("Suivant"));
  const essentiel = [...page.sim.querySelectorAll('[data-group="acc"]')]
    .find((b) => /Essentiel/.test(b.textContent));
  page.cliquer(essentiel);

  assert.equal(total(), "120", "40 + 80 attendus");
  assert.equal(cta().getAttribute("aria-disabled"), "false", "CTA toujours bloqué");
  assert.ok(cta().getAttribute("href"), "le CTA n'a pas d'URL");
  silencieux(page, "après le calcul");
});

test("hors paliers, le total est annoncé comme un plancher", async () => {
  const page = await monter();
  const prefixe = () => page.sim.querySelector('[data-el="totalPrefix"]');

  page.cliquer(page.bouton("Suivant"));
  const pilotage = [...page.sim.querySelectorAll('[data-group="app"]')]
    .find((b) => /Pilotage/.test(b.textContent));
  page.cliquer(pilotage);

  assert.equal(prefixe().hidden, true, "préfixe affiché dans les paliers");

  const curseur = page.sim.querySelector('[data-el="tx"], input[type="range"][data-el="tx"]')
    || [...page.sim.querySelectorAll('input[type="range"]')].pop();
  curseur.value = "10050";
  curseur.dispatchEvent(new page.fenetre.Event("input", { bubbles: true }));

  assert.equal(prefixe().hidden, false, "le total sur devis passe pour un prix ferme");
  assert.match(prefixe().textContent, /À partir de/);
  assert.match(page.texte(), /Sur devis/);
  silencieux(page, "sur devis");
});
