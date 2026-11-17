import { Suspense } from "react";
import { StallScreen, StallSkeleton } from "@/components/stall-screen";

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
