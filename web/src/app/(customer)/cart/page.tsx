import type { Metadata } from "next";
import { CartScreen } from "@/components/cart-screen";

export const metadata: Metadata = { title: "Your cart" };

export default function CartPage() {
  return <CartScreen />;
}
