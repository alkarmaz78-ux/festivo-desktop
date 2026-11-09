import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, OPTIONS"};
const out=(x,s=200)=>new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json",...cors}});
Deno.serve(async(req)=>{
 if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
 try{
  const u=new URL(req.url);
  const code=u.searchParams.get("event")||"SA2026";
  const db=createClient(Deno.env.get("SUPABASE_URL"),Deno.env.get("SUPABASE_"+"SERVICE_"+"ROLE_"+"KEY"));
  const {data:e,error:ee}=await db.from("events").select("id,code,status").eq("code",code).eq("status","live").limit(1).maybeSingle();
  if(ee)throw ee;if(!e)return out({error:"Event not found"},404);
  const {data:display,error:displayError}=await db.from("settings").select("display_title,display_theme").eq("event_id",e.id).maybeSingle();
  if(displayError)throw displayError;
  const {data,error}=await db.from("submissions").select("id,type,text_content,media_url,status,created_at,guest_id,featured_until,guests(nickname)").eq("event_id",e.id).in("status",["approved","played"]).order("featured_until",{ascending:false,nullsFirst:false}).order("created_at",{ascending:false}).limit(24);
  if(error)throw error;
  return out({event:e,display:{display_title:display?.display_title||"FESTIVO",display_theme:display?.display_theme||"birthday"},submissions:(data||[]).map(x=>({...x,nickname:x.guests?.nickname||""}))});
 }catch(e){return out({error:e?.message||"Server error"},500)}
});