"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[][];
    gtag?: (...args: unknown[]) => void;
  }
}

const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const validMeasurementId = measurementId && /^G-[A-Z0-9]+$/i.test(measurementId) ? measurementId : null;

export function GoogleAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    if (!validMeasurementId || !window.gtag || !pathname) return;
    window.gtag("event", "page_view", { page_path: pathname });
  }, [pathname]);
  if (!validMeasurementId) return null;
  return <>
    <Script src={`https://www.googletagmanager.com/gtag/js?id=${validMeasurementId}`} strategy="afterInteractive" />
    <Script id="google-analytics-init" strategy="afterInteractive">
      {`window.dataLayer = window.dataLayer || []; window.gtag = function(){window.dataLayer.push(arguments);}; window.gtag('js', new Date()); window.gtag('config', '${validMeasurementId}', { send_page_view: false });`}
    </Script>
  </>;
}
