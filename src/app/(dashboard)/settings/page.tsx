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
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Estado de integraciones</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.name}
              className="flex items-start justify-between gap-4 rounded-lg border border-white/8 p-4"
            >
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">{integration.name}</p>
                <p className="text-xs text-muted-foreground">{integration.description}</p>
                <p className="text-[11px] text-muted-foreground/70">
                  Variables: <code className="font-mono">{integration.envVars.join(", ")}</code>
                </p>
              </div>
              <Badge variant={integration.configured ? "positive" : "neutral"} className="shrink-0">
                {integration.configured ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <CircleDashed className="size-3" />
                )}
                {integration.configured ? "Configurado" : "Modo mock"}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sobre este MVP</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            ANLUX Ads Intelligence está funcionando en modo demo: todos los datos que ves (clientes,
            campañas, métricas) son simulados para poder evaluar el producto antes de conectar
            credenciales reales.
          </p>
          <p>
            Cuando se configuren las variables de entorno de Meta, Supabase y Anthropic (ver
            <code className="mx-1 font-mono">.env.example</code>), cada integración se activará sin
            cambios en la interfaz.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
