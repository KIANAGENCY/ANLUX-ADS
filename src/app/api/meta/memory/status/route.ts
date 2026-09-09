import { NextResponse } from "next/server";
import { getMemoryStatus } from "@/lib/memory/repository";

export async function GET() {
  try {
    return NextResponse.json(await getMemoryStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo verificar la memoria histórica.";
    return NextResponse.json({ state: "unavailable", enabled: true, message }, { status: 503 });
  }
}
