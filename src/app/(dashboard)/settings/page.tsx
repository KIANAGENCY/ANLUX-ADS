import { CheckCircle2, CircleDashed } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isMetaApiConfigured } from "@/lib/meta/config";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { isAnthropicConfigured } from "@/lib/ai/claude-service";

const INTEGRATIONS = [
  {
    name: "Meta Marketing API",
    description: "Origen de campañas, ad sets, anuncios y métricas (lectura, vía app/api/meta/*).",
    envVars: ["META_ACCESS_TOKEN"],
    configured: isMetaApiConfigured(),
  },
  {
    name: "Supabase",
    description: "Autenticación y persistencia de datos.",
    envVars: ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"],
    configured: isSupabaseConfigured(),
  },
  {
    name: "Anthropic Claude",
    description: "Motor del AI Performance Analyst.",
    envVars: ["ANTHROPIC_API_KEY"],
    configured: isAnthropicConfigured(),
  },
];

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de integraciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-start justify-between gap-4 rounded-lg border border-border-subtle bg-background/40 p-4"
            >
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-foreground">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
                <p className="text-[11px] text-muted-foreground-2">
                  Variables: <code className="font-mono">{integration.envVars.join(", ")}</code>
                </p>
              </div>
              <Badge variant={integration.configured ? "positive" : "warning"} className="shrink-0">
                {integration.configured ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <CircleDashed className="size-3" />
                )}
                {integration.configured ? "Configurado" : "Sin configurar"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cómo leer este estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            &quot;Configurado&quot; significa únicamente que la variable de entorno existe en el servidor. No
            garantiza que la credencial siga siendo válida: un token de Meta caducado o revocado se sigue
            viendo aquí como configurado.
          </p>
          <p>
            El estado real de la conexión aparece en cada sección: si Meta rechaza el token, las páginas de
            Overview, Campañas, Conjuntos, Anuncios, Creativos y Alertas muestran el error devuelto por la API,
            sin sustituirlo por datos simulados.
          </p>
          <p>
            ANLUX funciona exclusivamente con datos reales de Meta Marketing API: no existe modo demo ni
            ningún conjunto de datos simulado. Si una cuenta no tiene actividad en el periodo seleccionado, las
            secciones muestran su estado vacío en lugar de rellenarlo con información inventada.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
