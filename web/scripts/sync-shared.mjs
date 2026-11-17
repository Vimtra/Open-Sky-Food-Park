// Copies the shared contract assets into the web app. Runs before `dev` and `build`.
//   shared/seed/catalog.json -> src/data/catalog.json   (demo-mode data)
//   shared/img/**            -> public/img/**            (dish, stall and logo images)
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const web = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shared = resolve(web, "../shared");

if (!existsSync(shared)) {
  console.warn("sync-shared: ../shared not found, keeping the copies already in web/");
  process.exit(0);
}

mkdirSync(resolve(web, "src/data"), { recursive: true });
cpSync(resolve(shared, "seed/catalog.json"), resolve(web, "src/data/catalog.json"));
cpSync(resolve(shared, "img"), resolve(web, "public/img"), { recursive: true });
console.log("sync-shared: catalog.json and img/ copied from ../shared");
