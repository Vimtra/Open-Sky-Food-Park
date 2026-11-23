"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { backend } from "@/lib/backend";
import type { OptionGroupInput } from "@/lib/backend/types";
import { money } from "@/lib/format";
import type { OptionGroupView } from "@/lib/options";
import type { MenuItem } from "@/lib/types";
import { toCents, toDollars, type Run } from "./admin-kit";
import { Button, cn, inputClass } from "./ui";

type Rule = "one" | "optional-one" | "many";

interface DraftOption {
  id?: string;
  name: string;
  price: string;
  is_default: boolean;
  is_available: boolean;
}
interface DraftGroup {
  id?: string;
  name: string;
  rule: Rule;
  max: string;
  options: DraftOption[];
}

const ruleOf = (min: number, max: number): Rule => (min >= 1 && max === 1 ? "one" : max === 1 ? "optional-one" : "many");

function toDraft(groups: OptionGroupView[]): DraftGroup[] {
  return groups.map(({ group, options }) => ({
    id: group.id,
    name: group.name,
    rule: ruleOf(group.min_select, group.max_select),
    max: String(group.max_select),
    options: options.map((o) => ({ id: o.id, name: o.name, price: o.price_cents ? toDollars(o.price_cents) : "", is_default: o.is_default, is_available: o.is_available })),
  }));
}

/**
 * Choices on a dish: a size (pick one), a spice level, add-ons with prices.
 * Used in the admin menu editor; a truck can edit its own the same way (contract v1.6).
 */
export function OptionsEditor({ item, groups, run }: { item: MenuItem; groups: OptionGroupView[]; run: Run }) {
  const [draft, setDraft] = useState<DraftGroup[]>(() => toDraft(groups));
  const [touched, setTouched] = useState(false);
  const [dirty, setDirty] = useState(false);

  const edit = (fn: (d: DraftGroup[]) => void) => {
    setDraft((cur) => {
      const next = structuredClone(cur);
      fn(next);
      return next;
    });
    setDirty(true);
  };

  const problems: string[] = [];
  draft.forEach((g, gi) => {
    const label = g.name.trim() || `Choice ${gi + 1}`;
    if (!g.name.trim()) problems.push(`Choice ${gi + 1} needs a name (like "Spice level").`);
    if (!g.options.length) problems.push(`${label} needs at least one option.`);
    if (g.options.some((o) => !o.name.trim())) problems.push(`Every option in ${label} needs a name.`);
    if (g.options.some((o) => o.price.trim() && toCents(o.price) === null)) problems.push(`Extra prices in ${label} must look like 1.99.`);
    const max = Number(g.max);
    if (g.rule === "many" && !(Number.isInteger(max) && max >= 1 && max <= 20)) problems.push(`${label}: "up to" must be 1 to 20.`);
    if (g.rule === "one" && !g.options.some((o) => o.is_available)) problems.push(`${label} is required, so at least one option must be in stock.`);
  });

  const save = async () => {
    setTouched(true);
    if (problems.length) return;
    const input: OptionGroupInput[] = draft.map((g) => ({
      ...(g.id ? { id: g.id } : {}),
      name: g.name.trim(),
      min_select: g.rule === "one" ? 1 : 0,
      max_select: g.rule === "many" ? Number(g.max) : 1,
      options: g.options.map((o) => ({
        ...(o.id ? { id: o.id } : {}),
        name: o.name.trim(),
        price_cents: o.price.trim() ? (toCents(o.price) ?? 0) : 0,
        is_default: o.is_default,
        is_available: o.is_available,
      })),
    }));
    const ok = await run(() => backend().saveItemOptions(item.id, input), "Choices saved.");
    if (ok) setDirty(false);
  };

  return (
    <section className="mt-5 border-t border-line pt-4" aria-label={`Choices for ${item.name}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="font-extrabold">Choices</h4>
        <p className="text-small text-ink-500">Size, spice level, add-ons. Extra prices are added to {money(item.price_cents)}.</p>
      </div>

      {draft.length === 0 && <p className="mt-2 text-label text-ink-500">No choices: customers add this dish straight to the cart.</p>}

      <div className="mt-3 space-y-4">
        {draft.map((g, gi) => (
          <div key={g.id ?? `new-${gi}`} className="rounded-md border border-line bg-white p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <label className="text-small font-bold text-ink-700">
                Choice name
                <input className={cn(inputClass, "mt-1 h-10")} value={g.name} maxLength={40} placeholder="e.g. Spice level" onChange={(e) => edit((d) => void (d[gi].name = e.target.value))} />
              </label>
              <div className="flex items-end gap-2">
                <label className="text-small font-bold text-ink-700">
                  Customer picks
                  <select className={cn(inputClass, "mt-1 h-10 pr-8")} value={g.rule} onChange={(e) => edit((d) => void (d[gi].rule = e.target.value as Rule))}>
                    <option value="one">Exactly one (required)</option>
                    <option value="optional-one">One or none</option>
                    <option value="many">Any, up to…</option>
                  </select>
                </label>
                {g.rule === "many" && (
                  <span className="w-16 shrink-0">
                    <input
                      className={cn(inputClass, "h-10")}
                      inputMode="numeric"
                      value={g.max}
                      aria-label="Up to how many"
                      onChange={(e) => edit((d) => void (d[gi].max = e.target.value.replace(/\D/g, "").slice(0, 2)))}
                    />
                  </span>
                )}
                <div className="flex">
                  <button type="button" className="hit-44 relative rounded p-2 text-ink-500 hover:bg-surface-1 disabled:opacity-30" disabled={gi === 0} aria-label="Move up" onClick={() => edit((d) => void d.splice(gi - 1, 0, d.splice(gi, 1)[0]))}>
                    <ArrowUp className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="hit-44 relative rounded p-2 text-ink-500 hover:bg-surface-1 disabled:opacity-30" disabled={gi === draft.length - 1} aria-label="Move down" onClick={() => edit((d) => void d.splice(gi + 1, 0, d.splice(gi, 1)[0]))}>
                    <ArrowDown className="size-4" aria-hidden />
                  </button>
                  <button type="button" className="hit-44 relative rounded p-2 text-chili-600 hover:bg-chili-50" aria-label={`Remove ${g.name || "this choice"}`} onClick={() => edit((d) => void d.splice(gi, 1))}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </div>
            </div>

            <table className="mt-3 w-full text-label">
              <thead className="text-left text-small text-ink-500">
                <tr>
                  <th className="pb-1 font-bold">Option</th>
                  <th className="w-28 pb-1 font-bold">Extra price</th>
                  <th className="w-20 pb-1 text-center font-bold">Default</th>
                  <th className="w-20 pb-1 text-center font-bold">In stock</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {g.options.map((o, oi) => (
                  <tr key={o.id ?? `new-${oi}`}>
                    <td className="py-1 pr-2">
                      <input className={cn(inputClass, "h-9")} value={o.name} maxLength={40} placeholder="e.g. Medium" aria-label="Option name" onChange={(e) => edit((d) => void (d[gi].options[oi].name = e.target.value))} />
                    </td>
                    <td className="py-1 pr-2">
                      <span className="relative block">
                        <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-500">+$</span>
                        <input className={cn(inputClass, "h-9 pl-7 tabular-nums")} inputMode="decimal" value={o.price} placeholder="0.00" aria-label="Extra price" onChange={(e) => edit((d) => void (d[gi].options[oi].price = e.target.value))} />
                      </span>
                    </td>
                    <td className="py-1 text-center">
                      <input
                        type="checkbox"
                        className="size-4.5 accent-ember-600"
                        checked={o.is_default}
                        aria-label="Picked by default"
                        onChange={(e) =>
                          edit((d) => {
                            if (d[gi].rule !== "many" && e.target.checked) d[gi].options.forEach((x) => (x.is_default = false));
                            d[gi].options[oi].is_default = e.target.checked;
                          })
                        }
                      />
                    </td>
                    <td className="py-1 text-center">
                      <input type="checkbox" className="size-4.5 accent-ember-600" checked={o.is_available} aria-label="In stock" onChange={(e) => edit((d) => void (d[gi].options[oi].is_available = e.target.checked))} />
                    </td>
                    <td className="py-1 text-right">
                      <button type="button" className="hit-44 relative rounded p-1.5 text-ink-500 hover:bg-surface-1" aria-label={`Remove ${o.name || "option"}`} onClick={() => edit((d) => void d[gi].options.splice(oi, 1))}>
                        <Trash2 className="size-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-1 text-label font-bold text-ember-700 hover:underline"
              onClick={() => edit((d) => void d[gi].options.push({ name: "", price: "", is_default: false, is_available: true }))}
            >
              <Plus className="size-4" aria-hidden /> Add option
            </button>
          </div>
        ))}
      </div>

      {touched && problems.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-small font-semibold text-chili-600" role="alert">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => edit((d) => void d.push({ name: "", rule: "one", max: "3", options: [{ name: "", price: "", is_default: true, is_available: true }] }))}
        >
          <Plus className="size-4" aria-hidden /> Add a choice
        </Button>
        {dirty && (
          <Button size="sm" onClick={save}>
            Save choices
          </Button>
        )}
      </div>
    </section>
  );
}
