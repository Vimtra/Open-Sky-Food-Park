import type { Metadata } from "next";
import { AdminScreen } from "@/components/admin-screen";

export const metadata: Metadata = { title: "Admin panel", robots: { index: false } };

export default function AdminPage() {
  return <AdminScreen />;
}
