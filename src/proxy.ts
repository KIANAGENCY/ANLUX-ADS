import { createServerClient } from "@supabase/ssr";
import { canAccessAnlux } from "@/lib/supabase/access";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "@/lib/supabase/config";

const PROTECTED_PAGE_PREFIXES = ["/today","/overview","/campaigns","/adsets","/ads","/creatives","/intelligence","/decisions","/ai-analyst","/alerts","/settings"];
const PROTECTED_API_PREFIXES = ["/api/meta", "/api/ai"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
function matchesPrefix(pathname:string,prefixes:readonly string[]){return prefixes.some(prefix=>pathname===prefix||pathname.startsWith(`${prefix}/`));}
function apiError(message:string,status:401|403|503){return NextResponse.json({error:message},{status,headers:{"Cache-Control":"private, no-store, max-age=0"}});}
function hasCrossSiteOrigin(request:NextRequest){if(!UNSAFE_METHODS.has(request.method))return false;const origin=request.headers.get("origin");return Boolean(origin&&origin!==request.nextUrl.origin);}
function makeCsp(request:NextRequest){
 const nonce=Buffer.from(crypto.randomUUID()).toString("base64");
 const dev=process.env.NODE_ENV==="development";
 const policy=[
  "default-src 'self'",
  `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://www.googletagmanager.com${dev?" 'unsafe-eval'":""}`,
  `style-src 'self' 'nonce-${nonce}' 'unsafe-inline'`,
  "img-src 'self' blob: data: https://*.fbcdn.net https://*.cdninstagram.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co https://graph.facebook.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://region1.google-analytics.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
 ].join("; ");
 const headers=new Headers(request.headers);
 headers.set("x-nonce",nonce);
 headers.set("Content-Security-Policy",policy);
 return {headers,policy};
}
export async function proxy(request:NextRequest){
 const {headers:requestHeaders,policy}=makeCsp(request);
 const next=()=>{const result=NextResponse.next({request:{headers:requestHeaders}});result.headers.set("Content-Security-Policy",policy);return result;};
 const redirect=(url:URL)=>{const result=NextResponse.redirect(url);result.headers.set("Content-Security-Policy",policy);return result;};
 const {pathname}=request.nextUrl; const protectedPage=matchesPrefix(pathname,PROTECTED_PAGE_PREFIXES); const protectedApi=matchesPrefix(pathname,PROTECTED_API_PREFIXES);
 if(!isSupabaseConfigured()){if(protectedApi)return apiError("Autenticación no disponible: Supabase no está configurado.",503);if(protectedPage)return redirect(new URL("/login",request.url));return next();}
 if(protectedApi&&hasCrossSiteOrigin(request))return apiError("Origen de solicitud no permitido.",403);
 let response=next();
 const supabase=createServerClient(supabaseUrl!,supabasePublishableKey!,{cookies:{getAll(){return request.cookies.getAll();},setAll(cookies){cookies.forEach(({name,value})=>request.cookies.set(name,value));response=next();cookies.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await supabase.auth.getUser();
 if(user&&!canAccessAnlux(user)&&protectedApi)return apiError("Tu cuenta necesita una invitación de ANLUX.",403);
 if(user&&!canAccessAnlux(user)&&protectedPage)return redirect(new URL("/access-required",request.url));
 if(!user&&protectedApi)return apiError("No autorizado. Inicia sesión para acceder a esta API.",401);
 if(!user&&protectedPage)return redirect(new URL("/login",request.url));
 if(user&&pathname==="/login")return redirect(new URL("/today",request.url));
 if(protectedApi)response.headers.set("Cache-Control","private, no-store, max-age=0"); return response;
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
