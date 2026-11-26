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

const personalRoundDirectionSchema={
  type:"object",
  additionalProperties:false,
  properties:{
    confidence:{type:"number"},
    warnings:{type:"array",items:{type:"string"}},
    holes:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          hole:{type:"integer"},
          fairway_direction:{type:["string","null"],enum:["hit","left","right","short","long","other",null]},
          gir_direction:{type:["string","null"],enum:["hit","left","right","short","long","other",null]}
        },
        required:["hole","fairway_direction","gir_direction"]
      }
    }
  },
  required:["confidence","warnings","holes"]
};


const completedMissionSchema={
  type:"object",
  additionalProperties:false,
  properties:{
    confidence:{type:"number"},
    warnings:{type:"array",items:{type:"string"}},
    event:{
      type:"object",
      additionalProperties:false,
      properties:{
        title:{type:["string","null"]},date:{type:["string","null"]},tee_time:{type:["string","null"]},
        course_name:{type:["string","null"]},format:{type:["string","null"]}
      },
      required:["title","date","tee_time","course_name","format"]
    },
    results:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          player_name:{type:"string"},
          handicap:{type:["integer","null"]},
          gross:{type:["integer","null"]},
          net:{type:["integer","null"]},
          finish_position:{type:["integer","null"]},
          raw_points:{type:["number","null"]},
          eagle_count:{type:["integer","null"]},
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
        required:["player_name","handicap","gross","net","finish_position","raw_points","eagle_count","holes"]
      }
    }
  },
  required:["confidence","warnings","event","results"]
};

function response(data:any,status=200){
  return new Response(JSON.stringify(data),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
}
function text(v:any){return String(v??"").trim()}
function safeYear(v:any){const n=Number(v);return Number.isInteger(n)&&n>=2020&&n<=2100?n:new Date().getFullYear()}
function keyFor(v:any,fallback:string){const s=text(v);return s||fallback}
function normEmail(v:any){
  const s=text(v).toLowerCase();
  if(!s||!s.includes("@")||s.length>254)return "";
  return s;
}
function aliasesFor(v:any){
  const raw=Array.isArray(v)?v:(typeof v==="string"?v.split(/[,|]/):[]);
  return [...new Set(raw.map((x:any)=>text(x)).filter(Boolean))];
}
function memberAliasInput(m:any){
  if(Array.isArray(m?.aliases))return {present:true,aliases:aliasesFor(m.aliases)};
  if(typeof m?.nickname==="string")return {present:true,aliases:aliasesFor(m.nickname)};
  return {present:false,aliases:[]};
}
function nicknameFor(aliases:any){const a=aliasesFor(aliases);return a.length?a.join(", "):null}
function rosterEmailsFromSnapshot(snapshot:any){
  const out:Record<string,string>={};
  for(const m of (Array.isArray(snapshot?.members)?snapshot.members:[])){
    const id=keyFor(m?.id,"");
    const email=normEmail(m?.email);
    if(id&&email)out[id]=email;
  }
  return out;
}
function rosterProfilesFromSnapshot(snapshot:any){
  const out:Record<string,{fullName:string,displayName:string}>={};
  for(const m of (Array.isArray(snapshot?.members)?snapshot.members:[])){
    const id=keyFor(m?.id,"");
    if(!id)continue;
    const fullName=text(m?.name);
    const displayName=text(m?.displayName)||text(m?.display_name);
    if(fullName||displayName)out[id]={fullName,displayName};
  }
  const fromMeta=(snapshot?.hqMeta&&typeof snapshot.hqMeta==="object"&&snapshot.hqMeta.rosterProfiles&&typeof snapshot.hqMeta.rosterProfiles==="object")
    ?snapshot.hqMeta.rosterProfiles:{};
  for(const [id,prof] of Object.entries(fromMeta||{})){
    const key=keyFor(id,"");
    if(!key||!prof||typeof prof!=="object")continue;
    const fullName=text((prof as any).fullName||(prof as any).name)||out[key]?.fullName||"";
    const displayName=text((prof as any).displayName)||out[key]?.displayName||"";
    if(fullName||displayName)out[key]={fullName,displayName};
  }
  return out;
}
function publicDisplayName(m:any,profiles?:Record<string,{fullName:string,displayName:string}>){
  const id=keyFor(m?.id||m?.client_key,"");
  const prof=id&&profiles?profiles[id]:null;
  return text(m?.displayName)||text(m?.display_name)||text(prof?.displayName)||text(m?.name)||text(prof?.fullName)||"Cadet";
}
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


async function parseCompletedMission(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one historical Mission screenshot.");
  const content:any[]=[{
    type:"input_text",
    text:`You are the Golf Recon historical completed-Mission parser.
The user is uploading screenshots from ONE completed 18Birdies tournament/event. Screenshots may include:
1) event overview (title/date/tee/course/format/participants)
2) Individual Stroke (G) GROSS leaderboard LIST (rank / name / T-HCP / +N(score)) — may be scrolled across MULTIPLE screenshots
3) Individual Stroke (N) NET / points leaderboard LIST — may also be scrolled across MULTIPLE screenshots
4) EXPANDED hole-by-hole scorecards (front 9 Out and/or back 9 In) when available

Leaderboard LIST screenshots alone are enough. Hole grids are optional. Guests appear as normal name rows — include EVERY visible player; never drop someone because they look like a guest.

Build one event and merge the player rows across all screenshots. Never guess values that are not visible.

Event fields:
- title: tournament/event name exactly as visible (e.g. "Rainy Rumble")
- date: YYYY-MM-DD when visible
- tee_time: HH:MM in 24-hour local time when visible
- course_name: course name exactly as visible
- format: e.g. Stroke Play when visible

For each player return:
- player_name exactly as shown (keep truncated forms like "Kevi..." if that is all that is visible; do not invent a full name)
- handicap: tournament handicap (T-HCP) when visible, else null. CRITICAL when two players share the same truncated first name — use handicap + photo/context to keep them as SEPARATE players
- gross: from the Gross (G) leaderboard score in parentheses, e.g. +8(78) → gross 78
- net: from the Net (N) leaderboard score in parentheses when that tab is visible
- raw_points: points from the net/points leaderboard when visible
- finish_position: prefer Net (N) / points ranking when that screenshot is present. If ONLY Gross (G) screenshots are provided, use the gross rank. If both differ, DO NOT use gross rank when net rank is visible.
- eagle_count: count of eagles visible from hole scores (score <= par-2) when hole data exists; else only when explicitly labeled; otherwise null
- holes: array of {hole, par, score} from expanded scorecard grids when visible. Merge front-nine (1-9 / Out) and back-nine (10-18 / In) for the SAME player into one holes array. If only one nine is visible, return those holes only. Empty array [] if no hole grid is visible — that is normal for leaderboard-list uploads.

Important merging rules:
- Screenshots are all from the same event.
- SCROLLED LISTS: if multiple screenshots show the same tab (G or N) at different scroll positions, UNION every distinct player row (name + T-HCP). Do not keep only the players from the first screenshot.
- Merge Gross + Net for the same person when name + T-HCP match across tabs.
- Merge abbreviations of the same visible player only when identity is clear from name + handicap + photo/context. Two "Kevi..." / "Kevin C." rows with DIFFERENT T-HCP values are DIFFERENT people — never merge them.
- A score like +13(84) on Gross (G) means 84 gross; on Net (N) +2(73) means 73 net.
- Do not calculate missing net/gross from handicap unless the screenshot explicitly gives the score.
- Preserve points exactly as shown.
- Ignore "Out" / "In" total columns as hole numbers — only holes 1-18.
- Circles around scores usually mean birdie/eagle; squares usually mean bogey — still read the numeric score from the cell.
- If anything conflicts or is ambiguous, prefer null / empty holes plus a warning rather than guessing.
- Always return a non-empty results array when any leaderboard rows are readable.`
  }];
  for(const img of body.images){if(img?.type&&img?.data)content.push({type:"input_image",image_url:`data:${img.type};base64,${img.data}`,detail:"high"})}
  const ai=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({model:"gpt-5.6",input:[{role:"user",content}],text:{format:{type:"json_schema",name:"golfrecon_completed_mission",strict:true,schema:completedMissionSchema}}})
  });
  const raw=await ai.json();
  if(!ai.ok)throw new Error(raw?.error?.message||"Historical Mission parsing failed.");
  const outputText=raw.output_text??raw.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
  if(!outputText)throw new Error("No structured historical Mission returned.");
  return JSON.parse(outputText);
}

async function parseHoleDetails(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one scorecard screenshot.");
  const mission=body.mission||{};
  const roster=Array.isArray(mission.roster)?mission.roster:[];
  const players:any[]=[];
  const warnings:string[]=[];
  let confidence=1;

  for(let i=0;i<body.images.length;i++){
    const img=body.images[i];
    if(!img?.type||!img?.data)continue;
    const content:any[]=[{
      type:"input_text",
      text:`You are the Golf Recon Platoon hole-by-hole scorecard parser.
Read ONLY this ONE screenshot. Do not merge it with any other screenshot.

This screenshot can contain TWO PLAYERS at the same time. Treat each visible player row independently.
For every visible player row:
- identify the player name or abbreviation shown on that row
- keep every score attached to that same player row
- determine hole numbers from the visible card headings
- return only the holes visible in THIS screenshot
- never shift scores from one player row to another
- never infer a missing score, par, player, or hole

Return a separate player entry for every visible player row, even if the same golfer may appear again in another screenshot. Golf Recon will merge front-nine and back-nine rows later after the user confirms the player identity.

For each visible player row return:
- player_name exactly as shown
- holes with visible hole number
- par only when visible, otherwise null
- score only when visible, otherwise null

Do NOT infer or overwrite gross, net, handicap, finish position, Mission points, or the official Mission leaderboard.
If something is ambiguous, leave it null and add a warning.

Known Platoon roster for resolving visible abbreviations only:
${JSON.stringify(roster)}
Do not attach a row to a roster member unless the screenshot itself supports that identity.

Mission context for matching only:
${JSON.stringify({date:mission.date||null,course:mission.locationName||null,title:mission.title||null})}`
    },{
      type:"input_image",image_url:`data:${img.type};base64,${img.data}`,detail:"high"
    }];
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
    if(!ai.ok)throw new Error(raw?.error?.message||`Hole-by-hole parsing failed on screenshot ${i+1}.`);
    const outputText=raw.output_text??raw.output?.flatMap((o:any)=>o.content||[]).find((c:any)=>c.type==="output_text")?.text;
    if(!outputText)throw new Error(`No structured hole-by-hole detail returned for screenshot ${i+1}.`);
    const parsed=JSON.parse(outputText);
    if(Number.isFinite(Number(parsed?.confidence)))confidence=Math.min(confidence,Number(parsed.confidence));
    for(const w of (Array.isArray(parsed?.warnings)?parsed.warnings:[]))warnings.push(`Screenshot ${i+1}: ${String(w)}`);
    for(const player of (Array.isArray(parsed?.players)?parsed.players:[]))players.push(player);
  }
  return {confidence,warnings,players};
}


async function parsePersonalRoundDirections(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one scorecard screenshot.");
  const content:any[]=[{
    type:"input_text",
    text:`You are extracting per-hole directional results from 18Birdies scorecard-summary screenshots for Golf Recon.

Read ONLY information actually visible. Return one row per visible hole.

For FAIRWAY HIT:
- green check = hit
- directional miss arrow pointing left = left
- arrow pointing right = right
- arrow pointing down / short = short
- arrow pointing up / long = long
- red X / ✕ / non-directional miss = short (count as a short miss; never leave null and never warn that percentages cannot be included)
- par-3 holes or cells with no fairway result = null

For GREEN IN REGULATION:
- green check = hit
- directional miss arrow pointing left = left
- arrow pointing right = right
- arrow pointing down = short
- arrow pointing up = long
- red X / ✕ / non-directional miss = short (count as a short miss; never leave null and never warn that percentages cannot be included)
- blank/unknown = null

Be careful to preserve each icon on its exact hole. Do not infer a direction from score, club, or result. If screenshots overlap, merge the same hole and prefer the clearest visible icon. A 0-putt hole is valid and is unrelated to this directional extraction. Never warn that an X prevents directional percentages — treat X as short.`
  }];
  for(const img of body.images){
    if(img?.type&&img?.data)content.push({type:"input_image",image_url:`data:${img.type};base64,${img.data}`,detail:"high"});
  }
  const ai=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model:"gpt-5.6",
      input:[{role:"user",content}],
      text:{format:{type:"json_schema",name:"golfrecon_personal_round_directions",strict:true,schema:personalRoundDirectionSchema}}
    })
  });
  const raw=await ai.json();
  if(!ai.ok)throw new Error(raw?.error?.message||"Directional scorecard parsing failed.");
  const outputText=raw.output_text??raw.output?.flatMap((o:any)=>o.content||[]).find((cc:any)=>cc.type==="output_text")?.text;
  if(!outputText)throw new Error("No structured directional scorecard data returned.");
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

let _inviteEmailCol:boolean|null=null;
async function inviteEmailColumnSupported(supabase:any){
  if(_inviteEmailCol!=null)return _inviteEmailCol;
  try{
    const {error}=await supabase.from("golfrecon_platoon_members").select("invite_email").limit(1);
    _inviteEmailCol=!error;
    return _inviteEmailCol;
  }catch{
    _inviteEmailCol=false;
    return false;
  }
}

async function linkMemberSeat(supabase:any,member:any,user:any){
  if(!member?.id)return null;
  if(member.user_id&&member.user_id!==user.id)throw new Error("ROSTER_EMAIL_ALREADY_LINKED");
  const nextRole=member.role==="chief"||member.role==="co_chief"?member.role:"member";
  const patch:any={user_id:user.id,status:"active",role:nextRole,updated_at:new Date().toISOString()};
  const {data,error}=await supabase.from("golfrecon_platoon_members")
    .update(patch).eq("id",member.id)
    .select("id,platoon_id,role,status,client_key").single();
  if(error)throw error;
  return data;
}

/** Claim an existing roster seat by invite email instead of creating a new Platoon. */
async function claimMembershipByEmail(supabase:any,user:any){
  const email=normEmail(user?.email);
  if(!email)return null;

  if(await inviteEmailColumnSupported(supabase)){
    const {data:rows,error}=await supabase.from("golfrecon_platoon_members")
      .select("id,platoon_id,role,status,client_key,user_id,invite_email")
      .eq("status","active")
      .ilike("invite_email",email)
      .limit(5);
    if(error&&!schemaError(error))throw error;
    const hit=(rows||[]).find((r:any)=>normEmail(r.invite_email)===email);
    if(hit){
      if(hit.user_id&&hit.user_id===user.id){
        return {id:hit.id,platoon_id:hit.platoon_id,role:hit.role,status:hit.status,client_key:hit.client_key};
      }
      return await linkMemberSeat(supabase,hit,user);
    }
  }

  // Fallback before/without v5 column: emails mirrored into hq_meta.rosterEmails.
  try{
    const {data:platoons,error}=await supabase.from("golfrecon_platoons").select("id,hq_meta");
    if(error){if(schemaError(error))return null;throw error}
    for(const p of platoons||[]){
      const map=(p?.hq_meta&&typeof p.hq_meta==="object"&&p.hq_meta.rosterEmails&&typeof p.hq_meta.rosterEmails==="object")
        ? p.hq_meta.rosterEmails:{};
      const clientKey=Object.keys(map).find(k=>normEmail(map[k])===email);
      if(!clientKey)continue;
      const {data:member,error:mErr}=await supabase.from("golfrecon_platoon_members")
        .select("id,platoon_id,role,status,client_key,user_id")
        .eq("platoon_id",p.id).eq("client_key",clientKey).eq("status","active").maybeSingle();
      if(mErr)throw mErr;
      if(!member)continue;
      if(member.user_id&&member.user_id===user.id)return member;
      return await linkMemberSeat(supabase,member,user);
    }
  }catch(e:any){
    if(schemaError(e))return null;
    throw e;
  }
  return null;
}

async function ensurePlatoon(supabase:any,user:any,snapshot:any){
  let membership=await activeMembership(supabase,user.id);
  if(membership)return {membership,created:false};

  // Existing My Time seat with this email → claim it (do not spawn a parallel Platoon).
  const claimed=await claimMembershipByEmail(supabase,user);
  if(claimed)return {membership:claimed,created:false,claimed:true};

  const chiefSnapshot=snapshot?.members?.find((m:any)=>m?.role==="chief")||snapshot?.members?.find((m:any)=>m?.linked);
  const chiefName=text(snapshot?.chief)||text(chiefSnapshot?.name)||text(user.user_metadata?.username)||text(user.email?.split("@")[0])||"Golfer";
  const slug=`platoon-${user.id.slice(0,8)}-${Date.now().toString(36)}`;
  const {data:platoon,error:pErr}=await supabase.from("golfrecon_platoons").insert({
    name:text(snapshot?.name)||"My Time",slug,motto:text(snapshot?.motto)||null,
    season_year:safeYear(snapshot?.season),created_by:user.id,visibility:"private",
    logo_data_url:text(snapshot?.logoData)||null
  }).select("id").single();
  if(pErr){if(schemaError(pErr))throw new Error("PLATOON_SCHEMA_NOT_READY");throw pErr}
  const chiefKey=keyFor(chiefSnapshot?.id,"chief");
  const chiefAliases=memberAliasInput(chiefSnapshot);
  const chiefEmail=normEmail(chiefSnapshot?.email)||normEmail(user.email)||null;
  const chiefInsert:any={
    platoon_id:platoon.id,user_id:user.id,display_name:chiefName,role:"chief",status:"active",client_key:chiefKey,
    nickname:chiefAliases.present?nicknameFor(chiefAliases.aliases):null
  };
  if(chiefEmail&&await inviteEmailColumnSupported(supabase))chiefInsert.invite_email=chiefEmail;
  const {data:member,error:mErr}=await supabase.from("golfrecon_platoon_members").insert(chiefInsert)
    .select("id,platoon_id,role,status,client_key").single();
  if(mErr)throw mErr;
  membership=member;
  return {membership,created:true};
}

async function readHqMetaColumn(supabase:any,platoonId:string){
  // hq_meta ships in platoons-v4; tolerate environments that have not applied the migration yet.
  try{
    const {data,error}=await supabase.from("golfrecon_platoons").select("hq_meta").eq("id",platoonId).maybeSingle();
    if(error)return {supported:false,hqMeta:null};
    return {supported:true,hqMeta:(data?.hq_meta&&typeof data.hq_meta==="object")?data.hq_meta:{}};
  }catch{
    return {supported:false,hqMeta:null};
  }
}

async function readPlatoonState(supabase:any,platoonId:string){
  const {data:p,error:pErr}=await supabase.from("golfrecon_platoons")
    .select("id,name,motto,season_year,visibility,logo_data_url,created_by").eq("id",platoonId).single();
  if(pErr)throw pErr;
  const hq=await readHqMetaColumn(supabase,platoonId);
  const emailCol=await inviteEmailColumnSupported(supabase);
  const memberSelect=emailCol
    ?"id,user_id,display_name,nickname,role,status,client_key,invite_email"
    :"id,user_id,display_name,nickname,role,status,client_key";
  const {data:members,error:mErr}=await supabase.from("golfrecon_platoon_members")
    .select(memberSelect).eq("platoon_id",platoonId).eq("status","active").order("joined_at");
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
  const hqEmails=(hq.hqMeta&&typeof hq.hqMeta==="object"&&hq.hqMeta.rosterEmails&&typeof hq.hqMeta.rosterEmails==="object")
    ? hq.hqMeta.rosterEmails:{};
  const hqProfiles=(hq.hqMeta&&typeof hq.hqMeta==="object"&&hq.hqMeta.rosterProfiles&&typeof hq.hqMeta.rosterProfiles==="object")
    ? hq.hqMeta.rosterProfiles:{};
  const state:any={
    id:p.id,serverId:p.id,name:p.name,motto:p.motto||"",season:p.season_year,
    visibility:p.visibility==="invite_only"?"Invite only":"Private",logoData:p.logo_data_url||"",
    chief:publicDisplayName(chief,hqProfiles)||chief?.display_name||"",coChief:co?.client_key||co?.id||"",
    members:(members||[]).map((m:any)=>{
      const id=m.client_key||m.id;
      const email=normEmail(m.invite_email)||normEmail(hqEmails[id])||"";
      const prof=hqProfiles[id]||{};
      const fullName=text(prof.fullName)||text(m.display_name);
      const displayName=text(prof.displayName)||(text(prof.fullName)?text(m.display_name):"");
      return {
        id,serverId:m.id,name:fullName,displayName,nickname:m.nickname||"",aliases:aliasesFor(m.nickname),
        email,linked:!!m.user_id,role:m.role
      };
    }),
    missions:(missions||[]).map((m:any)=>({
      id:m.client_key||m.id,serverId:m.id,date:m.played_on,teeTime:m.tee_time?String(m.tee_time).slice(0,5):"",
      type:m.mission_type,courseId:m.course_id||"",locationName:m.location_name,title:m.title||"",
      format:m.format||"",notes:m.rules_notes||"",status:m.status,
      participants:participants.filter((x:any)=>x.mission_id===m.id&&x.participant_status!=="withdrawn").map((x:any)=>memberKeyById.get(x.platoon_member_id)).filter(Boolean),
      results:Array.isArray(m.results_snapshot)?m.results_snapshot:[]
    })),
    hqMetaSupported:hq.supported
  };
  if(hq.supported){
    const meta={...(hq.hqMeta||{})};
    meta.rosterEmails=rosterEmailsFromSnapshot(state);
    meta.rosterProfiles=rosterProfilesFromSnapshot(state);
    state.hqMeta=meta;
  }
  return state;
}

async function upsertMembers(supabase:any,user:any,platoonId:string,snapshot:any,allowRoleChanges:boolean){
  const incoming=Array.isArray(snapshot?.members)?snapshot.members:[];
  const emailCol=await inviteEmailColumnSupported(supabase);
  const selectCols=emailCol
    ?"id,user_id,display_name,nickname,role,status,client_key,invite_email"
    :"id,user_id,display_name,nickname,role,status,client_key";
  const {data:existing,error}=await supabase.from("golfrecon_platoon_members")
    .select(selectCols).eq("platoon_id",platoonId);
  if(error)throw error;
  const byKey=new Map((existing||[]).filter((m:any)=>m.client_key).map((m:any)=>[m.client_key,m]));
  const chiefRow=(existing||[]).find((m:any)=>m.role==="chief");
  const chiefIncoming=incoming.find((m:any)=>m.role==="chief")||incoming.find((m:any)=>m.linked);
  const profiles=rosterProfilesFromSnapshot(snapshot||{});
  if(chiefRow&&chiefIncoming){
    const chiefKey=keyFor(chiefIncoming.id,chiefRow.client_key||"chief");
    const patch:any={
      display_name:publicDisplayName(chiefIncoming,profiles)||chiefRow.display_name,
      client_key:chiefKey
    };
    const aliasInput=memberAliasInput(chiefIncoming);
    if(aliasInput.present)patch.nickname=nicknameFor(aliasInput.aliases);
    if(emailCol)patch.invite_email=normEmail(chiefIncoming.email)||null;
    await supabase.from("golfrecon_platoon_members").update(patch).eq("id",chiefRow.id);
  }
  for(const m of incoming){
    const clientKey=keyFor(m?.id,`member-${crypto.randomUUID()}`);
    if(m?.role==="chief")continue;
    const found=byKey.get(clientKey);
    const role=allowRoleChanges?(m?.role==="co_chief"?"co_chief":((m?.linked||found?.user_id)?"member":"cadet")):(found?.role||"cadet");
    const row:any={display_name:publicDisplayName(m,profiles)||"Cadet",client_key:clientKey,status:"active",role};
    const aliasInput=memberAliasInput(m);
    if(aliasInput.present)row.nickname=nicknameFor(aliasInput.aliases);
    if(emailCol)row.invite_email=normEmail(m?.email)||null;
    if(found)await supabase.from("golfrecon_platoon_members").update(row).eq("id",found.id);
    else await supabase.from("golfrecon_platoon_members").insert({platoon_id:platoonId,user_id:null,nickname:aliasInput.present?nicknameFor(aliasInput.aliases):null,...row});
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

async function deleteMission(supabase:any,user:any,clientKey:any){
  const membership=await activeMembership(supabase,user.id);
  if(!membership)throw new Error("PLATOON_ADMIN_REQUIRED");
  if(!["chief","co_chief"].includes(membership.role))throw new Error("PLATOON_ADMIN_REQUIRED");
  const key=text(clientKey);if(!key)throw new Error("MISSION_ID_REQUIRED");
  const {data:mission,error:mErr}=await supabase.from("golfrecon_missions")
    .select("id").eq("platoon_id",membership.platoon_id).eq("client_key",key).maybeSingle();
  if(mErr)throw mErr;
  if(mission?.id){
    const {error:dErr}=await supabase.from("golfrecon_missions").delete().eq("id",mission.id).eq("platoon_id",membership.platoon_id);
    if(dErr)throw dErr;
  }
  return readPlatoonState(supabase,membership.platoon_id);
}

async function bootstrapState(supabase:any,user:any,snapshot:any){
  const {membership,created}=await ensurePlatoon(supabase,user,snapshot||{});
  if(created){
    await upsertMembers(supabase,user,membership.platoon_id,snapshot||{},true);
    await upsertMissions(supabase,user,membership.platoon_id,snapshot||{},true);
  }
  return readPlatoonState(supabase,membership.platoon_id);
}

async function saveState(supabase:any,user:any,snapshot:any){
  const {membership}=await ensurePlatoon(supabase,user,snapshot||{});
  if(!["chief","co_chief"].includes(membership.role))throw new Error("PLATOON_ADMIN_REQUIRED");
  const emails=rosterEmailsFromSnapshot(snapshot||{});
  const emailVals=Object.values(emails);
  if(new Set(emailVals).size!==emailVals.length)throw new Error("ROSTER_EMAIL_DUPLICATE");
  const update:any={
    name:text(snapshot?.name)||"Platoon",motto:text(snapshot?.motto)||null,season_year:safeYear(snapshot?.season),
    visibility:text(snapshot?.visibility).toLowerCase().includes("invite")?"invite_only":"private",
    logo_data_url:text(snapshot?.logoData)||null,updated_at:new Date().toISOString()
  };
  // Persist HQ meta when the v4 column exists; never fail the whole save if it does not.
  // Always mirror rosterEmails into hq_meta so claim-by-email works before v5 migration.
  const probe=await readHqMetaColumn(supabase,membership.platoon_id);
  if(probe.supported){
    const meta={...((snapshot?.hqMeta&&typeof snapshot.hqMeta==="object")?snapshot.hqMeta:(probe.hqMeta||{}))};
    meta.rosterEmails=emails;
    meta.rosterProfiles=rosterProfilesFromSnapshot(snapshot||{});
    update.hq_meta=meta;
  }
  const {error}=await supabase.from("golfrecon_platoons").update(update).eq("id",membership.platoon_id);
  if(error)throw error;
  await upsertMembers(supabase,user,membership.platoon_id,snapshot||{},true);
  await upsertMissions(supabase,user,membership.platoon_id,snapshot||{},true);
  return readPlatoonState(supabase,membership.platoon_id);
}

/** Any linked member can update only their own full/display/alias names. */
async function updateMySeat(supabase:any,user:any,body:any){
  const membership=await activeMembership(supabase,user.id);
  if(!membership)throw new Error("NO_PLATOON_MEMBERSHIP");
  const fullName=text(body?.full_name)||text(body?.name);
  const displayName=text(body?.display_name)||text(body?.displayName);
  const aliases=aliasesFor(body?.aliases);
  const patch:any={updated_at:new Date().toISOString()};
  if(displayName||fullName)patch.display_name=displayName||fullName;
  if(Array.isArray(body?.aliases)||typeof body?.aliases==="string")patch.nickname=nicknameFor(aliases);
  if(Object.keys(patch).length>1){
    const {error}=await supabase.from("golfrecon_platoon_members").update(patch).eq("id",membership.id);
    if(error)throw error;
  }
  const probe=await readHqMetaColumn(supabase,membership.platoon_id);
  if(probe.supported){
    const meta={...(probe.hqMeta||{})};
    const profiles=(meta.rosterProfiles&&typeof meta.rosterProfiles==="object")?{...meta.rosterProfiles}:{};
    const clientKey=keyFor(membership.client_key,membership.id);
    profiles[clientKey]={
      fullName:fullName||text(profiles[clientKey]?.fullName),
      displayName:displayName||text(profiles[clientKey]?.displayName)
    };
    meta.rosterProfiles=profiles;
    const {error}=await supabase.from("golfrecon_platoons")
      .update({hq_meta:meta,updated_at:new Date().toISOString()})
      .eq("id",membership.platoon_id);
    if(error&&!schemaError(error))throw error;
  }
  return readPlatoonState(supabase,membership.platoon_id);
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const user=await requireUser(req,supabase);
    const body=await req.json();
    if(body.action==="parse_results")return response(await parseResults(body));
    if(body.action==="parse_completed_mission")return response(await parseCompletedMission(body));
    if(body.action==="parse_hole_details")return response(await parseHoleDetails(body));
    if(body.action==="parse_personal_round_directions")return response(await parsePersonalRoundDirections(body));
    if(body.action==="bootstrap")return response({platoon:await bootstrapState(supabase,user,body.snapshot||{})});
    if(body.action==="delete_mission")return response({platoon:await deleteMission(supabase,user,body.mission_id)});
    if(body.action==="save_state")return response({platoon:await saveState(supabase,user,body.snapshot||{})});
    if(body.action==="update_my_seat")return response({platoon:await updateMySeat(supabase,user,body||{})});
    throw new Error("Unsupported Platoon action.");
  }catch(e:any){
    const msg=String(e?.message||e||"Unknown error");
    const status=msg==="AUTH_REQUIRED"?401:msg==="PLATOON_ADMIN_REQUIRED"||msg==="ROSTER_EMAIL_ALREADY_LINKED"?403:400;
    return response({error:msg},status);
  }
});