import type { CampaignObjective, CreativeType } from "@/lib/types";

export const OBJECTIVE_LABELS: Record<CampaignObjective, string> = {
  LEAD_GENERATION: "Generación de leads",
  MESSAGES: "Mensajes",
  CONVERSIONS: "Conversiones",
  TRAFFIC: "Tráfico",
  BRAND_AWARENESS: "Reconocimiento de marca",
  SALES: "Ventas",
};

export const CREATIVE_TYPE_LABELS: Record<CreativeType, string> = {
  IMAGE: "Imagen",
  VIDEO: "Video",
  CAROUSEL: "Carrusel",
};
