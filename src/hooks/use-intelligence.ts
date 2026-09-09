"use client";

import { useEffect, useMemo, useState } from "react";
import { useFilters } from "@/components/providers/filters-provider";
import type { BusinessGoals, IntelligenceSuiteResult } from "@/lib/intelligence/types";

const DEFAULT_GOALS: BusinessGoals = { riskTolerance: "balanced" };
interface RequestState { key:string; result:IntelligenceSuiteResult|null; error:string|null }
interface GoalsState { accountId:string; goals:BusinessGoals }
function readGoals(accountId:string):BusinessGoals { if(typeof window==="undefined"||!accountId)return DEFAULT_GOALS; try{const raw=localStorage.getItem(`anlux:goals:${accountId}`);return raw?{...DEFAULT_GOALS,...JSON.parse(raw)}:DEFAULT_GOALS;}catch{return DEFAULT_GOALS;} }

export function useIntelligence(){
 const {clientId,dateRange}=useFilters();
 const [goalsState,setGoalsState]=useState<GoalsState>(()=>({accountId:clientId,goals:readGoals(clientId)}));
 const goals=goalsState.accountId===clientId?goalsState.goals:readGoals(clientId);
 const query=useMemo(()=>{const p=new URLSearchParams({accountId:clientId,from:dateRange.from,to:dateRange.to,risk:goals.riskTolerance??"balanced"});if(goals.targetCostPerResult!=null)p.set("targetCpr",String(goals.targetCostPerResult));if(goals.minimumRoas!=null)p.set("minRoas",String(goals.minimumRoas));if(goals.monthlyBudget!=null)p.set("monthlyBudget",String(goals.monthlyBudget));if(goals.grossMarginPercent!=null)p.set("margin",String(goals.grossMarginPercent));return p.toString();},[clientId,dateRange.from,dateRange.to,goals]);
 const key=`${clientId}|${query}`; const [state,setState]=useState<RequestState|null>(null);
 useEffect(()=>{if(!clientId)return;let cancelled=false;fetch(`/api/meta/intelligence?${query}`,{cache:"no-store"}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error??"No se pudo calcular la inteligencia.");return data as IntelligenceSuiteResult;}).then(data=>{if(!cancelled)setState({key,result:data,error:null});}).catch(err=>{if(!cancelled)setState({key,result:null,error:err instanceof Error?err.message:"Error de inteligencia."});});return()=>{cancelled=true;};},[clientId,query,key]);
 function setGoals(next:BusinessGoals){setGoalsState({accountId:clientId,goals:next});if(clientId)localStorage.setItem(`anlux:goals:${clientId}`,JSON.stringify(next));}
 return {loading:Boolean(clientId)&&state?.key!==key,result:state?.key===key?state.result:null,error:state?.key===key?state.error:null,goals,setGoals};
}
