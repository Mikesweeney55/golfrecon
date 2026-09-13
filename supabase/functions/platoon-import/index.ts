import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type",
};

const resultSchema={
  type:"object",
  additionalProperties:false,
  properties:{
    confidence:{type:"number"},
    warnings:{type:"array",items:{type:"string"}},
    event:{
      type:"object",
      additionalProperties:false,
      properties:{date:{type:["string","null"]},course_name:{type:["string","null"]}},
      required:["date","course_name"]
    },
    results:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          player_name:{type:"string"},gross:{type:["integer","null"]},net:{type:["integer","null"]},
          finish_position:{type:["integer","null"]},raw_points:{type:["number","null"]},eagle_count:{type:["integer","null"]}
        },
        required:["player_name","gross","net","finish_position","raw_points","eagle_count"]
      }
    }
  },
  required:["confidence","warnings","event","results"]
};


const holeDetailSchema={
  type:"object",
  additionalProperties:false,
  properties:{
    confidence:{type:"number"},
    warnings:{type:"array",items:{type:"string"}},
    players:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          player_name:{type:"string"},
          holes:{
            type:"array",
            items:{
              type:"object",
              additionalProperties:false,
              properties:{
                hole:{type:"integer"},
                par:{type:["integer","null"]},
                score:{type:["integer","null"]}
              },
              required:["hole","par","score"]
            }
          }
        },
        required:["player_name","holes"]
      }
    }
  },
  required:["confidence","warnings","players"]
};

function response(data:any,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
}
function text(v:any){return String(v??"").trim()}
function safeYear(v:any){const n=Number(v);return Number.isInteger(n)&&n>=2020&&n<=2100?n:new Date().getFullYear()}
function keyFor(v:any,fallback:string){const s=text(v);return s||fallback}
function schemaError(error:any){
  const m=String(error?.message||"");
  return error?.code==="42P01" || /does not exist/i.test(m) || /column .* does not exist/i.test(m);
}
async function requireUser(req:Request,supabase:any){
  const auth=req.headers.get("Authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"").trim();
  if(!token)throw new Error("AUTH_REQUIRED");
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data?.user)throw new Error("AUTH_REQUIRED");
  return data.user;
}

async function parseResults(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one results screenshot.");
  const mission=body.mission||{};
  const content:any[]=[{
    type:"input_text",
    text:`You are the Golf Recon Platoon Mission results parser.
Read screenshots from an 18Birdies league/tournament/event results screen.
Extract ONLY high-level event results that are actually visible. Never guess.

For each visible player, return:
- player_name exactly as shown
- gross score if visible, else null
- net score if visible, else null
- finish_position if explicitly shown or unambiguously ranked in the visible table, else null
- raw_points if event/league points are visible, else null
- eagle_count only if the screenshot explicitly establishes an eagle count for that player, else null

Do NOT create hole-by-hole data. Do NOT create a Golf Recon personal round. This parser is only for a Platoon Mission leaderboard/result record.
If the screenshots span multiple pages, merge duplicate player rows carefully and preserve only supported values.
If gross/net labels are ambiguous, leave the value null and add a warning.
Use YYYY-MM-DD only when a date is visible; otherwise null.

Selected Mission context for matching only (do not invent values from it):
${JSON.stringify({date:mission.date||null,course:mission.locationName||null,title:mission.title||null})}`
  }];
  for(const img of body.images){
    if(!img?.type||!img?.data)continue;
    content.push({type:"input_image",image_url:`data:${img.type};base64,${img.data}`,detail:"high"});
  }
  const ai=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"gpt-5.6",
      input:[{role:"user",content}],
      text:{format:{type:"json_schema",name:"golfrecon_platoon_results",strict:true,schema:resultSchema}}
    })
  });
  const raw=await ai.json();
  if(!ai.ok)throw new Error(raw?.error?.message||"Mission results parsing failed.");
  const outputText=raw.output_text??raw.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
  if(!outputText)throw new Error("No structured Mission results returned.");
  return JSON.parse(outputText);
}


async function parseHoleDetails(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one scorecard screenshot.");
  const mission=body.mission||{};
  const content:any[]=[{
    type:"input_text",
    text:`You are the Golf Recon Platoon hole-by-hole scorecard parser.
Read screenshots of individual player golf scorecards. Screenshots may show the front nine, back nine, or a full 18-hole card. Multiple screenshots may belong to the same player.

For each player whose name and scores are actually visible, return:
- player_name exactly as shown
- holes with the visible hole number
- par for that hole only when visible, otherwise null
- player score for that hole only when visible, otherwise null

Merge front-nine and back-nine screenshots for the same clearly identified player. Sort holes numerically and do not duplicate a hole.
Never guess a score, par, player identity, or missing hole.
Do NOT infer or overwrite gross, net, handicap, finish position, Mission points, or the official Mission leaderboard.
A displayed gross total may be used only as a consistency check; do not return it as official scoring.
If a screenshot is ambiguous, leave the uncertain value null and add a warning.

Selected Mission context is for matching only and must not be used to invent scores:
${JSON.stringify({date:mission.date||null,course:mission.locationName||null,title:mission.title||null})}`
  }];
  for(const img of body.images){
    if(!img?.type||!img?.data)continue;
    content.push({type:"input_image",image_url:`data:${img.type};base64,${img.data}`,detail:"high"});
  }
  const ai=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"gpt-5.6",
      input:[{role:"user",content}],
      text:{format:{type:"json_schema",name:"golfrecon_platoon_hole_details",strict:true,schema:holeDetailSchema}}
    })
  });
  const raw=await ai.json();
  if(!ai.ok)throw new Error(raw?.error?.message||"Hole-by-hole parsing failed.");
  const outputText=raw.output_text??raw.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
  if(!outputText)throw new Error("No structured hole-by-hole detail returned.");
  return JSON.parse(outputText);
}

async function activeMembership(supabase:any,userId:string){
  const {data,error}=await supabase.from("golfrecon_platoon_members")
    .select("id,platoon_id,role,status,client_key")
    .eq("user_id",userId).eq("status","active")
    .order("joined_at",{ascending:true}).limit(1).maybeSingle();
  if(error){if(schemaError(error))throw new Error("PLATOON_SCHEMA_NOT_READY");throw error}
  return data||null;
}

async function ensurePlatoon(supabase:any,user:any,snapshot:any){
  let membership=await activeMembership(supabase,user.id);
  if(membership)return {membership,created:false};

  const chiefName=text(snapshot?.chief)||text(snapshot?.members?.find((m:any)=>m?.role==="chief")?.name)||text(user.user_metadata?.username)||text(user.email?.split("@")[0])||"Golfer";
  const slug=`platoon-${user.id.slice(0,8)}-${Date.now().toString(36)}`;
  const {data:platoon,error:pErr}=await supabase.from("golfrecon_platoons").insert({
    name:text(snapshot?.name)||"My Time",slug,motto:text(snapshot?.motto)||null,
    season_year:safeYear(snapshot?.season),created_by:user.id,visibility:"private",
    logo_data_url:text(snapshot?.logoData)||null
  }).select("id").single();
  if(pErr){if(schemaError(pErr))throw new Error("PLATOON_SCHEMA_NOT_READY");throw pErr}
  const chiefKey=keyFor(snapshot?.members?.find((m:any)=>m?.role==="chief")?.id,"chief");
  const {data:member,error:mErr}=await supabase.from("golfrecon_platoon_members").insert({
    platoon_id:platoon.id,user_id:user.id,display_name:chiefName,role:"chief",status:"active",client_key:chiefKey
  }).select("id,platoon_id,role,status,client_key").single();
  if(mErr)throw mErr;
  membership=member;
  return {membership,created:true};
}

async function readPlatoonState(supabase:any,platoonId:string){
  const {data:p,error:pErr}=await supabase.from("golfrecon_platoons")
    .select("id,name,motto,season_year,visibility,logo_data_url,created_by").eq("id",platoonId).single();
  if(pErr)throw pErr;
  const {data:members,error:mErr}=await supabase.from("golfrecon_platoon_members")
    .select("id,user_id,display_name,nickname,role,status,client_key").eq("platoon_id",platoonId).eq("status","active").order("joined_at");
  if(mErr)throw mErr;
  const {data:missions,error:miErr}=await supabase.from("golfrecon_missions")
    .select("id,client_key,title,mission_type,status,played_on,tee_time,course_id,location_name,format,rules_notes,results_snapshot")
    .eq("platoon_id",platoonId).order("played_on",{ascending:true});
  if(miErr)throw miErr;
  const missionIds=(missions||[]).map((m:any)=>m.id);
  let participants:any[]=[];
  if(missionIds.length){
    const {data,error}=await supabase.from("golfrecon_mission_participants")
      .select("mission_id,platoon_member_id,participant_status").in("mission_id",missionIds);
    if(error)throw error; participants=data||[];
  }
  const memberKeyById=new Map((members||[]).map((m:any)=>[m.id,m.client_key||m.id]));
  const chief=(members||[]).find((m:any)=>m.role==="chief");
  const co=(members||[]).find((m:any)=>m.role==="co_chief");
  return {
    id:p.id,serverId:p.id,name:p.name,motto:p.motto||"",season:p.season_year,
    visibility:p.visibility==="invite_only"?"Invite only":"Private",logoData:p.logo_data_url||"",
    chief:chief?.display_name||"",coChief:co?.client_key||co?.id||"",
    members:(members||[]).map((m:any)=>({
      id:m.client_key||m.id,serverId:m.id,name:m.display_name,linked:!!m.user_id,role:m.role
    })),
    missions:(missions||[]).map((m:any)=>({
      id:m.client_key||m.id,serverId:m.id,date:m.played_on,teeTime:m.tee_time?String(m.tee_time).slice(0,5):"",
      type:m.mission_type,courseId:m.course_id||"",locationName:m.location_name,title:m.title||"",
      format:m.format||"",notes:m.rules_notes||"",status:m.status,
      participants:participants.filter((x:any)=>x.mission_id===m.id&&x.participant_status!=="withdrawn").map((x:any)=>memberKeyById.get(x.platoon_member_id)).filter(Boolean),
      results:Array.isArray(m.results_snapshot)?m.results_snapshot:[]
    }))
  };
}

async function upsertMembers(supabase:any,user:any,platoonId:string,snapshot:any,allowRoleChanges:boolean){
  const incoming=Array.isArray(snapshot?.members)?snapshot.members:[];
  const {data:existing,error}=await supabase.from("golfrecon_platoon_members")
    .select("id,user_id,display_name,role,status,client_key").eq("platoon_id",platoonId);
  if(error)throw error;
  const byKey=new Map((existing||[]).filter((m:any)=>m.client_key).map((m:any)=>[m.client_key,m]));
  const chiefRow=(existing||[]).find((m:any)=>m.role==="chief");
  const chiefIncoming=incoming.find((m:any)=>m.role==="chief")||incoming.find((m:any)=>m.linked);
  if(chiefRow&&chiefIncoming){
    await supabase.from("golfrecon_platoon_members").update({display_name:text(chiefIncoming.name)||chiefRow.display_name,client_key:keyFor(chiefIncoming.id,chiefRow.client_key||"chief")}).eq("id",chiefRow.id);
  }
  for(const m of incoming){
    const clientKey=keyFor(m?.id,`member-${crypto.randomUUID()}`);
    if(m?.role==="chief")continue;
    const found=byKey.get(clientKey);
    const role=allowRoleChanges?(m?.role==="co_chief"?"co_chief":(m?.linked?"member":"cadet")):(found?.role||"cadet");
    const row={display_name:text(m?.name)||"Cadet",client_key:clientKey,status:"active",role};
    if(found)await supabase.from("golfrecon_platoon_members").update(row).eq("id",found.id);
    else await supabase.from("golfrecon_platoon_members").insert({platoon_id:platoonId,user_id:null,...row});
  }
  if(allowRoleChanges){
    const wanted=text(snapshot?.coChief);
    const {data:rows,error:rErr}=await supabase.from("golfrecon_platoon_members").select("id,user_id,client_key,role").eq("platoon_id",platoonId).neq("role","chief");
    if(rErr)throw rErr;
    for(const r of rows||[]){
      const next=r.client_key===wanted?"co_chief":(r.user_id?"member":"cadet");
      if(r.role!==next)await supabase.from("golfrecon_platoon_members").update({role:next}).eq("id",r.id);
    }
  }
}

async function upsertMissions(supabase:any,user:any,platoonId:string,snapshot:any,overwrite:boolean){
  const incoming=Array.isArray(snapshot?.missions)?snapshot.missions:[];
  const {data:members,error:mErr}=await supabase.from("golfrecon_platoon_members").select("id,client_key").eq("platoon_id",platoonId).eq("status","active");
  if(mErr)throw mErr;
  const memberIdByKey=new Map((members||[]).map((m:any)=>[m.client_key||m.id,m.id]));
  const {data:existing,error:eErr}=await supabase.from("golfrecon_missions").select("id,client_key").eq("platoon_id",platoonId);
  if(eErr)throw eErr;
  const byKey=new Map((existing||[]).filter((m:any)=>m.client_key).map((m:any)=>[m.client_key,m]));
  for(const mission of incoming){
    const clientKey=keyFor(mission?.id,`mission-${crypto.randomUUID()}`);
    const found=byKey.get(clientKey);
    if(found&&!overwrite)continue;
    const row={
      platoon_id:platoonId,created_by:user.id,client_key:clientKey,title:text(mission?.title)||null,
      mission_type:["skirmish","battle","war"].includes(mission?.type)?mission.type:"battle",
      status:["planned","ready","completed","cancelled"].includes(mission?.status)?mission.status:"planned",
      played_on:text(mission?.date),tee_time:text(mission?.teeTime)||null,course_id:text(mission?.courseId)||null,
      location_name:text(mission?.locationName)||"Location TBD",format:text(mission?.format)||null,rules_notes:text(mission?.notes)||null,
      results_snapshot:Array.isArray(mission?.results)?mission.results:null,updated_at:new Date().toISOString()
    };
    let missionId=found?.id;
    if(found){const {error}=await supabase.from("golfrecon_missions").update(row).eq("id",found.id);if(error)throw error}
    else {const {data,error}=await supabase.from("golfrecon_missions").insert(row).select("id").single();if(error)throw error;missionId=data.id}
    for(const participantKey of (Array.isArray(mission?.participants)?mission.participants:[])){
      const memberId=memberIdByKey.get(participantKey);if(!memberId)continue;
      const {data:part,error:pErr}=await supabase.from("golfrecon_mission_participants").select("id").eq("mission_id",missionId).eq("platoon_member_id",memberId).maybeSingle();
      if(pErr)throw pErr;
      if(!part){const {error}=await supabase.from("golfrecon_mission_participants").insert({mission_id:missionId,platoon_member_id:memberId,participant_status:"playing"});if(error)throw error}
    }
  }
}

async function bootstrapState(supabase:any,user:any,snapshot:any){
  const {membership,created}=await ensurePlatoon(supabase,user,snapshot||{});
  if(created){
    await upsertMembers(supabase,user,membership.platoon_id,snapshot||{},true);
    await upsertMissions(supabase,user,membership.platoon_id,snapshot||{},true);
  }else if(snapshot){
    await upsertMembers(supabase,user,membership.platoon_id,snapshot,false);
    await upsertMissions(supabase,user,membership.platoon_id,snapshot,false);
  }
  return readPlatoonState(supabase,membership.platoon_id);
}

async function saveState(supabase:any,user:any,snapshot:any){
  const {membership}=await ensurePlatoon(supabase,user,snapshot||{});
  if(!["chief","co_chief"].includes(membership.role))throw new Error("PLATOON_ADMIN_REQUIRED");
  const update:any={
    name:text(snapshot?.name)||"Platoon",motto:text(snapshot?.motto)||null,season_year:safeYear(snapshot?.season),
    visibility:text(snapshot?.visibility).toLowerCase().includes("invite")?"invite_only":"private",
    logo_data_url:text(snapshot?.logoData)||null,updated_at:new Date().toISOString()
  };
  const {error}=await supabase.from("golfrecon_platoons").update(update).eq("id",membership.platoon_id);
  if(error)throw error;
  await upsertMembers(supabase,user,membership.platoon_id,snapshot||{},true);
  await upsertMissions(supabase,user,membership.platoon_id,snapshot||{},true);
  return readPlatoonState(supabase,membership.platoon_id);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const user=await requireUser(req,supabase);
    const body=await req.json();
    if(body.action==="parse_results")return response(await parseResults(body));
    if(body.action==="parse_hole_details")return response(await parseHoleDetails(body));
    if(body.action==="bootstrap")return response({platoon:await bootstrapState(supabase,user,body.snapshot||{})});
    if(body.action==="save_state")return response({platoon:await saveState(supabase,user,body.snapshot||{})});
    throw new Error("Unsupported Platoon action.");
  }catch(e:any){
    const msg=String(e?.message||e||"Unknown error");
    const status=msg==="AUTH_REQUIRED"?401:msg==="PLATOON_ADMIN_REQUIRED"?403:400;
    return response({error:msg},status);
  }
});
