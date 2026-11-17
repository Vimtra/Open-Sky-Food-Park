import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderScreen } from "@/components/order-screen";

export const metadata: Metadata = { title: "Order status" };

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={null}>
      <Resolved params={params} />
    </Suspense>
  );
}

async function Resolved({ params }: Pick<PageProps<"/orders/[id]">, "params">) {
  const { id } = await params;
  return <OrderScreen id={id} />;
}
