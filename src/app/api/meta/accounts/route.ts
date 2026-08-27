import { NextResponse } from "next/server";
import { fetchAdAccounts } from "@/lib/meta/real/accounts";
import { metaErrorResponse } from "@/lib/meta/real/error-response";

/**
 * Descubre las cuentas publicitarias accesibles con `META_ACCESS_TOKEN`
 * (`/me/adaccounts`). El frontend usa este endpoint para saber si el modo
 * "Meta Real" está disponible y para poblar el selector de cuentas — nunca
 * ve el token, solo la lista de cuentas.
 */
export async function GET() {
  try {
    const accounts = await fetchAdAccounts();
    return NextResponse.json({ accounts });
  } catch (err) {
    return metaErrorResponse(err);
  }
}
