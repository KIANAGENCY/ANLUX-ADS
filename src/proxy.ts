import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

const PROTECTED_PAGE_PREFIXES = ["/overview","/campaigns","/adsets","/ads","/creatives","/intelligence","/decisions","/ai-analyst","/alerts","/settings"];
const PROTECTED_API_PREFIXES = ["/api/meta", "/api/ai"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function matchesPrefix(pathname:string,prefixes:readonly string[]){return prefixes.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));}
function apiError(message:string,status:401|403|503){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});}
function hasCrossSiteOrigin(request:NextRequest){if(!UNSAFE_METHODS.has(request.method))return false;const origin=request.headers.get("origin");return Boolean(origin&&origin!==request.nextUrl.origin);}
export async function proxy(request:NextRequest){
 const {pathname}=request.nextUrl; const protectedPage=matchesPrefix(pathname,PROTECTED_PAGE_PREFIXES); const protectedApi=matchesPrefix(pathname,PROTECTED_API_PREFIXES);
 if(!isSupabaseConfigured()){if(protectedApi)return apiError("Autenticación no disponible: Supabase no está configurado.",503);if(protectedPage)return NextResponse.redirect(new URL("/login",request.url));return NextResponse.next();}
 if(protectedApi&&hasCrossSiteOrigin(request))return apiError("Origen de solicitud no permitido.",403);
 let response=NextResponse.next({request});
 const supabase=createServerClient(supabaseUrl!,supabasePublishableKey!,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookies){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await supabase.auth.getUser();
 if(!user&&protectedApi)return apiError("No autorizado. Inicia sesión para acceder a esta API.",401);
 if(!user&&protectedPage)return NextResponse.redirect(new URL("/login",request.url));
 if(user&&pathname==="/login")return NextResponse.redirect(new URL("/overview",request.url));
 if(protectedApi)response.headers.set("Cache-Control","private, no-store, max-age=0"); return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
