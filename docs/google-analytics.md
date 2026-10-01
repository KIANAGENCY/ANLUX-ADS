# Google Analytics 4

The dashboard can send GA4 `page_view` events when `NEXT_PUBLIC_GA_MEASUREMENT_ID` is set to the web stream Measurement ID (`G-...`). The integration disables the initial automatic page view and sends one event on each Next.js route change, avoiding duplicate views in the single-page dashboard.

## Enable it

1. Copy the GA4 web stream Measurement ID from Google Analytics.
2. Add `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-...` to the Vercel project environments where analytics should run.
3. Redeploy and confirm route changes in GA4 Realtime or DebugView.

Without this variable, no Google Analytics script loads. Do not place credentials or service-account keys in this public variable.

This measures visits to the ANLUX Ads dashboard and website navigation. It does not count conversations that start inside WhatsApp, Messenger, or Instagram. Attributing those requires Meta message referral/webhook events and their campaign/ad identifiers; a GA4 browser tag alone cannot observe conversations inside those apps.
