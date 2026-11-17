import type { Metadata, Viewport } from "next";
import { Figtree, Montserrat } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  display: "swap",
});

// The logo's "FOOD PARK" and tagline lettering (the artwork names a Montserrat cut).
const montserrat = Montserrat({
  variable: "--font-logo",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Open Sky Food Park · Order from every truck",
    template: "%s · Open Sky Food Park",
  },
  description:
    "Order from the food trucks at Open Sky Food Park in Milpitas. One cart across every stall, pay once, and collect with your token or have it brought to your table.",
  icons: { icon: "/brand/icon.svg", apple: "/brand/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#0b1230",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${figtree.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
