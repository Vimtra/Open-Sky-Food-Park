import type { Metadata } from "next";
import { HelpScreen } from "@/components/help-screen";

export const metadata: Metadata = {
  title: "Help & Support",
  description: "How ordering, tokens, pickup, table service and payment work at Open Sky Food Park, and how to reach us.",
};

export default function HelpPage() {
  return <HelpScreen />;
}
