import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountScreen } from "@/components/account-screens";

export const metadata: Metadata = { title: "Account" };

export default function AccountPage() {
  return (
    <Suspense fallback={null}>
      <AccountScreen />
    </Suspense>
  );
}
