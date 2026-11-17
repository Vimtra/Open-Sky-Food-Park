// Copies the shared contract assets into the Flutter app. Run after the catalog or photos change:
//   node tool/sync-shared.mjs
//   shared/seed/catalog.json -> assets/data/catalog.json   (demo-mode data)
//   every image the catalog references (img/...) -> assets/img/...
// Only referenced images are copied, so the APK carries no unused files.
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mobile = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = resolve(mobile, "../shared");
if (!existsSync(shared)) {
  console.warn("sync-shared: ../shared not found, keeping the copies already in mobile/");
  process.exit(0);
}

const catalogPath = resolve(shared, "seed/catalog.json");
const catalog = JSON.parse(readFileSync(catalogPath, "utf8"));
mkdirSync(resolve(mobile, "assets/data"), { recursive: true });
copyFileSync(catalogPath, resolve(mobile, "assets/data/catalog.json"));

const urls = new Set();
const add = (u) => u && u.startsWith("img/") && urls.add(u);
add(catalog.park.logo_url);
catalog.stalls.forEach((s) => (add(s.logo_url), add(s.cover_url)));
catalog.menu_items.forEach((m) => add(m.image_url));
catalog.cravings.forEach((c) => add(c.image_url));
catalog.banners.forEach((b) => add(b.image_url));

rmSync(resolve(mobile, "assets/img"), { recursive: true, force: true });
let missing = 0;
for (const url of urls) {
  const from = resolve(shared, url);
  if (!existsSync(from)) {
    console.warn(`sync-shared: missing ${url}`);
    missing++;
    continue;
  }
  const to = resolve(mobile, "assets", url);
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}
console.log(`sync-shared: catalog.json and ${urls.size - missing} images copied from ../shared`);
