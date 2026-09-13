from pathlib import Path

backend = Path('supabase/functions/platoon-import/index.ts')
text = backend.read_text()
if 'async function deleteMission(' not in text:
    marker = 'async function bootstrapState('
    fn = '''async function deleteMission(supabase:any,user:any,clientKey:any){\n  const membership=await activeMembership(supabase,user.id);\n  if(!membership)throw new Error("PLATOON_ADMIN_REQUIRED");\n  if(!["chief","co_chief"].includes(membership.role))throw new Error("PLATOON_ADMIN_REQUIRED");\n  const key=text(clientKey);if(!key)throw new Error("MISSION_ID_REQUIRED");\n  const {data:mission,error:mErr}=await supabase.from("golfrecon_missions")\n    .select("id").eq("platoon_id",membership.platoon_id).eq("client_key",key).maybeSingle();\n  if(mErr)throw mErr;\n  if(mission?.id){\n    const {error:dErr}=await supabase.from("golfrecon_missions").delete().eq("id",mission.id).eq("platoon_id",membership.platoon_id);\n    if(dErr)throw dErr;\n  }\n  return readPlatoonState(supabase,membership.platoon_id);\n}\n\n'''
    if marker not in text:
        raise SystemExit('bootstrap marker not found')
    text = text.replace(marker, fn + marker, 1)
handler = 'if(body.action==="save_state")return response({platoon:await saveState(supabase,user,body.snapshot||{})});'
if 'body.action==="delete_mission"' not in text:
    replacement = 'if(body.action==="delete_mission")return response({platoon:await deleteMission(supabase,user,body.mission_id)});\n    ' + handler
    if handler not in text:
        raise SystemExit('save_state handler marker not found')
    text = text.replace(handler, replacement, 1)
backend.write_text(text)

idx = Path('index.html')
html = idx.read_text()
if 'mission-delete.js?v=3' not in html:
    if 'mission-delete.js?v=2' in html:
        html = html.replace('mission-delete.js?v=2','mission-delete.js?v=3')
    elif 'mission-delete.js?v=1' in html:
        html = html.replace('mission-delete.js?v=1','mission-delete.js?v=3')
    else:
        html = html.replace('<script src="past-mission-import.js?v=4"></script>', '<script src="past-mission-import.js?v=4"></script>\n<script src="mission-delete.js?v=3"></script>')
idx.write_text(html)

trigger = Path('deploy-platoon-import-trigger.txt')
trigger.write_text('mission-ui-fixes-v3\n')
