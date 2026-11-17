import type { Metadata } from "next";
import { PartnerScreen } from "@/components/partner-screen";

export const metadata: Metadata = { title: "Stall dashboard", robots: { index: false } };

export default function PartnerPage() {
  return <PartnerScreen />;
}
