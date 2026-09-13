"use client";

import { AlertCircle, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AccessRequiredPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/8 bg-surface p-6 shadow-2xl shadow-black/40">
        <div className="mb-5 flex size-10 items-center justify-center rounded-full bg-negative/10 text-negative">
          <AlertCircle className="size-5" />
        </div>
        <h1 className="text-lg font-semibold text-foreground">Acceso por invitación</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Esta cuenta existe en Supabase, pero todavía no tiene autorización para entrar a ANLUX Ads.
          El acceso se habilita únicamente mediante una invitación emitida por un administrador de ANLUX.
        </p>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Si crees que tu cuenta ya fue invitada, cierra sesión y vuelve a entrar después de aceptar el correo de invitación.
        </p>
        <Button type="button" variant="outline" className="mt-6 w-full" onClick={handleSignOut}>
          <LogOut className="size-4" />
          Cerrar sesión
        </Button>
      </div>
    </div>
  );
}
