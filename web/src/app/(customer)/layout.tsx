import { BottomNav } from "@/components/bottom-nav";
import { DemoNotice, SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export default function CustomerLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <DemoNotice />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <BottomNav />
    </>
  );
}
