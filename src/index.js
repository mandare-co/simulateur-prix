import styles from "./styles.css";
import { CONFIG, mergeConfig } from "./config.js";
import { createSimulateur } from "./app.js";

const SELECTOR = "[data-mandare-simulateur], #mandare-simulateur";
const STYLE_ID = "mandare-simulateur-styles";
const MOUNTED = "mandareSimulateurMounted";

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const tag = document.createElement("style");
  tag.id = STYLE_ID;
  tag.textContent = styles;
  document.head.appendChild(tag);
}

function configFromDataset(node) {
  const d = node.dataset;
  const out = {};
  if (d.ctaUrl) out.ctaUrl = d.ctaUrl;
  if (d.ctaTexte) out.ctaTexte = d.ctaTexte;
  if (d.config) {
    try {
      Object.assign(out, JSON.parse(d.config));
    } catch (err) {
      console.warn("[simulateur] data-config illisible :", err);
    }
  }
  return out;
}

const instances = [];

function mount(node, overrides) {
  if (!node || node[MOUNTED]) return null;
  node[MOUNTED] = true;
  injectStyles();
  const config = mergeConfig(window.MANDARE_SIMULATEUR_CONFIG, configFromDataset(node), overrides);
  try {
    const instance = createSimulateur(node, config);
    instances.push(instance);
    return instance;
  } catch (err) {
    node[MOUNTED] = false;
    console.error("[simulateur] échec du montage :", err);
    return null;
  }
}

function mountAll(root = document) {
  return Array.from(root.querySelectorAll(SELECTOR)).map((node) => mount(node)).filter(Boolean);
}

function autoMount() {
  mountAll();
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.addedNodes) {
        if (node.nodeType !== 1) continue;
        if (node.matches && node.matches(SELECTOR)) mount(node);
        else if (node.querySelector) mountAll(node);
      }
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", autoMount, { once: true });
} else {
  autoMount();
}

const api = {
  version: __VERSION__,
  defaults: CONFIG,
  mount,
  mountAll,
  instances
};

window.MandareSimulateur = api;

export default api;
