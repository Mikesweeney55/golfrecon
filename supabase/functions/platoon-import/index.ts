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
      properties:{
        date:{type:["string","null"]},
        course_name:{type:["string","null"]}
      },
      required:["date","course_name"]
    },
    results:{
      type:"array",
      items:{
        type:"object",
        additionalProperties:false,
        properties:{
          player_name:{type:"string"},
          gross:{type:["integer","null"]},
          net:{type:["integer","null"]},
          finish_position:{type:["integer","null"]},
          raw_points:{type:["number","null"]},
          eagle_count:{type:["integer","null"]}
        },
        required:["player_name","gross","net","finish_position","raw_points","eagle_count"]
      }
    }
  },
  required:["confidence","warnings","event","results"]
};

async function requireUser(req:Request,supabase:any){
  const auth=req.headers.get("Authorization")||"";
  const token=auth.replace(/^Bearer\s+/i,"").trim();
  if(!token)throw new Error("AUTH_REQUIRED");
  const {data,error}=await supabase.auth.getUser(token);
  if(error||!data?.user)throw new Error("AUTH_REQUIRED");
  return data.user;
}

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS")return new Response("ok",{headers:corsHeaders});
  try{
    const supabase=createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    await requireUser(req,supabase);
    const body=await req.json();

    if(body.action!=="parse_results")throw new Error("Unsupported Platoon action.");

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
    const parsed=JSON.parse(outputText);

    return new Response(JSON.stringify(parsed),{headers:{...corsHeaders,"Content-Type":"application/json"}});
  }catch(e:any){
    const msg=String(e?.message||e||"Unknown error");
    const status=msg==="AUTH_REQUIRED"?401:400;
    return new Response(JSON.stringify({error:msg}),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
  }
});
