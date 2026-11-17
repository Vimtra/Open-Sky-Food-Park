"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
import { backend, isDemo } from "@/lib/backend";
import { dayAndTime, friendlyError, imageSrc, isOrderLive, money, plural } from "@/lib/format";
import { useAllOrders, useCatalog, useSupportRequests, type CatalogIndex } from "@/lib/hooks";
import { useSession } from "@/lib/hooks";
import type { Banner, Diet, MenuCategory, MenuItem, Park, Stall, SupportStatus } from "@/lib/types";
import { supportTopics } from "./support-shared";
import { StatusPill } from "./order-screen";
import { StaffHeader, StaffSignIn } from "./staff-shell";
import { Button, Chip, cn, Container, DietMark, Field, inputClass, Notice, Spinner, Switch } from "./ui";

type Tab = "orders" | "messages" | "menu" | "stalls" | "promos" | "settings";
const tabs: [Tab, string][] = [
  ["orders", "Orders"],
  ["messages", "Messages"],
  ["menu", "Menus"],
  ["stalls", "Stalls"],
  ["promos", "Promos"],
  ["settings", "Settings"],
];

/** Runs a save, reports failures, and refreshes the catalog afterwards. `done` is shown as a confirmation. */
type Run = (fn: () => Promise<unknown>, done?: string) => Promise<boolean>;

// ------------------------------------------------------------------ small form parts
function Text({
  label,
  value,
  onChange,
  hint,
  error,
  ...rest
}: { label: string; value: string; onChange: (v: string) => void; hint?: string; error?: string | null } & Omit<React.ComponentProps<"input">, "value" | "onChange">) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} hint={hint} error={error}>
      <input id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} {...rest} />
    </Field>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex min-h-11 items-center gap-2.5 text-label font-semibold">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 accent-[var(--color-leaf-600)]" />
      {label}
    </label>
  );
}

function Select({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: ReactNode }) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id}>
      <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
        {children}
      </select>
    </Field>
  );
}

function ConfirmDelete({ what, onDelete }: { what: string; onDelete: () => void }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <span className="flex items-center gap-2">
      <Button variant="danger" onClick={onDelete}>
        Delete {what}
      </Button>
      <Button variant="ghost" onClick={() => setAsking(false)}>
        Keep
      </Button>
    </span>
  ) : (
    <Button variant="ghost" className="text-chili-600" onClick={() => setAsking(true)}>
      <Trash2 className="size-4" aria-hidden />
      Delete
    </Button>
  );
}

const toCents = (dollars: string) => {
  const n = Number(dollars.replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 && dollars.trim() !== "" ? Math.round(n * 100) : null;
};
const toDollars = (cents: number) => (cents / 100).toFixed(2);
const blankToNull = (s: string) => s.trim() || null;

// ------------------------------------------------------------------ orders
function OrdersTab() {
  const { orders, error } = useAllOrders();
  if (error && !orders) return <Notice tone="error">Could not load orders.</Notice>;
  if (!orders) return <Spinner />;

  const today = new Date().toDateString();
  const todays = orders.filter((o) => new Date(o.created_at).toDateString() === today && o.status !== "cancelled" && o.status !== "awaiting_payment");
  const live = orders.filter(isOrderLive);

  return (
    <>
      <p className="text-ink-700">
        Today: <strong className="text-ink-900 tabular-nums">{plural(todays.length, "order")}</strong> worth{" "}
        <strong className="text-ink-900 tabular-nums">{money(todays.reduce((n, o) => n + o.total_cents, 0))}</strong>,{" "}
        <strong className="text-ink-900 tabular-nums">{live.length}</strong> in progress.
      </p>
      {orders.length === 0 ? (
        <p className="mt-8 text-ink-500">No orders yet. They show up here as customers place them.</p>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[720px] text-left text-label">
            <thead className="bg-surface-1 text-ink-700">
              <tr>
                {["Order", "Placed", "Customer", "Stalls", "Payment", "Total"].map((h) => (
                  <th key={h} scope="col" className={cn("px-4 py-2.5 font-bold", h === "Total" && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line font-medium">
              {orders.map((o) => (
                <tr key={o.id} className="align-top">
                  <td className="px-4 py-3 font-bold tabular-nums">{o.order_no}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink-700 tabular-nums">{dayAndTime(o.created_at)}</td>
                  <td className="px-4 py-3">
                    {o.customer_name}
                    <span className="block text-small text-ink-500">{o.fulfilment === "table" ? `Table ${o.table_no}` : "Pickup"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <ul className="space-y-1.5">
                      {o.stall_orders.map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          <span className="tabular-nums">#{s.token_no}</span>
                          <span className="truncate">{s.stall?.name}</span>
                          <StatusPill status={s.status} />
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-4 py-3 text-ink-700">
                    {o.payment_status === "paid" ? "Paid online" : o.payment_method === "online" ? "Awaiting payment" : "At the stall"}
                  </td>
                  <td className="px-4 py-3 text-right font-bold tabular-nums">{money(o.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ------------------------------------------------------------------ menus
function ItemForm({ item, category, index, run, onClose }: { item: MenuItem | null; category: MenuCategory; index: CatalogIndex; run: Run; onClose: () => void }) {
  const [name, setName] = useState(item?.name ?? "");
  const [price, setPrice] = useState(item ? toDollars(item.price_cents) : "");
  const [diet, setDiet] = useState<string>(item?.diet ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [serves, setServes] = useState(item?.serves ? String(item.serves) : "");
  const [size, setSize] = useState(item?.size_label ?? "");
  const [image, setImage] = useState(item?.image_url ?? "");
  const [craving, setCraving] = useState(item?.craving ?? "");
  const [available, setAvailable] = useState(item?.is_available ?? true);
  const [featured, setFeatured] = useState(item?.is_featured ?? false);
  const [touched, setTouched] = useState(false);
  const cents = toCents(price);
  const servesNum = serves.trim() ? Number(serves) : null;
  const servesOk = servesNum === null || (Number.isInteger(servesNum) && servesNum >= 1 && servesNum <= 50);

  const save = async () => {
    setTouched(true);
    if (!name.trim() || cents === null || !servesOk) return;
    const ok = await run(() =>
      backend().saveItem({
        ...(item ? { id: item.id } : {}),
        stall_id: category.stall_id,
        category_id: category.id,
        name: name.trim(),
        price_cents: cents,
        diet: (diet || null) as Diet | null,
        description: blankToNull(description),
        serves: servesNum,
        size_label: blankToNull(size)?.slice(0, 24) ?? null,
        image_url: blankToNull(image),
        craving: craving || null,
        is_available: available,
        is_featured: featured,
      }),
    );
    if (ok) onClose();
  };

  return (
    <div className="my-2 rounded-lg border border-night-900 bg-surface-1 p-4">
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
        <Text label="Dish name" value={name} onChange={setName} error={touched && !name.trim() ? "Give the dish a name." : null} />
        <Text label="Price (USD)" value={price} onChange={setPrice} inputMode="decimal" placeholder="8.99" error={touched && cents === null ? "Enter a price like 8.99." : null} />
        <Select label="Diet mark" value={diet} onChange={setDiet}>
          <option value="">Not stated</option>
          <option value="veg">Veg</option>
          <option value="egg">Egg</option>
          <option value="nonveg">Non-veg</option>
        </Select>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
        <Text label="One-line description" value={description} onChange={setDescription} maxLength={140} hint="Shown under the price, e.g. “Paneer in a creamy tomato-butter gravy.”" />
        <Text
          label="Serves"
          value={serves}
          onChange={setServes}
          inputMode="numeric"
          placeholder="e.g. 4"
          hint="People. Empty hides it."
          error={touched && !servesOk ? "Whole number, 1 to 50." : null}
        />
        <Text label="Size" value={size} onChange={setSize} maxLength={24} placeholder="e.g. 12 oz" hint="Shown instead of Serves." />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Select label="Shows under craving" value={craving} onChange={setCraving}>
          <option value="">None</option>
          {index.catalog.cravings.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>
      <div className="mt-4">
        <Text label="Photo URL (optional)" value={image} onChange={setImage} placeholder="https://… or img/stall/dish.jpg" hint="Square photos work best." />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-6">
        <Check label="In stock" checked={available} onChange={setAvailable} />
        <Check label="Show on the home page first" checked={featured} onChange={setFeatured} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={save}>{item ? "Save dish" : "Add dish"}</Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {item && (
          <span className="ml-auto">
            <ConfirmDelete what="dish" onDelete={() => void run(() => backend().deleteItem(item.id)).then((ok) => ok && onClose())} />
          </span>
        )}
      </div>
    </div>
  );
}

function CategoryBlock({ category, index, run }: { category: MenuCategory; index: CatalogIndex; run: Run }) {
  const [editing, setEditing] = useState<string | null>(null); // item id, or "new"
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(category.name);
  const items = (index.itemsByStall.get(category.stall_id) ?? []).filter((m) => m.category_id === category.id);
  const placeholders = new Set(index.catalog.placeholder_price_item_ids ?? []);

  return (
    <section className="mt-6 rounded-lg border border-line" aria-label={category.name}>
      <header className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-1 px-4 py-2.5">
        {renaming ? (
          <form
            className="flex flex-1 flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) void run(() => backend().saveCategory({ ...category, name: name.trim() })).then((ok) => ok && setRenaming(false));
            }}
          >
            <input value={name} onChange={(e) => setName(e.target.value)} aria-label="Section name" className={`${inputClass} h-10 max-w-xs`} autoFocus />
            <Button type="submit" size="sm">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(false)}>
              Cancel
            </Button>
            <span className="ml-auto">
              <ConfirmDelete what={`section and its ${plural(items.length, "dish", "dishes")}`} onDelete={() => void run(() => backend().deleteCategory(category.id))} />
            </span>
          </form>
        ) : (
          <>
            <h3 className="flex-1 text-[1.0625rem] font-extrabold">
              {category.name} <span className="font-semibold text-ink-500">({items.length})</span>
            </h3>
            <Button size="sm" variant="ghost" onClick={() => setRenaming(true)}>
              <Pencil className="size-4" aria-hidden />
              Rename
            </Button>
          </>
        )}
      </header>
      <ul className="divide-y divide-line px-4">
        {items.map((m) =>
          editing === m.id ? (
            <li key={m.id}>
              <ItemForm item={m} category={category} index={index} run={run} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li key={m.id} className="flex min-h-14 items-center gap-3 py-2">
              {m.image_url ? <img src={imageSrc(m.image_url)!} alt="" className="size-10 rounded-sm bg-surface-1 object-cover" /> : <span className="size-10 rounded-sm bg-surface-1" aria-hidden />}
              <DietMark diet={m.diet} />
              <span className="min-w-0 flex-1">
                <span className={cn("font-semibold", !m.is_available && "text-ink-500 line-through")}>{m.name}</span>
                <span className="ml-2 inline-flex flex-wrap gap-1.5 align-middle">
                  {placeholders.has(m.id) && <span className="rounded-full bg-ember-100 px-2 py-0.5 text-caption font-bold text-ember-700">Price not confirmed</span>}
                  {!m.is_available && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-caption font-bold text-ink-700">Sold out</span>}
                </span>
              </span>
              <span className="font-bold tabular-nums">{money(m.price_cents)}</span>
              <Button size="sm" variant="outline" onClick={() => setEditing(m.id)} aria-label={`Edit ${m.name}`}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            </li>
          ),
        )}
        <li className="py-2">
          {editing === "new" ? (
            <ItemForm item={null} category={category} index={index} run={run} onClose={() => setEditing(null)} />
          ) : (
            <Button size="sm" variant="ghost" className="text-ember-700" onClick={() => setEditing("new")}>
              <Plus className="size-4" strokeWidth={2.5} aria-hidden />
              Add a dish to {category.name}
            </Button>
          )}
        </li>
      </ul>
    </section>
  );
}

function MenuTab({ index, run }: { index: CatalogIndex; run: Run }) {
  const stalls = index.catalog.stalls;
  const [stallId, setStallId] = useState(stalls[0]?.id ?? "");
  const [newSection, setNewSection] = useState("");
  const categories = index.categoriesByStall.get(stallId) ?? [];
  const unconfirmed = (index.catalog.placeholder_price_item_ids ?? []).filter((id) => index.itemById.get(id)?.stall_id === stallId).length;

  if (!stalls.length) return <p className="text-ink-500">Add a stall first, then build its menu here.</p>;

  return (
    <>
      <div className="max-w-xs">
        <Select label="Stall" value={stallId} onChange={setStallId}>
          {stalls.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
      {unconfirmed > 0 && (
        <Notice tone="warn" className="mt-4">
          {plural(unconfirmed, "price")} on this menu {unconfirmed === 1 ? "is a placeholder" : "are placeholders"}. Edit each dish to set the real price; the tag clears when you save.
        </Notice>
      )}
      {categories.map((c) => (
        <CategoryBlock key={c.id} category={c} index={index} run={run} />
      ))}
      <form
        className="mt-6 flex max-w-md items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (newSection.trim()) void run(() => backend().saveCategory({ stall_id: stallId, name: newSection.trim() })).then((ok) => ok && setNewSection(""));
        }}
      >
        <div className="flex-1">
          <Text label="New menu section" value={newSection} onChange={setNewSection} placeholder="e.g. Biryani" />
        </div>
        <Button type="submit" variant="outline" className="h-12" disabled={!newSection.trim()}>
          Add section
        </Button>
      </form>
    </>
  );
}

// ------------------------------------------------------------------ stalls
function StallForm({ stall, run, onClose }: { stall: Stall | null; run: Run; onClose: () => void }) {
  const [f, setF] = useState({
    name: stall?.name ?? "",
    tagline: stall?.tagline ?? "",
    cuisines: stall?.cuisines.join(", ") ?? "",
    location_label: stall?.location_label ?? "",
    phone: stall?.phone ?? "",
    instagram: stall?.instagram ?? "",
    avg_prep_mins: stall?.avg_prep_mins ? String(stall.avg_prep_mins) : "",
    logo_url: stall?.logo_url ?? "",
    cover_url: stall?.cover_url ?? "",
    is_active: stall?.is_active ?? true,
  });
  const [touched, setTouched] = useState(false);
  const up = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }));
  const prep = f.avg_prep_mins.trim() ? Number(f.avg_prep_mins) : null;
  const prepOk = prep === null || (Number.isInteger(prep) && prep >= 1 && prep <= 240);

  const save = async () => {
    setTouched(true);
    if (!f.name.trim() || !prepOk) return;
    const ok = await run(() =>
      backend().saveStall({
        ...(stall ? { id: stall.id, slug: stall.slug } : {}),
        name: f.name.trim(),
        tagline: blankToNull(f.tagline),
        cuisines: f.cuisines
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        location_label: blankToNull(f.location_label),
        phone: blankToNull(f.phone),
        instagram: blankToNull(f.instagram.replace(/^@/, "")),
        avg_prep_mins: prep,
        logo_url: blankToNull(f.logo_url),
        cover_url: blankToNull(f.cover_url),
        is_active: f.is_active,
      }),
    );
    if (ok) onClose();
  };

  return (
    <div className="rounded-lg border border-night-900 bg-surface-1 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Stall name" value={f.name} onChange={up("name")} error={touched && !f.name.trim() ? "Give the stall a name." : null} />
        <Text label="Tagline (optional)" value={f.tagline} onChange={up("tagline")} />
        <Text label="What it serves" value={f.cuisines} onChange={up("cuisines")} hint="Separate with commas." placeholder="Curries, Mandi, Pulav" />
        <Text label="Where it stands in the park" value={f.location_label} onChange={up("location_label")} placeholder="e.g. Truck 3, by the screen" />
        <Text label="Phone" value={f.phone} onChange={up("phone")} type="tel" />
        <Text label="Instagram handle" value={f.instagram} onChange={up("instagram")} />
        <Text
          label="Usual prep time, minutes"
          value={f.avg_prep_mins}
          onChange={up("avg_prep_mins")}
          inputMode="numeric"
          error={touched && !prepOk ? "Enter whole minutes between 1 and 240, or leave it empty." : null}
        />
        <Text label="Logo image URL" value={f.logo_url} onChange={up("logo_url")} />
      </div>
      <div className="mt-4">
        <Text label="Cover photo URL" value={f.cover_url} onChange={up("cover_url")} hint="Wide photo, 3:2." />
      </div>
      <div className="mt-2">
        <Check label="Listed on the customer site and apps" checked={f.is_active} onChange={(v) => setF((s) => ({ ...s, is_active: v }))} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={save}>{stall ? "Save stall" : "Add stall"}</Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        {stall && (
          <span className="ml-auto">
            <ConfirmDelete what="stall and its whole menu" onDelete={() => void run(() => backend().deleteStall(stall.id)).then((ok) => ok && onClose())} />
          </span>
        )}
      </div>
    </div>
  );
}

function StallsTab({ index, run }: { index: CatalogIndex; run: Run }) {
  const [editing, setEditing] = useState<string | null>(null);
  const stalls = [...index.catalog.stalls].sort((a, b) => a.sort_order - b.sort_order);
  return (
    <>
      <ul className="space-y-3">
        {stalls.map((s) =>
          editing === s.id ? (
            <li key={s.id}>
              <StallForm stall={s} run={run} onClose={() => setEditing(null)} />
            </li>
          ) : (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
              {s.logo_url ? <img src={imageSrc(s.logo_url)!} alt="" className="size-12 rounded-full border border-line bg-white object-cover" /> : <span className="size-12 rounded-full bg-surface-2" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-extrabold">{s.name}</span>
                <span className="block truncate text-small text-ink-500">
                  {plural(index.itemsByStall.get(s.id)?.length ?? 0, "dish", "dishes")} · {s.is_active ? "Listed" : "Hidden from customers"}
                </span>
              </span>
              <label className="flex items-center gap-2 text-label font-semibold">
                {s.is_open ? "Taking orders" : "Closed"}
                <Switch checked={s.is_open} onChange={(v) => void run(() => backend().setStallOpen(s.id, v))} label={`${s.name} is taking orders`} />
              </label>
              <Button size="sm" variant="outline" onClick={() => setEditing(s.id)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </Button>
            </li>
          ),
        )}
      </ul>
      <div className="mt-5">
        {editing === "new" ? (
          <StallForm stall={null} run={run} onClose={() => setEditing(null)} />
        ) : (
          <Button variant="outline" onClick={() => setEditing("new")}>
            <Plus className="size-4" strokeWidth={2.5} aria-hidden />
            Add a stall
          </Button>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ promos
function PromosTab({ index, run }: { index: CatalogIndex; run: Run }) {
  const banners = [...index.catalog.banners].sort((a, b) => a.sort_order - b.sort_order);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [image, setImage] = useState("");
  const [itemId, setItemId] = useState("");
  const [touched, setTouched] = useState(false);

  const add = async () => {
    setTouched(true);
    if (!title.trim()) return;
    const item = itemId ? index.itemById.get(itemId) : undefined;
    const stall = item ? index.stallById.get(item.stall_id) : undefined;
    const ok = await run(() =>
      backend().saveBanner({ title: title.trim(), image_url: blankToNull(image), menu_item_id: item?.id ?? null, stall_id: stall?.id ?? null, subtitle: stall?.name ?? null }),
    );
    if (ok) {
      setAdding(false);
      setTitle("");
      setImage("");
      setItemId("");
      setTouched(false);
    }
  };

  return (
    <>
      <p className="max-w-prose text-ink-700">Promos appear on the home page under “Combos and specials”. Link one to a dish and customers can add it straight from the poster.</p>
      <ul className="mt-5 space-y-3">
        {banners.map((b: Banner) => (
          <li key={b.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-line p-3">
            {b.image_url ? <img src={imageSrc(b.image_url)!} alt="" className="size-14 rounded-sm bg-surface-1 object-cover" /> : <span className="size-14 rounded-sm bg-surface-1" aria-hidden />}
            <span className="min-w-0 flex-1">
              <span className="block truncate font-bold">{b.title}</span>
              <span className="block truncate text-small text-ink-500">{b.subtitle ?? "Not linked to a stall"}</span>
            </span>
            <label className="flex items-center gap-2 text-label font-semibold">
              {b.is_active ? "Showing" : "Hidden"}
              <Switch checked={b.is_active} onChange={(v) => void run(() => backend().saveBanner({ ...b, is_active: v }))} label={`Show ${b.title}`} />
            </label>
            <ConfirmDelete what="promo" onDelete={() => void run(() => backend().deleteBanner(b.id))} />
          </li>
        ))}
      </ul>
      <div className="mt-5">
        {adding ? (
          <div className="rounded-lg border border-night-900 bg-surface-1 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label="Title" value={title} onChange={setTitle} error={touched && !title.trim() ? "Give the promo a title." : null} />
              <Select label="Linked dish (optional)" value={itemId} onChange={setItemId}>
                <option value="">None</option>
                {index.catalog.stalls.map((s) => (
                  <optgroup key={s.id} label={s.name}>
                    {(index.itemsByStall.get(s.id) ?? []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            </div>
            <div className="mt-4">
              <Text label="Poster image URL" value={image} onChange={setImage} hint="Square poster, at least 800 px." />
            </div>
            <div className="mt-4 flex gap-2">
              <Button onClick={add}>Add promo</Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setAdding(true)}>
            <Plus className="size-4" strokeWidth={2.5} aria-hidden />
            Add a promo
          </Button>
        )}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ messages
const statusLabel: Record<SupportStatus, string> = { new: "New", in_progress: "In progress", closed: "Closed" };
const statusClass: Record<SupportStatus, string> = {
  new: "bg-ember-100 text-ember-700",
  in_progress: "bg-surface-2 text-ink-700",
  closed: "bg-leaf-50 text-leaf-700",
};

function contactHref(contact: string) {
  if (/@/.test(contact)) return `mailto:${contact}`;
  const digits = contact.replace(/[^\d+]/g, "");
  return digits.length >= 8 ? `tel:${digits}` : null;
}

function MessagesTab({ run }: { run: Run }) {
  const { requests, error } = useSupportRequests();
  const [filter, setFilter] = useState<"open" | "all">("open");
  if (error && !requests) return <Notice tone="error">Could not load messages.</Notice>;
  if (!requests) return <Spinner />;

  const open = requests.filter((r) => r.status !== "closed");
  const shown = filter === "open" ? open : requests;
  const topicLabel = new Map(supportTopics.map((t) => [t.value, t.label]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-700">
          Messages sent from <strong className="text-ink-900">Contact us</strong>. {open.length === 0 ? "Nothing waiting." : `${plural(open.length, "message")} waiting.`}
        </p>
        <div className="flex gap-2" role="group" aria-label="Show">
          <Chip selected={filter === "open"} onClick={() => setFilter("open")}>
            Open
          </Chip>
          <Chip selected={filter === "all"} onClick={() => setFilter("all")}>
            All
          </Chip>
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="mt-8 text-ink-500">{filter === "open" ? "No open messages." : "No messages yet. They show up here when someone uses the Contact us page."}</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {shown.map((r) => {
            const href = contactHref(r.contact);
            return (
              <li key={r.id} className={cn("rounded-xl border border-line p-4 md:p-5", r.status === "closed" && "bg-surface-1")}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold">{r.name}</span>
                      <span className={cn("inline-flex h-6 items-center rounded-full px-2.5 text-caption font-bold", statusClass[r.status])}>{statusLabel[r.status]}</span>
                    </p>
                    <p className="mt-0.5 text-small text-ink-500">
                      <span className="tabular-nums">{r.ref_no}</span> · {dayAndTime(r.created_at)} · {topicLabel.get(r.topic) ?? r.topic}
                      {r.order_no && <span className="tabular-nums"> · {r.order_no}</span>}
                    </p>
                  </div>
                  {href ? (
                    <a href={href} className="text-label font-bold text-ember-700 hover:underline">
                      {r.contact}
                    </a>
                  ) : (
                    <span className="text-label font-bold">{r.contact}</span>
                  )}
                </div>
                <p className="mt-3 max-w-prose whitespace-pre-line text-ink-900">{r.message}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => void run(() => backend().setSupportRequestStatus(r.id, "in_progress"))}>
                      Mark in progress
                    </Button>
                  )}
                  {r.status !== "closed" ? (
                    <Button size="sm" variant="dark" onClick={() => void run(() => backend().setSupportRequestStatus(r.id, "closed"))}>
                      Close
                    </Button>
                  ) : (
                    <Button size="sm" variant="ghost" onClick={() => void run(() => backend().setSupportRequestStatus(r.id, "new"))}>
                      Reopen
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

// ------------------------------------------------------------------ settings
function SettingsTab({ park, run }: { park: Park; run: Run }) {
  const [name, setName] = useState(park.name);
  const [address, setAddress] = useState(park.address ?? "");
  const [tax, setTax] = useState(String(park.tax_percent));
  const [fee, setFee] = useState(toDollars(park.service_fee_cents));
  const [announcement, setAnnouncement] = useState(park.announcement ?? "");
  const [contactEmail, setContactEmail] = useState(park.contact_email ?? "");
  const [contactPhone, setContactPhone] = useState(park.contact_phone ?? "");
  const [hours, setHours] = useState(park.hours_text ?? "");
  const [ordering, setOrdering] = useState(park.ordering_enabled);
  const [tables, setTables] = useState(park.table_service_enabled);
  const [touched, setTouched] = useState(false);
  const taxNum = Number(tax);
  const taxOk = tax.trim() !== "" && Number.isFinite(taxNum) && taxNum >= 0 && taxNum <= 30;
  const feeCents = toCents(fee);

  const save = async () => {
    setTouched(true);
    if (!name.trim() || !taxOk || feeCents === null) return;
    await run(
      () =>
        backend().saveSettings({
          name: name.trim(),
          address: blankToNull(address),
          tax_percent: taxNum,
          service_fee_cents: feeCents,
          announcement: blankToNull(announcement),
          contact_email: blankToNull(contactEmail),
          contact_phone: blankToNull(contactPhone),
          hours_text: blankToNull(hours),
          ordering_enabled: ordering,
          table_service_enabled: tables,
        }),
      "Settings saved. Customers see the change on their next screen.",
    );
  };

  return (
    <div className="max-w-2xl">
      <div className="grid gap-4 sm:grid-cols-2">
        <Text label="Park name" value={name} onChange={setName} error={touched && !name.trim() ? "Enter the park name." : null} />
        <Text label="Address" value={address} onChange={setAddress} />
        <Text
          label="Sales tax, percent"
          value={tax}
          onChange={setTax}
          inputMode="decimal"
          hint="Added on top of menu prices at checkout. 0 means none."
          error={touched && !taxOk ? "Enter a percentage between 0 and 30." : null}
        />
        <Text
          label="Service fee per order (USD)"
          value={fee}
          onChange={setFee}
          inputMode="decimal"
          error={touched && feeCents === null ? "Enter an amount like 0.50, or 0 for none." : null}
        />
      </div>
      <div className="mt-4">
        <Text label="Announcement on the home page (optional)" value={announcement} onChange={setAnnouncement} placeholder="e.g. Movie night starts at 8 PM" />
      </div>
      <h3 className="mt-8 text-subheading font-extrabold">Contact details</h3>
      <p className="mt-1 text-label font-medium text-ink-700">Shown on Contact us and Help &amp; Support only when filled in. Leave a field empty to hide it.</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Text label="Park email" value={contactEmail} onChange={setContactEmail} type="email" placeholder="hello@…" />
        <Text label="Park phone" value={contactPhone} onChange={setContactPhone} type="tel" />
        <Text label="Opening hours" value={hours} onChange={setHours} placeholder="e.g. Thu–Sun, 5–11 PM" hint="Free text, shown as written." />
      </div>
      <div className="mt-3">
        <Check label="Take online orders" checked={ordering} onChange={setOrdering} />
        <Check label="Offer “bring it to my table”" checked={tables} onChange={setTables} />
      </div>
      <div className="mt-4">
        <Button onClick={save}>Save settings</Button>
      </div>

      {isDemo && (
        <div className="mt-10 border-t border-line pt-6">
          <h3 className="text-subheading font-extrabold">Demo data</h3>
          <p className="mt-1 text-label font-medium text-ink-700">Clears every demo order and puts menus, stalls and settings back to the seed. Only affects this browser.</p>
          <div className="mt-3">
            <ConfirmDelete what="all demo orders and edits" onDelete={() => void run(() => backend().resetDemo(), "Demo data reset to the seed.")} />
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ shell
export function AdminScreen() {
  const { session, isLoading } = useSession("staff");
  const { index, reload } = useCatalog();
  const [tab, setTab] = useState<Tab>("orders");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const run: Run = async (fn, doneText) => {
    setError(null);
    setDone(null);
    try {
      await fn();
      await reload();
      setDone(doneText ?? null);
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    }
  };

  const isAdmin = session?.profile.role === "admin";

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <StaffHeader title="Admin panel" session={session} />
      {isLoading || !index ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : !session ? (
        <StaffSignIn want="admin" />
      ) : !isAdmin ? (
        <Container className="max-w-md py-10">
          <h1 className="text-title">This account is not an admin</h1>
          <p className="mt-2 text-ink-700">Sign out and sign in with the park admin account. Stall staff use the stall dashboard.</p>
        </Container>
      ) : (
        <Container className="flex-1 py-5">
          <nav className="no-scrollbar -mx-4 flex gap-5 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0" aria-label="Admin sections">
            {tabs.map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key);
                  setError(null);
                  setDone(null);
                }}
                aria-current={tab === key ? "page" : undefined}
                className={cn(
                  "-mb-px h-11 shrink-0 border-b-[3px] px-1 text-[0.9375rem] transition-colors duration-150",
                  tab === key ? "border-ember-500 font-extrabold text-ink-900" : "border-transparent font-semibold text-ink-500 hover:text-ink-900",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
          {error && (
            <Notice tone="error" className="mt-4">
              {error}
            </Notice>
          )}
          {done && !error && (
            <Notice tone="success" className="mt-4">
              {done}
            </Notice>
          )}
          <div className="py-6">
            {tab === "orders" && <OrdersTab />}
            {tab === "messages" && <MessagesTab run={run} />}
            {tab === "menu" && <MenuTab index={index} run={run} />}
            {tab === "stalls" && <StallsTab index={index} run={run} />}
            {tab === "promos" && <PromosTab index={index} run={run} />}
            {tab === "settings" && <SettingsTab key={JSON.stringify(index.catalog.park)} park={index.catalog.park} run={run} />}
          </div>
        </Container>
      )}
    </div>
  );
}
