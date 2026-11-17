import type { Metadata } from "next";
import { OrdersScreen } from "@/components/account-screens";

export const metadata: Metadata = { title: "Your orders" };

export default function OrdersPage() {
  return <OrdersScreen />;
}
