// Copies what the iOS app bundles from the shared contract. Run after the menu or photos change:
//   node tool/sync-shared.mjs
//   shared/seed/catalog.json          -> assets/data/catalog.json
//   every image the catalog refers to  -> assets/img/...
//   logo (transparent) and park photo  -> assets/brand/, assets/hero/
// Owner: Claude A (ios_app/). Never edits ../shared or ../mobile.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "..");
const shared = resolve(root, "shared");
if (!existsSync(shared)) {
  console.warn("sync-shared: ../shared not found, keeping the copies already in ios_app/");
  process.exit(0);
}

const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

const catalogPath = resolve(shared, "seed/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
copy(catalogPath, resolve(app, "assets/data/catalog.json"));

const urls = new Set();
const add = (u) => u && u.startsWith("img/") && urls.add(u);
add(catalog.park.logo_url);
catalog.stalls.forEach((s) => (add(s.logo_url), add(s.cover_url)));
catalog.menu_items.forEach((m) => add(m.image_url));
catalog.cravings.forEach((c) => add(c.image_url));
catalog.banners.forEach((b) => add(b.image_url));

rmSync(resolve(app, "assets/img"), { recursive: true, force: true });
let missing = 0;
for (const u of urls) {
  const from = resolve(shared, u);
  if (!existsSync(from)) {
    missing += 1;
    continue;
  }
  copy(from, resolve(app, "assets", u));
}

// Brand and hero art. The transparent logo renders come from the Android app's assets; the
// park photo from the website. Both are copied, never linked, so each app stays self-contained.
const extras = [
  ["mobile/assets/brand/logo-full.png", "assets/brand/logo-full.png"],
  ["mobile/assets/brand/logo-compact.png", "assets/brand/logo-compact.png"],
  ["web/public/hero/park-night-1280.jpg", "assets/hero/park-night.jpg"],
];
for (const [from, to] of extras) {
  if (existsSync(resolve(root, from))) copy(resolve(root, from), resolve(app, to));
  else if (!existsSync(resolve(app, to))) console.warn(`sync-shared: ${from} not found`);
}

console.log(`sync-shared: catalog + ${urls.size - missing} images${missing ? ` (${missing} missing)` : ""}`);
