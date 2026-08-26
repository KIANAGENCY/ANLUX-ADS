import type { Ad, AdAccount, AdSet, Campaign, Client } from "@/lib/types";

export const MOCK_CLIENTS: Client[] = [
  {
    id: "orthobasic",
    name: "Orthobasic",
    slug: "orthobasic",
    industry: "Clínica de ortopedia y traumatología",
    initials: "OB",
    accentColor: "#6366f1",
    adAccountId: "acc_orthobasic",
  },
  {
    id: "hotel-expert",
    name: "Hotel Expert",
    slug: "hotel-expert",
    industry: "Viajes y hotelería",
    initials: "HE",
    accentColor: "#8b5cf6",
    adAccountId: "acc_hotelexpert",
  },
];

export const MOCK_AD_ACCOUNTS: AdAccount[] = [
  {
    id: "acc_orthobasic",
    clientId: "orthobasic",
    metaAccountId: "act_1029384756",
    currency: "USD",
    timezone: "America/Mexico_City",
  },
  {
    id: "acc_hotelexpert",
    clientId: "hotel-expert",
    metaAccountId: "act_5647382910",
    currency: "USD",
    timezone: "America/Cancun",
  },
];

export const MOCK_CAMPAIGNS: Campaign[] = [
  // --- Orthobasic ---------------------------------------------------------
  {
    id: "camp_ob_leads_rodilla",
    adAccountId: "acc_orthobasic",
    name: "[Leads] Consulta rodilla y cadera",
    status: "ACTIVE",
    objective: "LEAD_GENERATION",
    dailyBudget: 45,
    startDate: "2026-04-01",
  },
  {
    id: "camp_ob_msg_whatsapp",
    adAccountId: "acc_orthobasic",
    name: "[Mensajes] Agenda tu cita por WhatsApp",
    status: "ACTIVE",
    objective: "MESSAGES",
    dailyBudget: 30,
    startDate: "2026-03-15",
  },
  {
    id: "camp_ob_conv_landing",
    adAccountId: "acc_orthobasic",
    name: "[Conversión] Landing valoración gratuita",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    dailyBudget: 25,
    startDate: "2026-05-01",
  },
  {
    id: "camp_ob_brand_awareness",
    adAccountId: "acc_orthobasic",
    name: "[Awareness] Reconocimiento de marca CDMX",
    status: "PAUSED",
    objective: "BRAND_AWARENESS",
    dailyBudget: 15,
    startDate: "2026-02-10",
  },
  {
    id: "camp_ob_retargeting",
    adAccountId: "acc_orthobasic",
    name: "[Retargeting] Visitantes web últimos 30 días",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    dailyBudget: 18,
    startDate: "2026-05-20",
  },

  // --- Hotel Expert --------------------------------------------------------
  {
    id: "camp_he_sales_verano",
    adAccountId: "acc_hotelexpert",
    name: "[Ventas] Promoción paquetes de verano",
    status: "ACTIVE",
    objective: "SALES",
    dailyBudget: 60,
    startDate: "2026-04-10",
  },
  {
    id: "camp_he_traffic_blog",
    adAccountId: "acc_hotelexpert",
    name: "[Tráfico] Guías de destino - blog",
    status: "ACTIVE",
    objective: "TRAFFIC",
    dailyBudget: 20,
    startDate: "2026-03-01",
  },
  {
    id: "camp_he_leads_grupos",
    adAccountId: "acc_hotelexpert",
    name: "[Leads] Cotización viajes en grupo",
    status: "ACTIVE",
    objective: "LEAD_GENERATION",
    dailyBudget: 35,
    startDate: "2026-04-22",
  },
  {
    id: "camp_he_conv_ofertas",
    adAccountId: "acc_hotelexpert",
    name: "[Conversión] Ofertas relámpago fin de semana",
    status: "ACTIVE",
    objective: "CONVERSIONS",
    dailyBudget: 40,
    startDate: "2026-05-05",
  },
  {
    id: "camp_he_brand_nuevo_hotel",
    adAccountId: "acc_hotelexpert",
    name: "[Awareness] Apertura nuevo hotel Tulum",
    status: "PAUSED",
    objective: "BRAND_AWARENESS",
    dailyBudget: 22,
    startDate: "2026-02-25",
  },
  {
    id: "camp_he_msg_concierge",
    adAccountId: "acc_hotelexpert",
    name: "[Mensajes] Concierge virtual por WhatsApp",
    status: "IN_REVIEW",
    objective: "MESSAGES",
    dailyBudget: 12,
    startDate: "2026-06-01",
  },
];

export const MOCK_AD_SETS: AdSet[] = [
  // camp_ob_leads_rodilla
  {
    id: "adset_ob1_25_45",
    campaignId: "camp_ob_leads_rodilla",
    name: "Mujeres y hombres 30-55, dolor articular",
    status: "ACTIVE",
    dailyBudget: 25,
    audience: "30-55 años · CDMX y área metropolitana · Intereses: fisioterapia, artritis",
    optimizationGoal: "Leads",
    startDate: "2026-04-01",
  },
  {
    id: "adset_ob1_deportistas",
    campaignId: "camp_ob_leads_rodilla",
    name: "Deportistas amateur con lesiones",
    status: "ACTIVE",
    dailyBudget: 20,
    audience: "22-45 años · CDMX · Intereses: running, CrossFit, fútbol amateur",
    optimizationGoal: "Leads",
    startDate: "2026-04-05",
  },
  // camp_ob_msg_whatsapp
  {
    id: "adset_ob2_lookalike",
    campaignId: "camp_ob_msg_whatsapp",
    name: "Lookalike 1% pacientes actuales",
    status: "ACTIVE",
    dailyBudget: 18,
    audience: "Lookalike 1% · México · Basado en pacientes con cita agendada",
    optimizationGoal: "Conversaciones",
    startDate: "2026-03-15",
  },
  {
    id: "adset_ob2_geo_local",
    campaignId: "camp_ob_msg_whatsapp",
    name: "Segmentación geográfica clínica",
    status: "ACTIVE",
    dailyBudget: 12,
    audience: "25-65 años · Radio 8km de la clínica · Todos los intereses",
    optimizationGoal: "Conversaciones",
    startDate: "2026-03-18",
  },
  // camp_ob_conv_landing
  {
    id: "adset_ob3_retarget_web",
    campaignId: "camp_ob_conv_landing",
    name: "Visitantes landing sin conversión",
    status: "ACTIVE",
    dailyBudget: 25,
    audience: "Custom audience · Visitaron landing, no agendaron",
    optimizationGoal: "Conversiones en landing",
    startDate: "2026-05-01",
  },
  // camp_ob_brand_awareness (paused)
  {
    id: "adset_ob4_amplio",
    campaignId: "camp_ob_brand_awareness",
    name: "Audiencia amplia CDMX",
    status: "PAUSED",
    dailyBudget: 15,
    audience: "25-65 años · CDMX · Amplia",
    optimizationGoal: "Alcance",
    startDate: "2026-02-10",
  },
  // camp_ob_retargeting
  {
    id: "adset_ob5_carrito",
    campaignId: "camp_ob_retargeting",
    name: "Visitantes últimos 30 días",
    status: "ACTIVE",
    dailyBudget: 18,
    audience: "Custom audience · Todos los visitantes web 30 días",
    optimizationGoal: "Conversiones",
    startDate: "2026-05-20",
  },

  // --- Hotel Expert ---------------------------------------------------------
  {
    id: "adset_he1_familias",
    campaignId: "camp_he_sales_verano",
    name: "Familias planificando vacaciones",
    status: "ACTIVE",
    dailyBudget: 30,
    audience: "28-50 años · México · Intereses: viajes en familia, playa",
    optimizationGoal: "Ventas por catálogo",
    startDate: "2026-04-10",
  },
  {
    id: "adset_he1_parejas",
    campaignId: "camp_he_sales_verano",
    name: "Parejas sin hijos, escapadas",
    status: "ACTIVE",
    dailyBudget: 30,
    audience: "25-40 años · México y USA · Intereses: viajes románticos, resorts",
    optimizationGoal: "Ventas por catálogo",
    startDate: "2026-04-12",
  },
  {
    id: "adset_he2_blog_organico",
    campaignId: "camp_he_traffic_blog",
    name: "Interesados en destinos de playa",
    status: "ACTIVE",
    dailyBudget: 20,
    audience: "20-55 años · LATAM · Intereses: blogs de viaje, mochileros",
    optimizationGoal: "Clics en el enlace",
    startDate: "2026-03-01",
  },
  {
    id: "adset_he3_empresas",
    campaignId: "camp_he_leads_grupos",
    name: "Coordinadores de viajes corporativos",
    status: "ACTIVE",
    dailyBudget: 20,
    audience: "30-55 años · México · Cargo: RRHH, administración",
    optimizationGoal: "Leads",
    startDate: "2026-04-22",
  },
  {
    id: "adset_he3_bodas",
    campaignId: "camp_he_leads_grupos",
    name: "Grupos de bodas y despedidas",
    status: "ACTIVE",
    dailyBudget: 15,
    audience: "24-40 años · México · Intereses: bodas, despedidas de soltera",
    optimizationGoal: "Leads",
    startDate: "2026-04-25",
  },
  {
    id: "adset_he4_remarketing",
    campaignId: "camp_he_conv_ofertas",
    name: "Remarketing carritos abandonados",
    status: "ACTIVE",
    dailyBudget: 25,
    audience: "Custom audience · Iniciaron reserva sin completar",
    optimizationGoal: "Compras",
    startDate: "2026-05-05",
  },
  {
    id: "adset_he4_lookalike_compradores",
    campaignId: "camp_he_conv_ofertas",
    name: "Lookalike 2% compradores",
    status: "ACTIVE",
    dailyBudget: 15,
    audience: "Lookalike 2% · México · Basado en compradores últimos 180 días",
    optimizationGoal: "Compras",
    startDate: "2026-05-08",
  },
  {
    id: "adset_he5_amplio_tulum",
    campaignId: "camp_he_brand_nuevo_hotel",
    name: "Audiencia amplia interesados en Tulum",
    status: "PAUSED",
    dailyBudget: 22,
    audience: "22-55 años · México y USA · Intereses: Tulum, boutique hotels",
    optimizationGoal: "Alcance",
    startDate: "2026-02-25",
  },
  {
    id: "adset_he6_concierge",
    campaignId: "camp_he_msg_concierge",
    name: "Huéspedes con reserva activa",
    status: "IN_REVIEW",
    dailyBudget: 12,
    audience: "Custom audience · Reserva confirmada próximos 60 días",
    optimizationGoal: "Conversaciones",
    startDate: "2026-06-01",
  },
];

const CREATIVE_GRADIENTS = [
  "from-indigo-500 to-purple-600",
  "from-blue-500 to-indigo-600",
  "from-purple-500 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
  "from-violet-500 to-purple-700",
  "from-blue-600 to-violet-600",
];

function buildAds(
  adSetId: string,
  campaignId: string,
  names: Array<{ name: string; type: Ad["creativeType"]; status?: Ad["status"] }>,
  startDate: string
): Ad[] {
  return names.map((entry, index) => ({
    id: `${adSetId}_ad${index + 1}`,
    adSetId,
    campaignId,
    name: entry.name,
    status: entry.status ?? "ACTIVE",
    creativeType: entry.type,
    previewGradient: CREATIVE_GRADIENTS[(adSetId.length + index) % CREATIVE_GRADIENTS.length],
    startDate,
  }));
}

export const MOCK_ADS: Ad[] = [
  ...buildAds(
    "adset_ob1_25_45",
    "camp_ob_leads_rodilla",
    [
      { name: "Video · Testimonio paciente rodilla", type: "VIDEO" },
      { name: "Imagen · Antes y después de rehabilitación", type: "IMAGE" },
      { name: "Carrusel · 3 tratamientos sin cirugía", type: "CAROUSEL" },
    ],
    "2026-04-01"
  ),
  ...buildAds(
    "adset_ob1_deportistas",
    "camp_ob_leads_rodilla",
    [
      { name: "Video · Regresa a correr sin dolor", type: "VIDEO" },
      { name: "Imagen · Lesión deportiva, consulta gratis", type: "IMAGE" },
    ],
    "2026-04-05"
  ),
  ...buildAds(
    "adset_ob2_lookalike",
    "camp_ob_msg_whatsapp",
    [
      { name: "Imagen · Agenda por WhatsApp en 1 clic", type: "IMAGE" },
      { name: "Video · Recorrido virtual de la clínica", type: "VIDEO" },
      { name: "Imagen · Doctor responde tus dudas", type: "IMAGE" },
    ],
    "2026-03-15"
  ),
  ...buildAds(
    "adset_ob2_geo_local",
    "camp_ob_msg_whatsapp",
    [
      { name: "Imagen · Clínica cerca de ti", type: "IMAGE" },
      { name: "Carrusel · Especialidades disponibles", type: "CAROUSEL" },
    ],
    "2026-03-18"
  ),
  ...buildAds(
    "adset_ob3_retarget_web",
    "camp_ob_conv_landing",
    [
      { name: "Imagen · No dejes tu valoración a medias", type: "IMAGE" },
      { name: "Video · Últimos lugares esta semana", type: "VIDEO" },
    ],
    "2026-05-01"
  ),
  ...buildAds(
    "adset_ob4_amplio",
    "camp_ob_brand_awareness",
    [{ name: "Imagen · Somos Orthobasic", type: "IMAGE", status: "PAUSED" }],
    "2026-02-10"
  ),
  ...buildAds(
    "adset_ob5_carrito",
    "camp_ob_retargeting",
    [
      { name: "Imagen · Todavía tienes dudas sobre tu tratamiento", type: "IMAGE" },
      { name: "Video · Casos de éxito recientes", type: "VIDEO" },
    ],
    "2026-05-20"
  ),

  ...buildAds(
    "adset_he1_familias",
    "camp_he_sales_verano",
    [
      { name: "Carrusel · Paquetes todo incluido familia", type: "CAROUSEL" },
      { name: "Video · Un día en el resort", type: "VIDEO" },
      { name: "Imagen · 20% off reservando esta semana", type: "IMAGE" },
    ],
    "2026-04-10"
  ),
  ...buildAds(
    "adset_he1_parejas",
    "camp_he_sales_verano",
    [
      { name: "Video · Escapada romántica frente al mar", type: "VIDEO" },
      { name: "Imagen · Suite con vista al mar -15%", type: "IMAGE" },
    ],
    "2026-04-12"
  ),
  ...buildAds(
    "adset_he2_blog_organico",
    "camp_he_traffic_blog",
    [
      { name: "Imagen · Top 10 playas cerca de Cancún", type: "IMAGE" },
      { name: "Carrusel · Guía completa de Tulum", type: "CAROUSEL" },
    ],
    "2026-03-01"
  ),
  ...buildAds(
    "adset_he3_empresas",
    "camp_he_leads_grupos",
    [{ name: "Imagen · Cotiza tu viaje corporativo", type: "IMAGE" }],
    "2026-04-22"
  ),
  ...buildAds(
    "adset_he3_bodas",
    "camp_he_leads_grupos",
    [
      { name: "Video · Bodas de destino inolvidables", type: "VIDEO" },
      { name: "Carrusel · Paquetes para despedidas", type: "CAROUSEL" },
    ],
    "2026-04-25"
  ),
  ...buildAds(
    "adset_he4_remarketing",
    "camp_he_conv_ofertas",
    [
      { name: "Imagen · Tu reserva te espera", type: "IMAGE" },
      { name: "Video · Solo por hoy: oferta relámpago", type: "VIDEO" },
    ],
    "2026-05-05"
  ),
  ...buildAds(
    "adset_he4_lookalike_compradores",
    "camp_he_conv_ofertas",
    [{ name: "Carrusel · Los favoritos de nuestros huéspedes", type: "CAROUSEL" }],
    "2026-05-08"
  ),
  ...buildAds(
    "adset_he5_amplio_tulum",
    "camp_he_brand_nuevo_hotel",
    [{ name: "Video · Gran apertura Tulum", type: "VIDEO", status: "PAUSED" }],
    "2026-02-25"
  ),
  ...buildAds(
    "adset_he6_concierge",
    "camp_he_msg_concierge",
    [{ name: "Imagen · Tu concierge virtual 24/7", type: "IMAGE", status: "IN_REVIEW" }],
    "2026-06-01"
  ),
];
