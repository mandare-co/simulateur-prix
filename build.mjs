import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

const root = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const VERSION = pkg.version;
const MAJOR = "v" + VERSION.split(".")[0];

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");

const outDir = join(root, "dist");
const versionDir = join(outDir, VERSION);
const majorDir = join(outDir, MAJOR);
const outFile = join(versionDir, "simulateur.js");

const cssMinifie = {
  name: "css-minifie",
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const source = readFileSync(args.path, "utf8");
      const { code } = await esbuild.transform(source, { loader: "css", minify: true });
      return { contents: code, loader: "text" };
    });
  }
};

const options = {
  entryPoints: [join(root, "src/index.js")],
  outfile: outFile,
  bundle: true,
  format: "iife",
  target: ["es2019"],
  minify: true,
  sourcemap: false,
  legalComments: "none",
  loader: { ".css": "text" },
  plugins: [cssMinifie],
  define: { __VERSION__: JSON.stringify(VERSION) },
  logLevel: "info"
};

function writeHeaders() {
  const content = [
    "/*",
    "  Access-Control-Allow-Origin: *",
    "  X-Content-Type-Options: nosniff",
    "",
    `/${MAJOR}/*`,
    "  Cache-Control: public, max-age=300, s-maxage=86400, stale-while-revalidate=604800",
    "",
    `/${VERSION}/*`,
    "  Cache-Control: public, max-age=31536000, immutable",
    ""
  ].join("\n");
  writeFileSync(join(outDir, "_headers"), content);
}

function copieAtomique(source, destination) {
  const temporaire = destination + ".tmp";
  cpSync(source, temporaire);
  renameSync(temporaire, destination);
}

function publish() {
  mkdirSync(majorDir, { recursive: true });
  copieAtomique(join(versionDir, "simulateur.js"), join(majorDir, "simulateur.js"));
  if (existsSync(join(versionDir, "simulateur.js.map"))) {
    copieAtomique(join(versionDir, "simulateur.js.map"), join(majorDir, "simulateur.js.map"));
  }

  const demo = join(root, "dev/index.html");
  if (existsSync(demo)) {
    writeFileSync(
      join(outDir, "index.html"),
      readFileSync(demo, "utf8").replace("../dist/v1/simulateur.js", `./${MAJOR}/simulateur.js`)
    );
  }

  writeHeaders();
  writeFileSync(join(outDir, ".nojekyll"), "");

  const size = readFileSync(outFile).length;
  console.log(`→ dist/${VERSION}/simulateur.js et dist/${MAJOR}/simulateur.js (${(size / 1024).toFixed(1)} Ko)`);
}

if (watch) {
  const ctx = await esbuild.context({
    ...options,
    minify: false,
    sourcemap: "inline",
    plugins: [cssMinifie, {
      name: "publish",
      setup(build) {
        build.onEnd((result) => {
          if (result.errors.length === 0) publish();
        });
      }
    }]
  });
  await ctx.watch();
  if (serve) {
    const { host, port } = await ctx.serve({ servedir: root, port: 5173 });
    console.log(`Dev : http://${host === "0.0.0.0" ? "localhost" : host}:${port}/dev/`);
  }
} else {
  rmSync(outDir, { recursive: true, force: true });
  await esbuild.build(options);
  publish();
}
