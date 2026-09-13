from pathlib import Path

p = Path('supabase/functions/platoon-import/index.ts')
s = p.read_text()

schema = r'''
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

'''

if 'const holeDetailSchema=' not in s:
    anchor = 'function response(data:any,status=200){'
    if anchor not in s:
        raise SystemExit('response anchor not found')
    s = s.replace(anchor, schema + anchor)

parser = r'''
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

'''

if 'async function parseHoleDetails' not in s:
    anchor = 'async function activeMembership(supabase:any,userId:string){'
    if anchor not in s:
        raise SystemExit('activeMembership anchor not found')
    s = s.replace(anchor, parser + anchor)

old = 'if(body.action==="parse_results")return response(await parseResults(body));'
new = old + '\n    if(body.action==="parse_hole_details")return response(await parseHoleDetails(body));'
if 'body.action==="parse_hole_details"' not in s:
    if old not in s:
        raise SystemExit('parse_results action anchor not found')
    s = s.replace(old, new)

p.write_text(s)
