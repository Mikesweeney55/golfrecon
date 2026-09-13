from pathlib import Path

backend=Path('supabase/functions/platoon-import/index.ts')
s=backend.read_text()

schema=r'''
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
          player_name:{type:"string"},gross:{type:["integer","null"]},net:{type:["integer","null"]},
          finish_position:{type:["integer","null"]},raw_points:{type:["number","null"]},eagle_count:{type:["integer","null"]}
        },
        required:["player_name","gross","net","finish_position","raw_points","eagle_count"]
      }
    }
  },
  required:["confidence","warnings","event","results"]
};
'''
if 'const completedMissionSchema=' not in s:
    marker='function response(data:any,status=200){'
    if marker not in s: raise SystemExit('response marker missing')
    s=s.replace(marker,schema+'\n'+marker,1)

fn=r'''
async function parseCompletedMission(body:any){
  const key=Deno.env.get("OPENAI_API_KEY");
  if(!key)throw new Error("OPENAI_API_KEY secret is not configured.");
  if(!Array.isArray(body.images)||!body.images.length)throw new Error("Add at least one historical Mission screenshot.");
  const content:any[]=[{
    type:"input_text",
    text:`You are the Golf Recon historical completed-Mission parser.
The user is uploading screenshots from ONE completed 18Birdies tournament/event. The screenshots may include an event overview, a gross leaderboard, and a net/points leaderboard.

Build one event and merge the player rows across all screenshots. Never guess values that are not visible.

Event fields:
- title: tournament/event name exactly as visible
- date: YYYY-MM-DD when visible
- tee_time: HH:MM in 24-hour local time when visible
- course_name: course name exactly as visible
- format: e.g. Stroke Play when visible

For each player return:
- player_name exactly as shown
- gross: from the gross leaderboard or clearly labeled gross score
- net: from the net leaderboard or clearly labeled net score
- raw_points: points from the net/points leaderboard when visible
- finish_position: use the handicap/net/points competition ranking when visible. If gross and net rankings differ, DO NOT use gross rank for finish_position; gross is only the gross score source.
- eagle_count: only when explicitly established by the screenshots; otherwise null

Important merging rules:
- Screenshots are all from the same event.
- Merge abbreviations of the same visible player only when the identity is clear from name/photo/context.
- A score like +10(81) means 81 gross on a gross leaderboard; on a net leaderboard a display like -3(68) means 68 net.
- Do not calculate missing net/gross from handicap unless the screenshot explicitly gives the score.
- Preserve points exactly as shown.
- If anything conflicts or is ambiguous, prefer null plus a warning rather than guessing.
- Do not create hole-by-hole data.`
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
'''
if 'async function parseCompletedMission' not in s:
    marker='async function parseHoleDetails(body:any){'
    if marker not in s: raise SystemExit('parseHoleDetails marker missing')
    s=s.replace(marker,fn+'\n'+marker,1)

route='if(body.action==="parse_results")return response(await parseResults(body));'
if 'body.action==="parse_completed_mission"' not in s:
    if route not in s: raise SystemExit('route marker missing')
    s=s.replace(route,route+'\n    if(body.action==="parse_completed_mission")return response(await parseCompletedMission(body));',1)
backend.write_text(s)

idx=Path('index.html')
h=idx.read_text()
if 'past-mission-import.js' not in h:
    candidates=['<script src="dev-v15.5-results.js?v=156"></script>','<script src="dev-v15.5-results.js?v=157"></script>','<script src="dev-v15.5-results.js?v=158"></script>']
    for c in candidates:
        if c in h:
            h=h.replace(c,c+'\n<script src="past-mission-import.js?v=1"></script>',1)
            break
    else:
        raise SystemExit('results script tag missing')
idx.write_text(h)

Path('deploy-platoon-import-trigger.txt').write_text('past-mission-import-v1\n')
