import { NextResponse } from "next/server";
import { checkMetaHealth } from "@/lib/meta/real/health";

/**
 * Estado de la conexión con Meta: validez del token, acceso al Business
 * Manager configurado y cuentas publicitarias accesibles.
 *
 * Solo lectura (dos GET a Graph API) y nunca devuelve la credencial: el
 * informe contiene estados y mensajes ya saneados, jamás el token.
 *
 * Siempre responde 200 aunque la conexión esté rota: el fallo es el
 * contenido de la respuesta, no un error de este endpoint. Así la página de
 * Configuración puede mostrar el diagnóstico en lugar de un error opaco.
 */
export async function GET() {
  try {
    return NextResponse.json(await checkMetaHealth());
  } catch (err) {
    console.error("[meta] fallo inesperado al comprobar el estado:", err instanceof Error ? err.message : "desconocido");
    return NextResponse.json(
      {
        status: "temporary_error",
        summary: "No se pudo completar la comprobación de estado. Vuelve a intentarlo en unos minutos.",
        checks: [],
        accounts: [],
        businessConfigured: false,
        checkedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
