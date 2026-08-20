import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const bundle = join(root, "dist", "v1", "simulateur.js");

const FORMULAIRE = `
  <form data-mandare-simulateur-form>
    <input type="hidden" name="sim_total">
    <input type="hidden" name="sim_structures">
    <input type="hidden" name="sim_actuel">
    <input type="hidden" name="sim_ecart">
    <input type="hidden" name="sim_recap">
  </form>`;

async function page(corps, url = "https://www.mandare.co/tarifs") {
  assert.ok(existsSync(bundle), "dist/v1/simulateur.js absent : lance `npm run build`");
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${corps}</body></html>`, {
    runScripts: "outside-only",
    pretendToBeVisual: true,
    url
  });
  await new Promise((resolve) => {
    if (dom.window.document.readyState === "complete") resolve();
    else dom.window.addEventListener("load", resolve, { once: true });
  });
  dom.window.eval(readFileSync(bundle, "utf8"));
  const champ = (nom) => dom.window.document.querySelector(`[name="${nom}"]`).value;
  return { fenetre: dom.window, champ };
}

test("un formulaire posé près du simulateur suit la saisie", async () => {
  const { fenetre, champ } = await page(`<div data-mandare-simulateur></div>${FORMULAIRE}`);

  assert.equal(champ("sim_total"), "40", "le total de départ doit être repris");
  assert.equal(champ("sim_structures"), "1");
  assert.match(champ("sim_recap"), /Total Mandare/, "le récapitulatif doit être lisible");

  const sim = fenetre.MandareSimulateur.instances[0];
  sim.allerA(1);
  const carte = [...fenetre.document.querySelectorAll('[data-group="acc"]')]
    .find((b) => b.dataset.id === "essentiel");
  carte.dispatchEvent(new fenetre.MouseEvent("click", { bubbles: true }));

  assert.equal(champ("sim_total"), "120", "le champ doit refléter le nouveau total");
  assert.match(champ("sim_recap"), /Essentiel/);
});

test("sur la page d'arrivée, les champs se remplissent depuis l'URL", async () => {
  const url = "https://www.mandare.co/demo/rencontre"
    + "?sim_total=295&sim_structures=2&sim_actuel=900&sim_ecart=605"
    + "&sim_recap=" + encodeURIComponent("- Société : Comptabilité — 295 € HT/mois");

  const { champ } = await page(FORMULAIRE, url);

  assert.equal(champ("sim_total"), "295");
  assert.equal(champ("sim_structures"), "2");
  assert.equal(champ("sim_actuel"), "900");
  assert.equal(champ("sim_ecart"), "605");
  assert.equal(champ("sim_recap"), "- Société : Comptabilité — 295 € HT/mois");
});

test("sans simulation dans l'URL, les champs restent vides", async () => {
  const { champ } = await page(FORMULAIRE);
  assert.equal(champ("sim_total"), "");
  assert.equal(champ("sim_recap"), "");
});

test("l'URL du CTA emporte la simulation", async () => {
  const { fenetre } = await page(`<div data-mandare-simulateur></div>`);
  const sim = fenetre.MandareSimulateur.instances[0];
  const url = new fenetre.URL(sim.urlCta());

  assert.equal(url.origin + url.pathname, "https://www.mandare.co/demo/rencontre");
  assert.equal(url.searchParams.get("sim_total"), "40");
  assert.ok(url.searchParams.get("sim_recap").includes("Total Mandare"));
});
