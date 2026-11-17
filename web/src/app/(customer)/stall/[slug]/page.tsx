import type { Metadata } from "next";
import { Suspense } from "react";
import catalog from "@/data/catalog.json";
import { StallScreen, StallSkeleton } from "@/components/stall-screen";

/** Tab title from the seed catalog: "<truck> · Open Sky Food Park" (the layout adds the park name). */
export async function generateMetadata({ params }: PageProps<"/stall/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const stall = catalog.stalls.find((s) => s.slug === slug);
  return stall ? { title: stall.name } : {};
}

export default function StallPage({ params }: PageProps<"/stall/[slug]">) {
  return (
    <Suspense fallback={<StallSkeleton />}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: Pick<PageProps<"/stall/[slug]">, "params">) {
  const { slug } = await params;
  return <StallScreen slug={slug} />;
}
