// Source of the seed catalog. Edit here, then run from the project root:
//   node shared/seed/build.mjs
// Writes shared/seed/catalog.json (demo mode in web + Flutter) and supabase/seed.sql.
//
// Everything below comes from the owner's artwork in Assets/. Nothing is invented
// except the prices listed in `placeholder_price_item_ids`: the PandemKodi Dhaba menu
// prints only one price (Fresh Live Pulka, $1.99) and the Desi Desserts menu prints
// none for Chocolate Chip Brownie. Replace those before going live.

import { DEFAULT_SERVES, descriptions } from "./descriptions.mjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\+/g, " ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const cents = (dollars) => Math.round(Number(dollars) * 100);

// Photoshoot-style photos (AI-generated stand-ins, owner to approve) live in shared/img/photo/<stall>/<slug>.jpg.
// When one exists it replaces the crop from the menu artwork; delete the file to fall back to the crop.
const photo = (stallId, slug) =>
  existsSync(resolve(root, "shared/img/photo", stallId, `${slug}.jpg`)) ? `img/photo/${stallId}/${slug}.jpg` : null;

// ---------------------------------------------------------------- park
const park = {
  id: 1,
  name: "Open Sky Food Park",
  tagline: "Food · Fun · Music · Live Screen",
  address: "200 Serra Way, Milpitas, CA",
  timezone: "America/Los_Angeles",
  instagram: "openskyfoodpark",
  logo_url: "img/brand/open-sky-logo-on-night.png", // new logo (Assets/Open Sky Food Park Logo-01.svg); white wordmark, use on dark grounds
  tax_percent: 0,
  service_fee_cents: 0,
  ordering_enabled: true,
  table_service_enabled: true,
  announcement: null,
  // Contact details the owner has not given yet. Fill them in the admin panel (Settings);
  // /contact and /help show them only when set.
  contact_email: null,
  contact_phone: null,
  hours_text: null,
};

// ---------------------------------------------------------------- cravings
// Each craving shows the photo of one representative dish when it exists, else the menu-art crop.
const cravings = [
  ["combos", "Pulka Combos", "img/pandemkodi-dhaba/fish-curry-combo.jpg", "pandemkodi-dhaba/fish-curry-with-fresh-live-pulka"],
  ["curries", "Curries", "img/pandemkodi-dhaba/nonveg-curries.jpg", "pandemkodi-dhaba/dhaba-chicken-curry"],
  ["appetizers", "Appetizers", "img/pandemkodi-dhaba/chicken-ghee-roast.jpg", "pandemkodi-dhaba/pandem-kodi-chicken-ghee-roast"],
  ["mandi", "Mandi", "img/pandemkodi-dhaba/mandi.jpg", "pandemkodi-dhaba/juicy-chicken-mandi"],
  ["pulav", "Pulav", "img/pandemkodi-dhaba/pulav.jpg", "pandemkodi-dhaba/pandem-kodi-spl-chicken-pulav"],
  ["egg-curries", "Egg Curries", "img/pandemkodi-dhaba/egg-curries.jpg", "pandemkodi-dhaba/boiled-egg-curry"],
  ["faloodas", "Faloodas", "img/desi-desserts/royal-falooda.jpg", "desi-desserts/royal-falooda"],
  ["shakes-lassi", "Shakes & Lassi", "img/desi-desserts/mango-lassi.jpg", "desi-desserts/mango-lassi"],
  ["desserts", "Desserts", "img/desi-desserts/gulab-jamun.jpg", "desi-desserts/gulab-jamun"],
].map(([slug, name, crop, dish], i) => ({ slug, name, image_url: photo(...dish.split("/")) ?? crop, sort_order: i + 1 }));

// ---------------------------------------------------------------- stalls
// Item tuple: [name, price in dollars, diet, options]
//   diet: "veg" | "egg" | "nonveg" | null (null = the menu does not say)
//   options: { img, desc, featured, placeholder }
const P = { placeholder: true }; // price not printed on the owner's menu

const PK = "img/pandemkodi-dhaba/";
const DD = "img/desi-desserts/";
const COMBO = "Curry + pulka combo";

const stallSources = [
  {
    slug: "pandemkodi-dhaba",
    name: "PandemKodi Dhaba",
    tagline: "Dhaba Style. Desi Flavours.",
    cuisines: ["Dhaba style", "Curries", "Mandi", "Pulav"],
    phone: "+1 (408) 786-4343",
    instagram: "pandemkodi_dhaba",
    logo_url: PK + "logo.jpg",
    cover_url: PK + "fish-curry-combo.jpg",
    is_veg_only: false,
    categories: [
      {
        name: "Curry + Pulka Combos",
        craving: "combos",
        items: [
          ["Fish Curry with Fresh Live Pulka", 15.99, "nonveg", { ...P, img: PK + "fish-curry-combo.jpg", desc: COMBO, featured: true }],
          ["Mutton Curry with Fresh Live Pulka", 17.99, "nonveg", { ...P, img: PK + "mutton-curry-combo.jpg", desc: COMBO, featured: true }],
          ["Dhaba Chicken Curry with Fresh Live Pulka", 14.99, "nonveg", { ...P, img: PK + "dhaba-chicken-curry-combo.jpg", desc: COMBO, featured: true }],
          ["Boiled Egg Curry with Fresh Live Pulka", 12.99, "egg", { ...P, img: PK + "egg-curry-combo.jpg", desc: "Egg curry + pulka combo", featured: true }],
          ["Paneer Butter Masala with Fresh Live Pulka", 13.99, "veg", { ...P, img: PK + "paneer-butter-masala-combo.jpg", desc: "Veg combo", featured: true }],
        ],
      },
      {
        name: "Veg Appetizers",
        craving: "appetizers",
        items: [
          ["Pepper Baby Corn Fry", 11.99, "veg", P],
          ["Dragon Paneer", 11.99, "veg", P],
          ["Kaaram Paneer", 11.99, "veg", P],
          ["Kaju Gobi", 11.99, "veg", P],
          ["Methi Paneer", 11.99, "veg", { ...P, img: PK + "veg-appetizers.jpg" }],
        ],
      },
      {
        name: "Non-Veg Appetizers",
        craving: "appetizers",
        items: [
          ["Pandem Kodi Chicken Ghee Roast", 13.99, "nonveg", { ...P, img: PK + "chicken-ghee-roast.jpg" }],
          ["Dragon Chicken", 13.99, "nonveg", P],
          ["Devil Chicken", 13.99, "nonveg", P],
          ["Shrimp 555", 14.99, "nonveg", P],
          ["Apollo Fish", 14.99, "nonveg", P],
          ["Fish Daniya", 14.99, "nonveg", P],
          ["Tandoori Chicken", 13.99, "nonveg", P],
        ],
      },
      {
        name: "Veg Curries",
        craving: "curries",
        items: [
          ["Kaju Tomato Curry", 12.99, "veg", P],
          ["Jeedipappu Koora", 12.99, "veg", P],
          ["Dhaba Style Paneer Curry", 12.99, "veg", P],
          ["Paneer Butter Masala", 12.99, "veg", { ...P, img: PK + "veg-curries.jpg" }],
          ["Paneer Tikka Masala", 12.99, "veg", P],
        ],
      },
      {
        name: "Non-Veg Curries",
        craving: "curries",
        items: [
          ["Dhaba Chicken Curry", 13.99, "nonveg", { ...P, img: PK + "nonveg-curries.jpg" }],
          ["Afghani Chicken Curry", 13.99, "nonveg", P],
          ["Butter Chicken Curry", 13.99, "nonveg", P],
          ["Chicken Tikka Masala", 13.99, "nonveg", P],
          ["Andhra Chicken Curry", 13.99, "nonveg", P],
          ["Prawns Curry", 15.99, "nonveg", P],
        ],
      },
      {
        name: "Egg Curries",
        craving: "egg-curries",
        items: [
          ["Egg Burji", 11.99, "egg", P],
          ["Egg Kheema Curry", 11.99, "egg", P],
          ["Boiled Egg Curry", 11.99, "egg", { ...P, img: PK + "egg-curries.jpg" }],
          ["Tomato Egg Curry", 11.99, "egg", P],
        ],
      },
      {
        name: "Fresh Live Pulka",
        craving: null,
        items: [["Fresh Live Pulka", 1.99, "veg", { img: PK + "pulka.jpg", desc: "Hot · Fresh · Soft. Priced each." }]],
      },
      {
        name: "Mandi",
        craving: "mandi",
        items: [
          ["Juicy Chicken Mandi", 16.99, "nonveg", { ...P, img: PK + "mandi.jpg" }],
          ["Pandem Kodi Spl Chicken Mandi", 18.99, "nonveg", P],
          ["Juicy Paneer Mandi", 15.99, "veg", P],
        ],
      },
      {
        name: "Pulav",
        craving: "pulav",
        items: [
          ["Pandem Kodi Spl Chicken Pulav", 15.99, "nonveg", { ...P, img: PK + "pulav.jpg" }],
          ["Chicken Ghee Roast Pulav", 15.99, "nonveg", P],
          ["Paneer Pulav", 13.99, "veg", P],
        ],
      },
    ],
  },
  {
    slug: "desi-desserts",
    name: "Desi Desserts",
    tagline: null,
    cuisines: ["Faloodas", "Shakes & Lassi", "Desserts"],
    phone: null,
    instagram: null,
    logo_url: DD + "logo.jpg",
    cover_url: DD + "cover.jpg",
    is_veg_only: false,
    categories: [
      {
        name: "Faloodas",
        craving: "faloodas",
        items: [
          ["Royal Falooda", 8.99, null, { img: DD + "royal-falooda.jpg", featured: true }],
          ["Mango Falooda", 8.99, null, { img: DD + "mango-falooda.jpg", featured: true }],
          ["Kesar Pista Falooda", 8.99, null, { img: DD + "kesar-pista-falooda.jpg" }],
          ["Special Falooda", 8.99, null, { img: DD + "special-falooda.jpg" }],
          ["Chikoo Falooda", 8.99, null, { img: DD + "chikoo-falooda.jpg" }],
          ["Choco Caramel", 8.99, null, { img: DD + "choco-caramel.jpg" }],
        ],
      },
      {
        name: "Milk, Shakes & Lassi",
        craving: "shakes-lassi",
        items: [
          ["Rose Milk", 6.99, null, { img: DD + "rose-milk.jpg" }],
          ["Badam Milk", 7.99, null, { img: DD + "badam-milk.jpg" }],
          ["Chikoo Shake", 7.99, null, { img: DD + "chikoo-shake.jpg" }],
          ["Mango Lassi", 7.99, null, { img: DD + "mango-lassi.jpg", featured: true }],
        ],
      },
      {
        name: "Desserts",
        craving: "desserts",
        items: [
          ["Apricot Delight", 8.49, null, { img: DD + "apricot-delight.jpg" }],
          ["Chocolate Chip Brownie", 6.99, null, { ...P, img: DD + "chocolate-chip-brownie.jpg" }],
          ["Gulab Jamun", 5.49, null, { img: DD + "gulab-jamun.jpg", featured: true }],
          ["Rasmalai", 4.99, null, { img: DD + "rasmalai.jpg" }],
          ["Poornalu", 4.99, null, { img: DD + "poornalu.jpg" }],
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------- flatten
const stalls = [];
const menu_categories = [];
const menu_items = [];
const placeholder_price_item_ids = [];

stallSources.forEach((s, si) => {
  stalls.push({
    id: s.slug,
    slug: s.slug,
    name: s.name,
    tagline: s.tagline,
    cuisines: s.cuisines,
    location_label: null,
    phone: s.phone,
    instagram: s.instagram,
    logo_url: s.logo_url,
    cover_url: photo(s.slug, "cover") ?? s.cover_url,
    is_veg_only: s.is_veg_only,
    avg_prep_mins: null,
    is_open: true,
    is_active: true,
    sort_order: si + 1,
  });
  s.categories.forEach((c, ci) => {
    const category_id = `${s.slug}.${slugify(c.name)}`;
    menu_categories.push({ id: category_id, stall_id: s.slug, name: c.name, sort_order: ci + 1 });
    c.items.forEach(([name, price, diet, opt = {}], ii) => {
      const id = `${s.slug}.${slugify(name)}`;
      if (menu_items.some((m) => m.id === id)) throw new Error(`duplicate item id ${id}`);
      if (opt.placeholder) placeholder_price_item_ids.push(id);
      menu_items.push({
        id,
        stall_id: s.slug,
        category_id,
        name,
        description: descriptions[id] ?? opt.desc ?? null,
        serves: DEFAULT_SERVES,
        price_cents: cents(price),
        diet,
        image_url: photo(s.slug, slugify(name)) ?? opt.img ?? null,
        craving: c.craving,
        is_available: true,
        is_featured: Boolean(opt.featured),
        sort_order: ii + 1,
      });
    });
  });
});

const item = (id) => {
  const found = menu_items.find((m) => m.id === id);
  if (!found) throw new Error(`banner points at missing item ${id}`);
  return found;
};

const banners = [
  ["fish-curry", "pandemkodi-dhaba.fish-curry-with-fresh-live-pulka"],
  ["mutton-curry", "pandemkodi-dhaba.mutton-curry-with-fresh-live-pulka"],
  ["dhaba-chicken-curry", "pandemkodi-dhaba.dhaba-chicken-curry-with-fresh-live-pulka"],
  ["egg-curry", "pandemkodi-dhaba.boiled-egg-curry-with-fresh-live-pulka"],
  ["paneer-butter-masala", "pandemkodi-dhaba.paneer-butter-masala-with-fresh-live-pulka"],
].map(([key, itemId], i) => ({
  id: `banner.${key}`,
  title: item(itemId).name,
  subtitle: "PandemKodi Dhaba",
  image_url: photo("pandemkodi-dhaba", itemId.split(".")[1]) ?? `${PK}poster-${key}.jpg`,
  stall_id: "pandemkodi-dhaba",
  menu_item_id: itemId,
  is_active: true,
  sort_order: i + 1,
}));

const catalog = {
  contract_version: 1,
  park,
  cravings,
  banners,
  stalls,
  menu_categories,
  menu_items,
  placeholder_price_item_ids,
};

const undescribed = menu_items.filter((m) => !m.description).map((m) => m.id);
if (undescribed.length) console.warn(`no description for: ${undescribed.join(", ")}`);
const stale = Object.keys(descriptions).filter((id) => !menu_items.some((m) => m.id === id));
if (stale.length) throw new Error(`descriptions.mjs has ids that are not on any menu: ${stale.join(", ")}`);

// ---------------------------------------------------------------- write JSON
const jsonPath = resolve(root, "shared/seed/catalog.json");
writeFileSync(jsonPath, JSON.stringify(catalog, null, 2) + "\n");

// ---------------------------------------------------------------- write SQL
const q = (v) => {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return `array[${v.map(q).join(", ")}]::text[]`;
  return `'${String(v).replace(/'/g, "''")}'`;
};

const upsert = (table, rows, key = "id") => {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const values = rows.map((r) => `  (${cols.map((c) => q(r[c])).join(", ")})`).join(",\n");
  const updates = cols
    .filter((c) => c !== key)
    .map((c) => `${c} = excluded.${c}`)
    .join(", ");
  return `insert into public.${table} (${cols.join(", ")}) values\n${values}\non conflict (${key}) do update set ${updates};\n`;
};

const sql = [
  "-- Generated by shared/seed/build.mjs. Do not edit by hand.",
  "-- Loads the catalog from the owner's menus. Safe to re-run: rows are upserted.",
  "-- Prices for the ids in catalog.json > placeholder_price_item_ids are placeholders.",
  "",
  upsert("park_settings", [park]),
  upsert("cravings", cravings, "slug"),
  upsert("stalls", stalls),
  upsert("menu_categories", menu_categories),
  upsert("menu_items", menu_items),
  upsert("banners", banners),
].join("\n");

const sqlPath = resolve(root, "supabase/seed.sql");
mkdirSync(dirname(sqlPath), { recursive: true });
writeFileSync(sqlPath, sql);

console.log(
  `catalog: ${stalls.length} stalls, ${menu_categories.length} categories, ${menu_items.length} items ` +
    `(${placeholder_price_item_ids.length} placeholder prices), ${banners.length} banners`,
);
