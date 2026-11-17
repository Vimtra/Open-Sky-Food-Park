import type { Metadata } from "next";
import { Suspense } from "react";
import { ContactScreen } from "@/components/contact-screen";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Message the Open Sky Food Park team about an order, lost and found, feedback, or bringing your truck to the park.",
};

export default function ContactPage() {
  return (
    <Suspense fallback={null}>
      <ContactScreen />
    </Suspense>
  );
}
