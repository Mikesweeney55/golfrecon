import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    confidence: {
      type: "number"
    },
    warnings: {
      type: "array",
      items: {
        type: "string"
      }
    },
    round: {
      type: "object",
      additionalProperties: false,
      properties: {
        source_app: {
          type: "string"
        },
        course_name: {
          type: [
            "string",
            "null"
          ]
        },
        course_id: {
          type: [
            "string",
            "null"
          ]
        },
        date: {
          type: [
            "string",
            "null"
          ]
        },
        tees: {
          type: [
            "string",
            "null"
          ]
        },
        course_par: {
          type: [
            "integer",
            "null"
          ]
        },
        course_rating: {
          type: [
            "number",
            "null"
          ]
        },
        course_slope: {
          type: [
            "integer",
            "null"
          ]
        },
        holes: {
          type: [
            "integer",
            "null"
          ]
        },
        gross_score: {
          type: [
            "integer",
            "null"
          ]
        },
        net_score: {
          type: [
            "integer",
            "null"
          ]
        },
        total_putts: {
          type: [
            "integer",
            "null"
          ]
        },
        fairways_hit: {
          type: [
            "integer",
            "null"
          ]
        },
        gir: {
          type: [
            "integer",
            "null"
          ]
        },
        fairway_distribution: {
          type: [
            "object",
            "null"
          ],
          additionalProperties: false,
          properties: {
            hit_pct: {
              type: [
                "number",
                "null"
              ]
            },
            left_pct: {
              type: [
                "number",
                "null"
              ]
            },
            right_pct: {
              type: [
                "number",
                "null"
              ]
            },
            short_pct: {
              type: [
                "number",
                "null"
              ]
            },
            long_pct: {
              type: [
                "number",
                "null"
              ]
            }
          },
          required: [
            "hit_pct",
            "left_pct",
            "right_pct",
            "short_pct",
            "long_pct"
          ]
        },
        gir_distribution: {
          type: [
            "object",
            "null"
          ],
          additionalProperties: false,
          properties: {
            hit_pct: {
              type: [
                "number",
                "null"
              ]
            },
            short_pct: {
              type: [
                "number",
                "null"
              ]
            },
            left_pct: {
              type: [
                "number",
                "null"
              ]
            },
            right_pct: {
              type: [
                "number",
                "null"
              ]
            },
            long_pct: {
              type: [
                "number",
                "null"
              ]
            },
            other_pct: {
              type: [
                "number",
                "null"
              ]
            }
          },
          required: [
            "hit_pct",
            "short_pct",
            "left_pct",
            "right_pct",
            "long_pct",
            "other_pct"
          ]
        },
        holes_detail: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              hole: {
                type: "integer"
              },
              par: {
                type: [
                  "integer",
                  "null"
                ]
              },
              handicap: {
                type: [
                  "integer",
                  "null"
                ]
              },
              score: {
                type: [
                  "integer",
                  "null"
                ]
              },
              fairway_hit: {
                type: [
                  "boolean",
                  "null"
                ]
              },
              gir: {
                type: [
                  "boolean",
                  "null"
                ]
              },
              putts: {
                type: [
                  "integer",
                  "null"
                ]
              },
              chips: {
                type: [
                  "integer",
                  "null"
                ]
              },
              sand: {
                type: [
                  "integer",
                  "null"
                ]
              },
              penalties: {
                type: [
                  "integer",
                  "null"
                ]
              },
              first_putt_distance_ft: {
                type: [
                  "number",
                  "null"
                ]
              },
              putting_sg: {
                type: [
                  "number",
                  "null"
                ]
              }
            },
            required: [
              "hole",
              "par",
              "handicap",
              "score",
              "fairway_hit",
              "gir",
              "putts",
              "chips",
              "sand",
              "penalties",
              "first_putt_distance_ft",
              "putting_sg"
            ]
          }
        }
      },
      required: [
        "source_app",
        "course_name",
        "course_id",
        "date",
        "tees",
        "course_par",
        "course_rating",
        "course_slope",
        "holes",
        "gross_score",
        "net_score",
        "total_putts",
        "fairways_hit",
        "gir",
        "fairway_distribution",
        "gir_distribution",
        "holes_detail"
      ]
    }
  },
  required: [
    "confidence",
    "warnings",
    "round"
  ]
};
function coreSlug(s) {
  return String(s || "").toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
function coreNormName(s) {
  return String(s || "").toLowerCase().replace(/&/g, " and ").replace(/\bscottish\b/g, "scot").replace(/\bcountry\s+club\b/g, "cc").replace(/\bgolf\s+club\b/g, "").replace(/\bgolf\s+course\b/g, "").replace(/\bthe\b/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function coreNormTee(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}
function coreNameScore(a, b) {
  const na = coreNormName(a), nb = coreNormName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  if (na.includes(nb) || nb.includes(na)) return 88;
  const A = new Set(na.split(" ")), B = new Set(nb.split(" "));
  const hit = [
    ...A
  ].filter((x)=>B.has(x)).length;
  const union = new Set([
    ...A,
    ...B
  ]).size;
  return union ? 100 * hit / union : 0;
}
const CORE_CALUSA_BLUE = {
  I: {
    rating: 75.3,
    slope: 143
  },
  II: {
    rating: 71.5,
    slope: 135
  },
  III: {
    rating: 69.2,
    slope: 127
  },
  IV: {
    rating: 65.4,
    slope: 115
  },
  V: {
    rating: 62.8,
    slope: 108
  },
  VI: {
    rating: 59.9,
    slope: 102
  }
};
const CORE_CALUSA_BLUE_PARS = [
  4,
  4,
  5,
  5,
  4,
  3,
  4,
  3,
  4,
  4,
  4,
  5,
  4,
  3,
  5,
  4,
  3,
  4
];
const CORE_CALUSA_BLUE_HCP = [
  5,
  13,
  3,
  1,
  11,
  15,
  9,
  17,
  7,
  14,
  12,
  4,
  6,
  16,
  2,
  10,
  18,
  8
];
const CORE_CALUSA_GREEN_PARS = [
  4,
  5,
  3,
  5,
  4,
  4,
  4,
  3,
  4,
  5,
  3,
  4
];
const CORE_CALUSA_GREEN_HCP = [
  13,
  7,
  1,
  9,
  15,
  5,
  11,
  17,
  3,
  4,
  14,
  18
];
function coreRomanTee(v) {
  const s = String(v || "").toUpperCase().replace(/[^IVX]/g, "").trim();
  return [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI"
  ].includes(s) ? s : null;
}
async function ensureCoreCourse(supabase, r) {
  const explicitId = String(r.course_id || "").trim();
  if (explicitId) {
    const { data } = await supabase.from("golfiq_courses").select("*").eq("id", explicitId).maybeSingle();
    if (data) return data;
  }
  const incoming = String(r.course_name || "").trim();
  const tee = String(r.tees || "").trim();
  const holes = Number(r.holes) || (r.holes_detail || []).length || 0;
  if (coreNormName(incoming).includes("calusa")) {
    const rt = coreRomanTee(tee);
    if (rt && holes === 18) {
      const rs = CORE_CALUSA_BLUE[rt];
      const id = `calusa-country-club-blue-${rt.toLowerCase()}-18-holes`;
      const row = {
        id,
        name: "Calusa Country Club — Blue",
        base_name: "Calusa Country Club — Blue",
        tees: rt,
        yardage: 0,
        slope: rs.slope,
        rating: rs.rating,
        par: 72,
        pars: CORE_CALUSA_BLUE_PARS,
        hole_numbers: Array.from({
          length: 18
        }, (_, i)=>i + 1),
        handicaps: CORE_CALUSA_BLUE_HCP,
        segment: "18 holes",
        imported: true,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("golfiq_courses").upsert(row, {
        onConflict: "id"
      });
      if (error) throw error;
      return row;
    }
    if (rt && holes === 12) {
      const id = `calusa-country-club-green-${rt.toLowerCase()}-12-holes`;
      const row = {
        id,
        name: "Calusa Country Club — Green",
        base_name: "Calusa Country Club — Green",
        tees: rt,
        yardage: 0,
        slope: null,
        rating: null,
        par: 48,
        pars: CORE_CALUSA_GREEN_PARS,
        hole_numbers: Array.from({
          length: 12
        }, (_, i)=>i + 1),
        handicaps: CORE_CALUSA_GREEN_HCP,
        segment: "12 holes",
        imported: true,
        updated_at: new Date().toISOString()
      };
      const { error } = await supabase.from("golfiq_courses").upsert(row, {
        onConflict: "id"
      });
      if (error) throw error;
      return row;
    }
  }
  const { data: courses, error: courseErr } = await supabase.from("golfiq_courses").select("*");
  if (courseErr) throw courseErr;
  const nt = coreNormTee(tee);
  const ranked = (courses || []).map((c)=>{
    const ns = Math.max(coreNameScore(incoming, c.name), coreNameScore(incoming, c.base_name));
    const teeMatch = nt && coreNormTee(c.tees) === nt;
    return {
      c,
      score: ns + (teeMatch ? 12 : 0),
      nameScore: ns,
      teeMatch
    };
  }).filter((x)=>x.nameScore >= 58).sort((a, b)=>b.score - a.score);
  if (ranked.length) {
    if (nt) {
      const exact = ranked.find((x)=>x.teeMatch);
      if (exact) return exact.c;
    } else {
      return ranked[0].c;
    }
  }
  const hd = (r.holes_detail || []).slice().sort((a, b)=>Number(a.hole) - Number(b.hole));
  if (!incoming || !holes) throw new Error("Cannot create course without course name and hole count.");
  const holeNumbers = hd.length ? hd.map((h)=>Number(h.hole)) : Array.from({
    length: holes
  }, (_, i)=>i + 1);
  const pars = hd.length ? hd.map((h)=>h.par == null ? null : Number(h.par)) : Array(holes).fill(null);
  const handicaps = hd.length ? hd.map((h)=>h.handicap == null ? null : Number(h.handicap)) : Array(holes).fill(null);
  const allPars = pars.length && pars.every((x)=>Number.isFinite(x));
  const par = Number.isFinite(Number(r.course_par)) ? Number(r.course_par) : allPars ? pars.reduce((a, b)=>a + b, 0) : null;
  const rating = Number.isFinite(Number(r.course_rating)) ? Number(r.course_rating) : null;
  const slope = Number.isFinite(Number(r.course_slope)) ? Number(r.course_slope) : null;
  const segment = holes === 18 ? "18 holes" : holes === 12 ? "12 holes" : holeNumbers[0] === 1 ? "Front 9" : "9 holes";
  let id = coreSlug(`${incoming}-${tee || "tees"}-${segment}`);
  let n = 2, base = id;
  while((courses || []).some((c)=>c.id === id))id = `${base}-${n++}`;
  const row = {
    id,
    name: incoming,
    base_name: incoming,
    tees: tee || "Unknown",
    yardage: 0,
    slope,
    rating,
    par,
    pars,
    hole_numbers: holeNumbers,
    handicaps,
    segment,
    imported: true,
    updated_at: new Date().toISOString()
  };
  const { error } = await supabase.from("golfiq_courses").upsert(row, {
    onConflict: "id"
  });
  if (error) throw error;
  return row;
}
async function requireGolfIQUser(req, supabase) {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("AUTH_REQUIRED");
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user) throw new Error("AUTH_REQUIRED");
  return data.user;
}
function cleanUsername(v) {
  const s = String(v || "").trim().replace(/[^A-Za-z0-9_.-]/g, "").slice(0, 24);
  return s || "golfer";
}
/** PostgREST .eq(col, null) becomes eq.null → Postgres cast error: integer "null". */
function intOrNull(v) {
  if (v === null || v === undefined || v === "" || v === "null") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}
function intArrOrNulls(arr) {
  return (Array.isArray(arr) ? arr : []).map(intOrNull);
}
async function ensureUserProfile(supabase, user) {
  const { data: found, error: findErr } = await supabase.from("golfiq_user_profiles").select("*").eq("user_id", user.id).maybeSingle();
  if (findErr) throw findErr;
  if (found) return found;
  let base = cleanUsername(user.user_metadata?.username || String(user.email || "golfer").split("@")[0]);
  let username = base;
  for(let i = 0; i < 20; i++){
    const { data: taken, error: takenErr } = await supabase.from("golfiq_user_profiles").select("user_id").ilike("username", username).maybeSingle();
    if (takenErr) throw takenErr;
    if (!taken) break;
    username = `${base.slice(0, 18)}${i + 2}`;
  }
  const row = {
    user_id: user.id,
    username,
    display_name: user.user_metadata?.display_name || username,
    handicap: null,
    swing_thoughts: {
      driver: [],
      irons: [],
      chipping: [],
      putting: []
    },
    updated_at: new Date().toISOString()
  };
  const { data, error } = await supabase.from("golfiq_user_profiles").insert(row).select("*").single();
  if (error) throw error;
  return data;
}
async function claimLegacyData(supabase, user) {
  let { data: owner, error: ownerErr } = await supabase.from("golfiq_meta").select("value").eq("key", "legacy_owner_user_id").maybeSingle();
  if (ownerErr) throw ownerErr;
  if (!owner) {
    const { error: insertErr } = await supabase.from("golfiq_meta").insert({
      key: "legacy_owner_user_id",
      value: {
        user_id: user.id,
        claimed_at: new Date().toISOString()
      },
      updated_at: new Date().toISOString()
    });
    if (insertErr && insertErr.code !== "23505") throw insertErr;
    const reread = await supabase.from("golfiq_meta").select("value").eq("key", "legacy_owner_user_id").single();
    if (reread.error) throw reread.error;
    owner = reread.data;
  }
  if (owner?.value?.user_id !== user.id) return false;
  for (const table of [
    "golfiq_round_imports",
    "golfiq_rounds",
    "golfiq_putting_details"
  ]){
    const { error } = await supabase.from(table).update({
      user_id: user.id
    }).is("user_id", null);
    if (error) throw error;
  }
  const { data: legacyProfile, error: legacyProfileErr } = await supabase.from("golfiq_profile").select("*").eq("id", "default").maybeSingle();
  if (legacyProfileErr) throw legacyProfileErr;
  const { data: currentProfile, error: currentProfileErr } = await supabase.from("golfiq_user_profiles").select("*").eq("user_id", user.id).single();
  if (currentProfileErr) throw currentProfileErr;
  if (legacyProfile && currentProfile?.handicap == null) {
    const { error } = await supabase.from("golfiq_user_profiles").update({
      display_name: legacyProfile.name || currentProfile.display_name,
      handicap: intOrNull(legacyProfile.handicap),
      updated_at: new Date().toISOString()
    }).eq("user_id", user.id);
    if (error) throw error;
  }
  const { data: legacyClubs, error: clubsErr } = await supabase.from("golfiq_club_stats").select("*");
  if (clubsErr) throw clubsErr;
  if (legacyClubs?.length) {
    const rows = legacyClubs.map((x)=>({
        user_id: user.id,
        club: x.club,
        distance: x.distance,
        updated_at: new Date().toISOString()
      }));
    const { error } = await supabase.from("golfiq_user_club_stats").upsert(rows, {
      onConflict: "user_id,club"
    });
    if (error) throw error;
  }
  return true;
}
function mergeMissingArray(existing, incoming) {
  const a = Array.isArray(existing) ? existing : [];
  const b = Array.isArray(incoming) ? incoming : [];
  const n = Math.max(a.length, b.length);
  return Array.from({
    length: n
  }, (_, i)=>a[i] !== null && a[i] !== undefined ? a[i] : b[i] ?? null);
}
function mergeMissingObject(existing, incoming) {
  if (existing == null) return incoming ?? null;
  if (incoming == null) return existing;
  const out = {
    ...existing
  };
  for (const [k, v] of Object.entries(incoming)){
    if (out[k] === null || out[k] === undefined) out[k] = v;
  }
  return out;
}
// Directional screenshots are supplemental source-of-truth data.
// If a backfill/import supplies a non-null directional value, use it.
// Preserve the existing value only when the incoming screenshot did not provide one.
function mergeDirectionalObject(existing, incoming) {
  if (existing == null) return incoming ?? null;
  if (incoming == null) return existing;
  const out = {
    ...existing
  };
  for (const [k, v] of Object.entries(incoming)){
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}
function mergeBackfillParsed(existingParsed, backfillParsed) {
  const out = structuredClone(existingParsed || {
    confidence: 0,
    warnings: [],
    round: {
      holes_detail: []
    }
  });
  const br = backfillParsed?.round || {};
  out.round = out.round || {};
  const er = out.round;
  const roundFields = [
    "course_par",
    "course_rating",
    "course_slope",
    "total_putts",
    "fairways_hit",
    "gir"
  ];
  for (const k of roundFields){
    if ((er[k] === null || er[k] === undefined) && br[k] !== null && br[k] !== undefined) er[k] = br[k];
  }
  er.fairway_distribution = mergeDirectionalObject(er.fairway_distribution, br.fairway_distribution);
  er.gir_distribution = mergeDirectionalObject(er.gir_distribution, br.gir_distribution);
  const byHole = new Map();
  for (const h of er.holes_detail || [])byHole.set(Number(h.hole), structuredClone(h));
  const holeFields = [
    "par",
    "handicap",
    "score",
    "fairway_hit",
    "gir",
    "putts",
    "chips",
    "sand",
    "penalties",
    "first_putt_distance_ft",
    "putting_sg"
  ];
  for (const h of br.holes_detail || []){
    const hn = Number(h.hole);
    if (!Number.isFinite(hn)) continue;
    const cur = byHole.get(hn) || {
      hole: hn,
      par: null,
      handicap: null,
      score: null,
      fairway_hit: null,
      gir: null,
      putts: null,
      chips: null,
      sand: null,
      penalties: null,
      first_putt_distance_ft: null,
      putting_sg: null
    };
    for (const k of holeFields){
      if ((cur[k] === null || cur[k] === undefined) && h[k] !== null && h[k] !== undefined) cur[k] = h[k];
    }
    byHole.set(hn, cur);
  }
  er.holes_detail = [
    ...byHole.values()
  ].sort((a, b)=>Number(a.hole) - Number(b.hole));
  out.confidence = Math.max(Number(out.confidence) || 0, Number(backfillParsed?.confidence) || 0);
  out.warnings = [
    ...new Set([
      ...out.warnings || [],
      ...backfillParsed?.warnings || []
    ])
  ];
  return out;
}
async function syncImportToCore(supabase, imp, userId) {
  const parsed = imp?.parsed;
  const r = parsed?.round;
  if (!r) return;
  const c = await ensureCoreCourse(supabase, r);
  const hd = (r.holes_detail || []).slice().sort((a, b)=>Number(a.hole) - Number(b.hole));
  const holes = Number(r.holes) || hd.length || Number(c.hole_numbers?.length) || 18;
  const arr = (key)=>intArrOrNulls(Array.from({
      length: holes
    }, (_, i)=>{
      const hn = Number(c.hole_numbers?.[i] ?? i + 1);
      const h = hd.find((x)=>Number(x.hole) === hn) || hd[i];
      return h?.[key] ?? null;
    }));
  const boolArr = (key)=>arr(key).map((v)=>v === true || v === 1 ? 1 : v === false || v === 0 ? 0 : null);
  const gross = intOrNull(r.gross_score ?? imp.gross_score);
  const net = intOrNull(r.net_score ?? imp.net_score);
  const scoreToPar = gross != null && Number.isFinite(Number(c.par)) ? gross - Number(c.par) : null;
  const importKey = `import:${imp.id}`;
  const roundValues = {
    user_id: userId,
    played_on: r.date,
    course_id: c.id,
    gross,
    net,
    score_to_par: scoreToPar,
    holes: intOrNull(holes) || 18,
    scores: arr("score"),
    fairways: boolArr("fairway_hit"),
    gir: boolArr("gir"),
    putts: arr("putts"),
    chips: arr("chips"),
    sand: arr("sand"),
    penalties: arr("penalties"),
    source: r.source_app || imp.source_app || "18Birdies",
    import_confidence: parsed.confidence ?? null,
    fairway_distribution: r.fairway_distribution ? {
      hitPct: r.fairway_distribution.hit_pct,
      missLeftPct: r.fairway_distribution.left_pct,
      missRightPct: r.fairway_distribution.right_pct,
      missShortPct: r.fairway_distribution.short_pct,
      missLongPct: r.fairway_distribution.long_pct,
      missFairwaysHitPct: 0
    } : null,
    gir_distribution: r.gir_distribution ? {
      hitPct: r.gir_distribution.hit_pct,
      missShortPct: r.gir_distribution.short_pct,
      missLeftPct: r.gir_distribution.left_pct,
      missRightPct: r.gir_distribution.right_pct,
      missLongPct: r.gir_distribution.long_pct,
      missGirPct: r.gir_distribution.other_pct,
      noChancePct: 0
    } : null,
    import_id: imp.id,
    updated_at: new Date().toISOString()
  };
  let matchQ = supabase.from("golfiq_rounds").select("*").eq("user_id", userId).eq("played_on", r.date).eq("course_id", c.id).eq("holes", roundValues.holes).neq("source_key", importKey);
  // Never .eq(col, null) — PostgREST sends eq.null and Postgres rejects integer "null".
  matchQ = gross == null ? matchQ.is("gross", null) : matchQ.eq("gross", gross);
  const { data: matches, error: matchErr } = await matchQ.limit(1);
  if (matchErr) throw matchErr;
  const existing = (matches || [])[0];
  if (existing) {
    const mergedValues = {
      ...roundValues,
      scores: mergeMissingArray(existing.scores, roundValues.scores),
      fairways: mergeMissingArray(existing.fairways, roundValues.fairways),
      gir: mergeMissingArray(existing.gir, roundValues.gir),
      putts: mergeMissingArray(existing.putts, roundValues.putts),
      chips: mergeMissingArray(existing.chips, roundValues.chips),
      sand: mergeMissingArray(existing.sand, roundValues.sand),
      penalties: mergeMissingArray(existing.penalties, roundValues.penalties),
      fairway_distribution: mergeDirectionalObject(existing.fairway_distribution, roundValues.fairway_distribution),
      gir_distribution: mergeDirectionalObject(existing.gir_distribution, roundValues.gir_distribution)
    };
    const { error: updateErr } = await supabase.from("golfiq_rounds").update(mergedValues).eq("id", existing.id).eq("user_id", userId);
    if (updateErr) throw updateErr;
    const { error: dupDelErr } = await supabase.from("golfiq_rounds").delete().eq("source_key", importKey).eq("user_id", userId);
    if (dupDelErr) throw dupDelErr;
  } else {
    const { error: roundErr } = await supabase.from("golfiq_rounds").upsert({
      source_key: importKey,
      ...roundValues
    }, {
      onConflict: "source_key"
    });
    if (roundErr) throw roundErr;
  }
  const { error: importPutDelErr } = await supabase.from("golfiq_putting_details").delete().eq("import_id", imp.id).eq("user_id", userId);
  if (importPutDelErr) throw importPutDelErr;
  const putRows = hd.filter((h)=>h.first_putt_distance_ft != null && h.putts != null).map((h)=>({
      user_id: userId,
      source_key: `import:${imp.id}:putt:${h.hole}`,
      round_date: r.date,
      course_id: c.id,
      hole: Number(h.hole),
      distance: Number(h.first_putt_distance_ft),
      putts: Number(h.putts),
      sg: h.putting_sg == null ? 0 : Number(h.putting_sg),
      import_id: imp.id,
      updated_at: new Date().toISOString()
    }));
  if (putRows.length) {
    if (existing) {
      const { error: legacyPutDelErr } = await supabase.from("golfiq_putting_details").delete().eq("user_id", userId).eq("round_date", r.date).eq("course_id", c.id).is("import_id", null);
      if (legacyPutDelErr) throw legacyPutDelErr;
    }
    const { error: putErr } = await supabase.from("golfiq_putting_details").upsert(putRows, {
      onConflict: "source_key"
    });
    if (putErr) throw putErr;
  }
}
async function syncAllImportsToCore(supabase, userId) {
  const { data: imports, error } = await supabase.from("golfiq_round_imports").select("id,user_id,source_app,course_name,course_id,played_on,tees,holes,gross_score,net_score,total_putts,fairways_hit,gir,parsed").eq("user_id", userId).order("created_at", {
    ascending: true
  });
  if (error) throw error;
  for (const imp of imports || [])await syncImportToCore(supabase, imp, userId);
  return (imports || []).length;
}
async function bootstrapCore(supabase, user) {
  await ensureUserProfile(supabase, user);
  const claimedLegacy = await claimLegacyData(supabase, user);
  const importedCount = await syncAllImportsToCore(supabase, user.id);
  const [profileRes, coursesRes, roundsRes, putRes, clubsRes] = await Promise.all([
    supabase.from("golfiq_user_profiles").select("*").eq("user_id", user.id).single(),
    supabase.from("golfiq_courses").select("*").order("name", {
      ascending: true
    }),
    supabase.from("golfiq_rounds").select("*").eq("user_id", user.id).order("played_on", {
      ascending: true
    }),
    supabase.from("golfiq_putting_details").select("*").eq("user_id", user.id).order("round_date", {
      ascending: true
    }),
    supabase.from("golfiq_user_club_stats").select("*").eq("user_id", user.id).order("club", {
      ascending: true
    })
  ]);
  for (const r of [
    profileRes,
    coursesRes,
    roundsRes,
    putRes,
    clubsRes
  ])if (r.error) throw r.error;
  const courses = (coursesRes.data || []).map((c)=>({
      id: c.id,
      name: c.name,
      baseName: c.base_name,
      tees: c.tees,
      yardage: c.yardage ?? 0,
      slope: c.slope == null ? null : Number(c.slope),
      rating: c.rating == null ? null : Number(c.rating),
      par: c.par,
      pars: c.pars || [],
      holeNumbers: c.hole_numbers || [],
      handicaps: c.handicaps || [],
      segment: c.segment,
      imported: c.imported
    }));
  const cmap = new Map(courses.map((c)=>[
      c.id,
      c
    ]));
  const rounds = (roundsRes.data || []).map((r)=>({
      id: r.id,
      date: r.played_on,
      courseId: r.course_id,
      gross: r.gross,
      net: r.net,
      scoreToPar: r.score_to_par == null ? null : Number(r.score_to_par),
      holes: r.holes,
      scores: r.scores || [],
      fairways: r.fairways || [],
      gir: r.gir || [],
      putts: r.putts || [],
      chips: r.chips || [],
      sand: r.sand || [],
      penalties: r.penalties || [],
      source: r.source,
      importConfidence: r.import_confidence == null ? null : Number(r.import_confidence),
      fairwayDistribution: r.fairway_distribution || undefined,
      girDistribution: r.gir_distribution || undefined,
      supabaseImportId: r.import_id || null,
      sourceKey: r.source_key
    }));
  const puttingDetails = (putRes.data || []).map((p)=>({
      date: p.round_date,
      course: cmap.get(p.course_id)?.name || p.course_id,
      hole: p.hole,
      distance: p.distance == null ? null : Number(p.distance),
      putts: p.putts,
      sg: p.sg == null ? 0 : Number(p.sg),
      supabaseImportId: p.import_id || null
    }));
  const p = profileRes.data;
  const player = {
    id: user.id,
    name: p.display_name || p.username,
    username: p.username,
    handicap: p.handicap == null ? null : Number(p.handicap)
  };
  const swingThoughts = p.swing_thoughts || {
    driver: [],
    irons: [],
    chipping: [],
    putting: []
  };
  const clubStats = (clubsRes.data || []).map((x)=>({
      club: x.club,
      distance: x.distance == null ? null : Number(x.distance)
    }));
  return {
    player,
    swingThoughts,
    courses,
    rounds,
    puttingDetails,
    clubStats,
    importedCount,
    claimedLegacy
  };
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response("ok", {
    headers: corsHeaders
  });
  try {
    const body = await req.json();
    const authSupabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
    const user = await requireGolfIQUser(req, authSupabase);
    if (body.action === "parse") {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) throw new Error("OPENAI_API_KEY secret is not configured.");
      const content = [
        {
          type: "input_text",
          text: `You are the GolfIQ import parser. Read screenshots from ${body.source || "18Birdies"}.
Extract only facts visible in the screenshots. Never guess.
The screenshots may include scorecards, putting shot lists, fairway miss distributions, GIR distributions, or overlapping pages.
Merge all screenshots into one round.
${body.mode === "backfill" ? `BACKFILL MODE:
- The target round ALREADY EXISTS. These screenshots are supplemental data for that selected round, not a new round import.
- Do NOT try to construct or validate a complete new round from these screenshots.
- Use the target note as authoritative round identity/context (course/date/tees/score/holes) and do not warn that those fields are absent from the screenshots.
- If the screenshots only show directional Fairway/GIR data, extract only fairway_distribution and/or gir_distribution and leave unrelated fields null.
- Do NOT compare Fairway and GIR screen sample counts as if they must match. They represent different shot populations for the same round.
- Do NOT produce warnings just because one directional screen shows a different attempt count than another.
- Only warn about an actual contradiction within the same statistic or unreadable/ambiguous directional values.
` : ""}
For first_putt_distance_ft, this means the starting distance of the FIRST putt on that green.
For fairway_hit and gir, use null when not applicable or unreadable.
IMPORTANT DIRECTIONAL DATA RULES:
- Fairway/GIR directional screenshots are supplemental data and must be extracted even when the round already has complete fairway_hit or gir hole values.
- For fairway_distribution, map every clearly visible directional result to hit_pct, left_pct, right_pct, short_pct, and long_pct.
- For gir_distribution, map every clearly visible directional result to hit_pct, short_pct, left_pct, right_pct, long_pct, and other_pct.
- If a directional screen shows counts rather than percentages, calculate percentages only when the complete visible counts provide an unambiguous denominator. This arithmetic is allowed; do not estimate from bar lengths or graphics.
- If a direction is not shown or cannot be read, return null for that field. Do NOT use 0 to mean unknown.
- In BACKFILL MODE, directional distribution values are allowed and expected even if there are zero FH or GIR hole-level gaps.
- Treat Fairway and GIR directional screenshots as supplemental views of the already-selected round. They do not need to contain date, tees, score, or hole-by-hole data.
- Never infer that directional screenshots represent multiple rounds unless the screenshot explicitly says they are an aggregate across rounds.
For course_id, leave null unless it is explicitly known from the note.
Extract course_par, course_rating, and course_slope when visible in the course header or scorecard; otherwise return null.
Preserve the tee exactly as shown. For Calusa Country Club, tee values are Roman numerals I, II, III, IV, V, or VI. The 18-hole layout is called Blue and the 12-hole layout is called Green. If the screenshot shows Calusa and the hole count makes the layout clear, include Blue or Green in course_name.
Use YYYY-MM-DD dates. If the year is not visible and cannot be safely inferred, use null.
Check arithmetic: gross_score should equal hole scores when all are present; total_putts should equal hole putts when all are present.
Put uncertainty or conflicting screenshot information into warnings.
Optional user note: ${body.note || "(none)"}`
        }
      ];
      for (const img of body.images || []){
        content.push({
          type: "input_image",
          image_url: `data:${img.type};base64,${img.data}`,
          detail: "high"
        });
      }
      const ai = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.6",
          input: [
            {
              role: "user",
              content
            }
          ],
          text: {
            format: {
              type: "json_schema",
              name: "golfiq_round_import",
              strict: true,
              schema
            }
          }
        })
      });
      const raw = await ai.json();
      if (!ai.ok) throw new Error(raw?.error?.message || "OpenAI parsing failed.");
      const outputText = raw.output_text ?? raw.output?.flatMap((o)=>o.content || []).find((c)=>c.type === "output_text")?.text;
      if (!outputText) throw new Error("No structured result returned.");
      const parsed = JSON.parse(outputText);
      return new Response(JSON.stringify(parsed), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "bootstrap") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const data = await bootstrapCore(supabase, user);
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "chat") {
      const key = Deno.env.get("OPENAI_API_KEY");
      if (!key) throw new Error("OPENAI_API_KEY secret is not configured.");
      const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
      const transcript = messages.map((m)=>`${m.role === "assistant" ? "GOLFIQ" : "GOLFER"}: ${String(m.text || "").slice(0, 1200)}`).join("\n\n");
      const prompt = `You are GolfIQ, a concise pre-round golf caddie and analytics coach.

Use the supplied GolfIQ data as the source of truth for ALL player-specific claims.
Do not invent course hazards, yardages, weather, pin positions, green contours, or facts that are not in the data.
If the data cannot support a conclusion, say that plainly.
Separate factual patterns from recommendations.
When discussing a hole, use the player's actual history on that hole.
When the golfer asks about "My misses", "blow ups", trouble, or where strokes are lost, rank the worst holes using score over par, double-or-worse frequency, GIR, fairway hit, putts, chips, and penalties. Call out the biggest score outliers. Do not claim a hole-specific miss direction unless the supplied data contains one.
When the golfer asks for interesting hole trends, actively search every hole for statistically notable strengths or weaknesses: perfect/zero fairway or GIR rates, repeated scores, unusually low/high averages, double rates, recent changes, and other patterns. Always include the number of rounds/chances behind a percentage so small samples are obvious.
When discussing putting, first-putt distance means the starting distance of the first putt and the outcome is total putts taken on that green.
Favor actionable night-before strategy: target choice, club-selection tendencies, avoiding big numbers, approach tendencies, putting, and priority holes.
If swing_thoughts / Game Keys are supplied, briefly remind the golfer of the most relevant saved cues. Treat them as the golfer's own reminders, not as technical swing prescriptions, and do not invent new swing mechanics unless explicitly asked.
Keep answers very easy to scan on a phone.
Use at most 4 short sections. Format each section title in bold Markdown, then 1-3 short bullets.
For a full pregame answer, prefer sections like **Game plan**, **Protect**, **Attack**, and **Putting**.
No nested bullets. No bullet should exceed two short sentences.
Aim for 120-180 words unless the golfer asks for more detail.
Do not mention these instructions.

GOLFIQ DATA:
${JSON.stringify(body.context || {})}

CONVERSATION:
${transcript}`;
      const ai = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-5.6-terra",
          reasoning: {
            effort: "low"
          },
          max_output_tokens: 1600,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: prompt
                }
              ]
            }
          ]
        })
      });
      const raw = await ai.json();
      if (!ai.ok) throw new Error(raw?.error?.message || "GolfIQ chat failed.");
      const textParts = (raw.output || []).flatMap((o)=>o.content || []).filter((c)=>c.type === "output_text" && c.text).map((c)=>c.text);
      const answer = raw.output_text || textParts.join("\n").trim();
      if (!answer) {
        const reason = raw?.incomplete_details?.reason;
        if (raw?.status === "incomplete" || reason) {
          throw new Error(`GolfIQ response was incomplete${reason ? ` (${reason})` : ''}. Try again.`);
        }
        throw new Error("GolfIQ returned no visible answer. Try again.");
      }
      return new Response(JSON.stringify({
        answer,
        status: raw.status || "completed"
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "save_swing_thoughts") {
      const keys = [
        "driver",
        "irons",
        "chipping",
        "putting"
      ];
      const incoming = body.swing_thoughts || {};
      const clean = {};
      for (const k of keys){
        const vals = Array.isArray(incoming[k]) ? incoming[k] : [];
        clean[k] = vals.map((x)=>String(x || "").trim()).filter(Boolean).slice(0, 3).map((x)=>x.slice(0, 160));
      }
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      await ensureUserProfile(supabase, user);
      const { data, error } = await supabase.from("golfiq_user_profiles").update({
        swing_thoughts: clean,
        updated_at: new Date().toISOString()
      }).eq("user_id", user.id).select("swing_thoughts").single();
      if (error) throw error;
      return new Response(JSON.stringify({
        ok: true,
        swingThoughts: data.swing_thoughts
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "list") {
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const { data, error } = await supabase.from("golfiq_round_imports").select("id,created_at,user_id,source_app,course_name,course_id,played_on,tees,holes,gross_score,net_score,total_putts,fairways_hit,gir,parsed").eq("user_id", user.id).order("played_on", {
        ascending: true
      }).order("created_at", {
        ascending: true
      });
      if (error) throw error;
      return new Response(JSON.stringify({
        imports: data || []
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "backfill") {
      const roundId = String(body.round_id || "").trim();
      const parsed = body.parsed;
      if (!roundId) throw new Error("Missing round id.");
      if (!parsed?.round) throw new Error("No parsed backfill data supplied.");
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const { data: target, error: targetErr } = await supabase.from("golfiq_rounds").select("*").eq("id", roundId).eq("user_id", user.id).single();
      if (targetErr) throw targetErr;
      let filled = 0;
      const countFilled = (before, after)=>{
        const a = Array.isArray(before) ? before : [], b = Array.isArray(after) ? after : [];
        for(let i = 0; i < Math.max(a.length, b.length); i++){
          if ((a[i] === null || a[i] === undefined) && b[i] !== null && b[i] !== undefined) filled++;
        }
      };
      if (target.import_id) {
        const { data: imp, error: impErr } = await supabase.from("golfiq_round_imports").select("id,user_id,source_app,course_name,course_id,played_on,tees,holes,gross_score,net_score,total_putts,fairways_hit,gir,parsed").eq("id", target.import_id).eq("user_id", user.id).single();
        if (impErr) throw impErr;
        const mergedParsed = mergeBackfillParsed(imp.parsed, parsed);
        const oldH = imp.parsed?.round?.holes_detail || [];
        const newH = mergedParsed?.round?.holes_detail || [];
        for (const nh of newH){
          const oh = oldH.find((x)=>Number(x.hole) === Number(nh.hole)) || {};
          for (const k of [
            "fairway_hit",
            "gir",
            "putts",
            "chips",
            "sand",
            "penalties",
            "first_putt_distance_ft",
            "putting_sg"
          ]){
            if ((oh[k] === null || oh[k] === undefined) && nh[k] !== null && nh[k] !== undefined) filled++;
          }
        }
        if (!imp.parsed?.round?.fairway_distribution && mergedParsed.round.fairway_distribution) filled++;
        if (!imp.parsed?.round?.gir_distribution && mergedParsed.round.gir_distribution) filled++;
        const mr = mergedParsed.round;
        const { error: updImpErr } = await supabase.from("golfiq_round_imports").update({
          parsed: mergedParsed,
          total_putts: mr.total_putts,
          fairways_hit: mr.fairways_hit,
          gir: mr.gir,
          raw_meta: {
            confidence: mergedParsed.confidence,
            warnings: mergedParsed.warnings,
            backfilled: true
          }
        }).eq("id", target.import_id).eq("user_id", user.id);
        if (updImpErr) throw updImpErr;
        const refreshed = {
          ...imp,
          parsed: mergedParsed,
          total_putts: mr.total_putts,
          fairways_hit: mr.fairways_hit,
          gir: mr.gir
        };
        await syncImportToCore(supabase, refreshed, user.id);
      } else {
        const { data: c, error: cErr } = await supabase.from("golfiq_courses").select("*").eq("id", target.course_id).single();
        if (cErr) throw cErr;
        const br = parsed.round;
        const hd = (br.holes_detail || []).slice().sort((a, b)=>Number(a.hole) - Number(b.hole));
        const holes = Number(target.holes) || Number(c.hole_numbers?.length) || hd.length;
        const incoming = (key, booleanMode = false)=>Array.from({
            length: holes
          }, (_, i)=>{
            const hn = Number(c.hole_numbers?.[i] ?? i + 1);
            const h = hd.find((x)=>Number(x.hole) === hn) || hd[i];
            const v = h?.[key] ?? null;
            if (booleanMode) return v === true ? 1 : v === false ? 0 : null;
            return v;
          });
        const merged = {
          scores: mergeMissingArray(target.scores, incoming("score")),
          fairways: mergeMissingArray(target.fairways, incoming("fairway_hit", true)),
          gir: mergeMissingArray(target.gir, incoming("gir", true)),
          putts: mergeMissingArray(target.putts, incoming("putts")),
          chips: mergeMissingArray(target.chips, incoming("chips")),
          sand: mergeMissingArray(target.sand, incoming("sand")),
          penalties: mergeMissingArray(target.penalties, incoming("penalties")),
          fairway_distribution: mergeDirectionalObject(target.fairway_distribution, br.fairway_distribution ? {
            hitPct: br.fairway_distribution.hit_pct,
            missLeftPct: br.fairway_distribution.left_pct,
            missRightPct: br.fairway_distribution.right_pct,
            missShortPct: br.fairway_distribution.short_pct,
            missLongPct: br.fairway_distribution.long_pct,
            missFairwaysHitPct: 0
          } : null),
          gir_distribution: mergeDirectionalObject(target.gir_distribution, br.gir_distribution ? {
            hitPct: br.gir_distribution.hit_pct,
            missShortPct: br.gir_distribution.short_pct,
            missLeftPct: br.gir_distribution.left_pct,
            missRightPct: br.gir_distribution.right_pct,
            missLongPct: br.gir_distribution.long_pct,
            missGirPct: br.gir_distribution.other_pct,
            noChancePct: 0
          } : null),
          updated_at: new Date().toISOString()
        };
        countFilled(target.fairways, merged.fairways);
        countFilled(target.gir, merged.gir);
        countFilled(target.putts, merged.putts);
        countFilled(target.chips, merged.chips);
        countFilled(target.sand, merged.sand);
        countFilled(target.penalties, merged.penalties);
        if (!target.fairway_distribution && merged.fairway_distribution) filled++;
        if (!target.gir_distribution && merged.gir_distribution) filled++;
        const { error: roundUpdErr } = await supabase.from("golfiq_rounds").update(merged).eq("id", roundId).eq("user_id", user.id);
        if (roundUpdErr) throw roundUpdErr;
        const { data: existingPut, error: putReadErr } = await supabase.from("golfiq_putting_details").select("hole").eq("user_id", user.id).eq("round_date", target.played_on).eq("course_id", target.course_id);
        if (putReadErr) throw putReadErr;
        const known = new Set((existingPut || []).map((x)=>Number(x.hole)));
        const newPut = hd.filter((h)=>h.first_putt_distance_ft != null && h.putts != null && !known.has(Number(h.hole))).map((h)=>({
            user_id: user.id,
            source_key: `backfill:${roundId}:putt:${h.hole}`,
            round_date: target.played_on,
            course_id: target.course_id,
            hole: Number(h.hole),
            distance: Number(h.first_putt_distance_ft),
            putts: Number(h.putts),
            sg: h.putting_sg == null ? 0 : Number(h.putting_sg),
            import_id: null,
            updated_at: new Date().toISOString()
          }));
        if (newPut.length) {
          const { error: newPutErr } = await supabase.from("golfiq_putting_details").upsert(newPut, {
            onConflict: "source_key"
          });
          if (newPutErr) throw newPutErr;
          filled += newPut.length;
        }
      }
      return new Response(JSON.stringify({
        ok: true,
        round_id: roundId,
        filled
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "delete") {
      const id = String(body.id || "").trim();
      if (!id) throw new Error("Missing import id.");
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      // Delete normalized child data first, then the canonical round,
      // then the raw import/audit record so it cannot be recreated on bootstrap.
      const { error: putErr } = await supabase.from("golfiq_putting_details").delete().eq("import_id", id).eq("user_id", user.id);
      if (putErr) throw putErr;
      const { error: roundErr } = await supabase.from("golfiq_rounds").delete().eq("import_id", id).eq("user_id", user.id);
      if (roundErr) throw roundErr;
      const { error: importErr } = await supabase.from("golfiq_round_imports").delete().eq("id", id).eq("user_id", user.id);
      if (importErr) throw importErr;
      return new Response(JSON.stringify({
        ok: true,
        id,
        deleted: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "update") {
      const id = String(body.id || "").trim();
      const changes = body.changes || {};
      if (!id) throw new Error("Missing import id.");
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const { data: existing, error: readErr } = await supabase.from("golfiq_round_imports").select("id,parsed").eq("id", id).eq("user_id", user.id).single();
      if (readErr) throw readErr;
      if (!existing?.parsed?.round) throw new Error("Imported round data not found.");
      const parsed = structuredClone(existing.parsed);
      const r = parsed.round;
      const setIf = (key, value)=>{
        if (value !== undefined) r[key] = value;
      };
      setIf("date", changes.date);
      setIf("course_name", changes.course_name);
      setIf("course_id", changes.course_id);
      setIf("tees", changes.tees);
      if (changes.gross_score !== undefined) r.gross_score = intOrNull(changes.gross_score);
      if (changes.net_score !== undefined) r.net_score = intOrNull(changes.net_score);
      setIf("course_par", changes.course_par);
      setIf("course_rating", changes.course_rating);
      setIf("course_slope", changes.course_slope);
      const updateRow = {
        parsed,
        played_on: r.date,
        course_name: r.course_name,
        course_id: r.course_id,
        tees: r.tees,
        gross_score: intOrNull(r.gross_score),
        net_score: intOrNull(r.net_score)
      };
      const { error: updateErr } = await supabase.from("golfiq_round_imports").update(updateRow).eq("id", id).eq("user_id", user.id);
      if (updateErr) throw updateErr;
      const { data: updatedImport, error: updatedReadErr } = await supabase.from("golfiq_round_imports").select("id,user_id,source_app,course_name,course_id,played_on,tees,holes,gross_score,net_score,total_putts,fairways_hit,gir,parsed").eq("id", id).eq("user_id", user.id).single();
      if (updatedReadErr) throw updatedReadErr;
      await syncImportToCore(supabase, updatedImport, user.id);
      return new Response(JSON.stringify({
        ok: true,
        id,
        parsed,
        coreSynced: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    if (body.action === "save") {
      const parsed = body.parsed;
      if (!parsed?.round) throw new Error("No parsed round supplied.");
      const r = parsed.round;
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      const saveGross = intOrNull(r.gross_score);
      const saveHoles = intOrNull(r.holes) || 18;
      let q = supabase.from("golfiq_round_imports").select("id").eq("played_on", r.date).eq("holes", saveHoles).eq("user_id", user.id);
      q = saveGross == null ? q.is("gross_score", null) : q.eq("gross_score", saveGross);
      if ((r.tees || "").trim()) q = q.ilike("tees", (r.tees || "").trim());
      if ((r.course_name || "").trim()) q = q.ilike("course_name", (r.course_name || "").trim());
      const { data: dupes, error: dupErr } = await q.limit(1);
      if (dupErr) throw dupErr;
      if (dupes && dupes.length) {
        return new Response(JSON.stringify({
          ok: true,
          duplicate: true,
          id: dupes[0].id
        }), {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
          }
        });
      }
      const { data, error } = await supabase.from("golfiq_round_imports").insert({
        user_id: user.id,
        source_app: r.source_app || "18Birdies",
        course_name: r.course_name,
        course_id: r.course_id,
        played_on: r.date,
        tees: r.tees,
        holes: saveHoles,
        gross_score: saveGross,
        net_score: intOrNull(r.net_score),
        total_putts: intOrNull(r.total_putts),
        fairways_hit: intOrNull(r.fairways_hit),
        gir: intOrNull(r.gir),
        parsed,
        raw_meta: {
          confidence: parsed.confidence,
          warnings: parsed.warnings
        }
      }).select("id").single();
      if (error) throw error;
      const { data: savedImport, error: savedErr } = await supabase.from("golfiq_round_imports").select("id,user_id,source_app,course_name,course_id,played_on,tees,holes,gross_score,net_score,total_putts,fairways_hit,gir,parsed").eq("id", data.id).eq("user_id", user.id).single();
      if (savedErr) throw savedErr;
      await syncImportToCore(supabase, savedImport, user.id);
      return new Response(JSON.stringify({
        ok: true,
        id: data.id,
        coreSynced: true
      }), {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    throw new Error("Unknown action.");
  } catch (e) {
    const message = e?.message || String(e);
    const status = message === "AUTH_REQUIRED" ? 401 : 400;
    return new Response(JSON.stringify({
      error: message === "AUTH_REQUIRED" ? "Please sign in again." : message
    }), {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
