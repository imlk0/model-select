#!/usr/bin/env python3
"""Daily deterministic updater.

- Reads Bailian facts from data/models.json (safe seed / cache).
- Optionally enriches model benchmark + speed fields from Artificial Analysis Free API.
- Recomputes Claude Code role rankings from config/scoring.json.
- Never invents missing facts; missing metrics reduce evidence coverage.

Environment:
  ARTIFICIAL_ANALYSIS_API_KEY=...

The AA API uses stable IDs, but model naming differs from Bailian codes. Keep ALIASES explicit.
"""
from __future__ import annotations
import json, math, os, pathlib, urllib.request
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODELS_PATH = ROOT / "data/models.json"
OUT_PATH = ROOT / "data/recommendations.json"
SCORING_PATH = ROOT / "config/scoring.json"

ALIASES = {
    "qwen3.8-max-0902": ["Qwen3.8 Max", "Qwen 3.8 Max"],
    "glm-5.3": ["GLM-5.3", "GLM 5.3"],
    "deepseek-v4.1-flash": ["DeepSeek-V4.1-Flash", "DeepSeek V4.1 Flash"],
    "qwen3.8-flash": ["Qwen3.8 Flash", "Qwen 3.8 Flash"],
    "qwen3.7-plus": ["Qwen3.7 Plus", "Qwen 3.7 Plus"],
    "qwen3.7-flash": ["Qwen3.7 Flash", "Qwen 3.7 Flash"],
    "kimi-k3": ["Kimi-K3", "Kimi K3"],
    "ZHIPU/GLM-5.3-FlashX": ["GLM-5.3-FlashX", "GLM 5.3 FlashX"],
}

def load(path): return json.loads(path.read_text())
def dump(path,obj): path.write_text(json.dumps(obj,ensure_ascii=False,indent=2)+"\n")

def fetch_aa():
    key=os.getenv("ARTIFICIAL_ANALYSIS_API_KEY")
    if not key: return []
    req=urllib.request.Request("https://artificialanalysis.ai/api/v2/language/models",headers={"x-api-key":key,"accept":"application/json","user-agent":"cc-model-router/0.1"})
    with urllib.request.urlopen(req,timeout=30) as r:
        payload=json.load(r)
    if isinstance(payload,list): return payload
    return payload.get("data") or payload.get("models") or []

def pick(obj, *paths):
    for path in paths:
        cur=obj
        ok=True
        for k in path.split('.'):
            if not isinstance(cur,dict) or k not in cur: ok=False; break
            cur=cur[k]
        if ok and isinstance(cur,(int,float)): return float(cur)
    return None

def enrich(models, aa_rows):
    for m in models:
        names={x.lower() for x in ALIASES.get(m["code"],[m["name"]])}
        row=next((r for r in aa_rows if str(r.get("name","")).lower() in names),None)
        if not row: continue
        ev=row.get("evaluations") or {}
        m["scores"]["capability"] = pick(row,"intelligence_index","evaluations.intelligence_index")
        m["scores"]["coding"] = pick(row,"coding_index","evaluations.coding_index","evaluations.livecodebench")
        m["scores"]["agentic"] = pick(row,"agentic_index","evaluations.agentic_index","evaluations.terminal_bench")
        m["speed"]["tokens_per_second"] = pick(row,"median_output_tokens_per_second")
        m["sources"] = sorted(set(m.get("sources",[])+["Artificial Analysis"]))
    return models

def normalize(vals):
    present=[v for v in vals if isinstance(v,(int,float))]
    if not present: return [None]*len(vals)
    lo,hi=min(present),max(present)
    if hi==lo: return [50 if v is not None else None for v in vals]
    return [None if v is None else 100*(v-lo)/(hi-lo) for v in vals]

def compute(models,cfg):
    n=len(models)
    fields={
      "capability":[m["scores"].get("capability") for m in models],
      "coding":[m["scores"].get("coding") for m in models],
      "agentic":[m["scores"].get("agentic") for m in models],
      "speed":[m["speed"].get("tokens_per_second") for m in models],
      "context":[m.get("context_k") for m in models],
    }
    norm={k:normalize(v) for k,v in fields.items()}
    standard=cfg["standard_task"]
    costs=[]
    for m in models:
        p=(m.get("pricing") or {}).get("beijing") or {}
        if p.get("input") is None or p.get("output") is None: costs.append(None)
        else: costs.append(p["input"]*standard["input_tokens"]/1e6 + p["output"]*standard["output_tokens"]/1e6)
    inv=[None if c in (None,0) else 1/c for c in costs]
    norm["value"]=normalize(inv)

    # evidence coverage: pricing + context + available benchmark/speed metrics
    for i,m in enumerate(models):
        checks=[costs[i] is not None, fields["context"][i] is not None, fields["capability"][i] is not None, fields["coding"][i] is not None, fields["agentic"][i] is not None, fields["speed"][i] is not None]
        m["evidence_coverage"]=sum(checks)/len(checks)

    roles={}
    for role,weights in cfg["profiles"].items():
        scored=[]
        for i,m in enumerate(models):
            if m["evidence_coverage"] < cfg["minimum_evidence_coverage"]: continue
            total=0; used=0
            for metric,w in weights.items():
                v=norm.get(metric,[None]*n)[i]
                if v is not None: total += v*w; used += w
            if used: scored.append((total/used,m))
        scored.sort(key=lambda x:x[0],reverse=True)
        if not scored: continue
        candidates=[m["code"] for _,m in scored[:4]]
        best=scored[0][1]["code"]
        speed_rank=sorted(scored,key=lambda x:(x[1]["speed"].get("tokens_per_second") or -1),reverse=True)
        fastest=speed_rank[0][1]["code"]
        value_rank=sorted(scored,key=lambda x:(norm["value"][models.index(x[1])] if norm["value"][models.index(x[1])] is not None else -1),reverse=True)
        best_value=value_rank[0][1]["code"]
        positioning={"fable":"极限能力、长程 Agent、复杂 Coding","opus":"高端推理、Coding、Agent 重型任务","sonnet":"日常主力，能力 / 延迟 / 成本均衡","haiku":"快速、便宜、高并发、Subagent"}[role]
        roles[role]={"positioning":positioning,"candidates":candidates,"best":best,"fastest":fastest,"best_value":best_value,"confidence":round(sum(m["evidence_coverage"] for _,m in scored[:3])/min(3,len(scored)),2)}
    return roles

def main():
    doc=load(MODELS_PATH); cfg=load(SCORING_PATH)
    aa=fetch_aa()
    doc["models"]=enrich(doc["models"],aa)
    dump(MODELS_PATH,doc)
    roles=compute(doc["models"],cfg)
    # Safety: if API data is insufficient, preserve current seed recommendations.
    if len(roles)<4 and OUT_PATH.exists():
        old=load(OUT_PATH); roles=old.get("roles",roles)
    out={"updated_at":datetime.now(timezone.utc).isoformat(),"region":doc["region"],"scoring_version":cfg["version"],"roles":roles}
    dump(OUT_PATH,out)
    print(f"updated {OUT_PATH}; AA rows={len(aa)}; roles={len(roles)}")
if __name__=="__main__": main()
