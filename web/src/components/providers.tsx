"use client";

import { useEffect } from "react";
import { SWRConfig } from "swr";
import { useCart } from "@/lib/cart";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useCart.persist.rehydrate();
    // Keep the cart in step when it changes in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "osfp.cart") void useCart.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return <SWRConfig value={{ dedupingInterval: 1500, errorRetryCount: 2 }}>{children}</SWRConfig>;
}
