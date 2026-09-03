import { AlertTriangle } from "lucide-react";

/** Error de una llamada real a Meta (token, permisos, rate limit, red...). Nunca contiene secretos. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-negative/30 bg-negative/8 px-4 py-3 text-sm">
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-negative" />
      <span className="text-negative">{message}</span>
    </div>
  );
}
