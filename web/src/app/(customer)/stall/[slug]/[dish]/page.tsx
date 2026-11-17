import type { Metadata } from "next";
import { Suspense } from "react";
import catalog from "@/data/catalog.json";
import { DishScreen, DishSkeleton } from "@/components/dish-screen";

/** Tab title from the seed catalog: "<dish> · <truck> · Open Sky Food Park" (the layout adds the park name). */
export async function generateMetadata({ params }: PageProps<"/stall/[slug]/[dish]">): Promise<Metadata> {
  const { slug, dish } = await params;
  const stall = catalog.stalls.find((s) => s.slug === slug);
  const item = stall && catalog.menu_items.find((m) => m.id === `${stall.id}.${decodeURIComponent(dish)}`);
  return item && stall ? { title: `${item.name} · ${stall.name}` } : {};
}

export default function DishPage({ params }: PageProps<"/stall/[slug]/[dish]">) {
  return (
    <Suspense fallback={<DishSkeleton />}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: Pick<PageProps<"/stall/[slug]/[dish]">, "params">) {
  const { slug, dish } = await params;
  return <DishScreen stallSlug={slug} dishSlug={decodeURIComponent(dish)} />;
}
