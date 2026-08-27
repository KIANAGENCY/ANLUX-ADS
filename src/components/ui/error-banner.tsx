import { AlertTriangle } from "lucide-react";

/** Error de una llamada real a Meta (token, permisos, rate limit, red...). Nunca contiene secretos. */
export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-negative/25 bg-negative/10 px-4 py-3 text-sm text-negative">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
