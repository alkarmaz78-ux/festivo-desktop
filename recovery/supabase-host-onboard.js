import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"POST, OPTIONS","Content-Type":"application/json"};
const json=(d:any,s=200)=>new Response(JSON.stringify(d),{status:s,headers:cors});
const code=()=> "EV"+crypto.randomUUID().replaceAll("-","").slice(0,8).toUpperCase();
const token=()=>crypto.randomUUID()+crypto.randomUUID();
async function attachDisplay(db:any,events:any[]){
 if(!events.length)return events;
 const ids=events.map((x:any)=>x.id);
 const q=await db.from("settings").select("event_id,display_title,display_theme").in("event_id",ids);
 if(q.error)throw q.error;
 const map=new Map((q.data||[]).map((x:any)=>[x.event_id,x]));
 return events.map((e:any)=>{const s:any=map.get(e.id)||{};return {...e,display_title:s.display_title||"FESTIVO",display_theme:s.display_theme||"birthday"};});
}
Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors});
 if(req.method!=="POST")return json({error:"Method not allowed"},405);
 try{
  const auth=req.headers.get("Authorization"),url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!,svc=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if(!auth?.startsWith("Bearer "))return json({error:"Unauthorized"},401);
  const uc=createClient(url,anon,{global:{headers:{Authorization:auth}}}),gu=await uc.auth.getUser();
  if(gu.error||!gu.data.user)return json({error:"Unauthorized"},401);
  const u=gu.data.user,b:any=await req.json().catch(()=>({})),full=String(b.full_name||u.user_metadata?.full_name||"").trim().slice(0,100),company=String(b.company_name||"").trim().slice(0,120),action=String(b.action||"init"),db=createClient(url,svc);
  if(!full)return json({error:"Введите имя"},400);
  let h:any=(await db.from("host_accounts").select("*").eq("auth_user_id",u.id).maybeSingle()).data;
  if(!h){const q=await db.from("host_accounts").insert({auth_user_id:u.id,phone:u.phone||b.phone||null,full_name:full,company_name:company||null,telegram_bot_id:b.telegram_id?Number(b.telegram_id):null,telegram_bot_username:b.telegram_username||null,telegram_connected:!!b.telegram_id}).select().single();if(q.error)return json({error:q.error.message},500);h=q.data}
  else {const q=await db.from("host_accounts").update({full_name:full,company_name:company||h.company_name,telegram_bot_id:b.telegram_id?Number(b.telegram_id):h.telegram_bot_id,telegram_bot_username:b.telegram_username||h.telegram_bot_username,telegram_connected:b.telegram_id?true:h.telegram_connected}).eq("id",h.id).select().single();if(q.data)h=q.data}
  if(action==="update_event_display"){
   const eventId=String(b.event_id||"").trim();
   if(!eventId)return json({error:"Не передан ID мероприятия"},400);
   const linkCheck=await db.from("host_events").select("event_id").eq("host_id",h.id).eq("event_id",eventId).maybeSingle();
   if(linkCheck.error)return json({error:linkCheck.error.message},500);
   if(!linkCheck.data)return json({error:"Мероприятие не найдено в вашем кабинете"},404);
   const owned=await db.from("events").select("id").eq("id",eventId).eq("owner_id",h.id).maybeSingle();
   if(owned.error)return json({error:owned.error.message},500);
   if(!owned.data)return json({error:"Нет прав на изменение этого экрана"},403);
   const title=String(b.display_title||"FESTIVO").trim().slice(0,80)||"FESTIVO";
   const allowed=["birthday","wedding","corporate","newyear","anniversary"];
   const theme=allowed.includes(String(b.display_theme))?String(b.display_theme):"birthday";
   const saved=await db.from("settings").upsert({event_id:eventId,display_title:title,display_theme:theme},{onConflict:"event_id"});
   if(saved.error)return json({error:saved.error.message},500);
   const all=await db.from("host_events").select("event_id,events(id,name,code,status,admin_token,created_at)").eq("host_id",h.id).order("created_at",{ascending:true});
   if(all.error)return json({error:all.error.message},500);
   const events=(all.data||[]).map((x:any)=>x.events).filter(Boolean);
   return json({host:h,events:await attachDisplay(db,events),display_updated:true});
  }
  if(action==="delete_event"){
   const eventId=String(b.event_id||"").trim();
   if(!eventId)return json({error:"Не передан ID мероприятия"},400);
   const link=await db.from("host_events").select("event_id").eq("host_id",h.id).eq("event_id",eventId).maybeSingle();
   if(link.error)return json({error:link.error.message},500);
   if(!link.data)return json({error:"Мероприятие не найдено в вашем кабинете"},404);
   const owned=await db.from("events").select("id").eq("id",eventId).eq("owner_id",h.id).maybeSingle();
   if(owned.error)return json({error:owned.error.message},500);
   if(!owned.data)return json({error:"Нет прав на удаление этого мероприятия"},403);
   for(const [table,col] of [["submissions","event_id"],["guests","event_id"],["settings","event_id"]] as const){
    const q=await db.from(table).delete().eq(col,eventId);
    if(q.error)return json({error:"Не удалось очистить "+table+": "+q.error.message},500);
   }
   const linksDelete=await db.from("host_events").delete().eq("event_id",eventId);
   if(linksDelete.error)return json({error:"Не удалось удалить связи мероприятия: "+linksDelete.error.message},500);
   const eventDelete=await db.from("events").delete().eq("id",eventId).eq("owner_id",h.id);
   if(eventDelete.error)return json({error:"Не удалось удалить мероприятие: "+eventDelete.error.message},500);
   const remaining=(await db.from("host_events").select("event_id,events(id,name,code,status,admin_token,created_at)").eq("host_id",h.id).order("created_at",{ascending:true})).data||[];
   return json({host:h,events:await attachDisplay(db,remaining.map((x:any)=>x.events).filter(Boolean)),deleted:true,deleted_event_id:eventId});
  }
  const links=(await db.from("host_events").select("event_id,events(id,name,code,status,admin_token,created_at)").eq("host_id",h.id).order("created_at",{ascending:true})).data||[];
  let events=links.map((x:any)=>x.events).filter(Boolean);
  if(action==="create_event"||(action==="init"&&!events.length)){
   const name=String(b.event_name||"Моё мероприятие").trim().slice(0,120)||"Моё мероприятие";
   const q=await db.from("events").insert({name,code:code(),status:"live",admin_token:token(),owner_id:h.id}).select().single();if(q.error)return json({error:q.error.message},500);
   const st=await db.from("settings").insert({event_id:q.data.id,max_song_requests_per_guest:1,telegram_enabled:!!h.telegram_connected});if(st.error)return json({error:st.error.message},500);
   const lk=await db.from("host_events").insert({host_id:h.id,event_id:q.data.id});if(lk.error)return json({error:lk.error.message},500);
   events=[...events,q.data];
  }
  return json({host:h,events:await attachDisplay(db,events)});
 }catch(e){return json({error:String(e)},500)}
});