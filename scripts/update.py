#!/usr/bin/env python3
"""Fetch dynamic Bailian catalog and AA benchmarks; publish only traced facts."""
import json
import math
import os
import pathlib
import re
import sys
import urllib.parse
import urllib.request
import urllib.error
from datetime import datetime, timezone

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_CATALOG_URL = 'https://dashscope.aliyuncs.com/api/v1/models'
AA_URL = 'https://artificialanalysis.ai/api/v2/language/models/free'
BAILIAN_DOC = 'https://help.aliyun.com/zh/model-studio/list-models'
AA_DOC = 'https://artificialanalysis.ai/data-api/docs'

def number(value):
    if isinstance(value, bool): return None
    try: result = float(value)
    except (TypeError, ValueError): return None
    return result if math.isfinite(result) and result >= 0 else None

def get(url, headers, params):
    request = urllib.request.Request(url+'?'+urllib.parse.urlencode(params, doseq=True), headers={**headers, 'accept':'application/json', 'user-agent':'model-select/0.2'})
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)

def fetch_catalog(endpoint, key):
    rows, pages = [], []
    for page in range(1, 1001):
        payload = get(endpoint, {'Authorization':'Bearer '+key}, {'page_no':page, 'page_size':100, 'capabilities':'TG', 'inference_providers':'aliyun-bailian', 'service_site':'asia-pacific-china'})
        if payload.get('success') is not True: raise ValueError('Bailian response not successful')
        output = payload.get('output', {})
        batch, total = output.get('models'), output.get('total')
        if not isinstance(batch, list) or not isinstance(total, int): raise ValueError('Bailian schema changed')
        pages.append(payload); rows.extend(batch)
        if len(rows) >= total: break
        if not batch: raise ValueError('Bailian pagination incomplete')
    else: raise ValueError('Bailian pagination limit')
    if not rows: raise ValueError('Empty Bailian catalog')
    return rows, pages

def fetch_aa(key):
    rows, pages, version = [], [], None
    for page in range(1, 1001):
        payload = get(AA_URL, {'x-api-key':key}, {'page':page})
        batch, pagination = payload.get('data'), payload.get('pagination')
        if not isinstance(batch, list) or not isinstance(pagination, dict): raise ValueError('AA schema changed')
        current = payload.get('intelligence_index_version')
        if current is None or (version is not None and current != version): raise ValueError('Missing or inconsistent AA version')
        version = current; pages.append(payload); rows.extend(batch)
        if pagination.get('has_more') is False: break
        if pagination.get('has_more') is not True or not batch: raise ValueError('AA pagination incomplete')
    else: raise ValueError('AA pagination limit')
    return rows, pages, version

def input_range_matches(label, tokens=10000):
    # Recognize documented input-token ranges only; reject unknown billing rules.
    label = label.replace(' ', '').replace('输入','input').lower()
    if label == 'default': return True
    if not re.fullmatch(r'(?:[0-9.]+[km]?(?:<|<=))?input(?:<|<=)[0-9.]+[km]?', label): return False
    def value(text): return float(text[:-1])*({'k':1000,'m':1000000}[text[-1]]) if text.endswith(('k','m')) else float(text)
    left, right = label.split('input')
    if left:
        match = re.fullmatch(r'([0-9.]+[km]?)(<=|<)',left)
        low = value(match[1])
        if not (low <= tokens if match[2]=='<=' else low < tokens): return False
    match = re.fullmatch(r'(<=|<)([0-9.]+[km]?)',right)
    high = value(match[2])
    return tokens <= high if match[1]=='<=' else tokens < high

def parse_pricing(row):
    groups = row.get('prices') or []
    selected = [g for g in groups if input_range_matches(g.get('range_name',''))]
    quotes = []
    if len(selected) == 1:
        buckets, seen = {}, set()
        types = {'input_token':('standard','input'), 'output_token':('standard','output'),
                 'thinking_input_token':('thinking','input'), 'thinking_output_token':('thinking','output')}
        for item in selected[0].get('prices', []):
            target = types.get(item.get('type'))
            if not target or item.get('price_unit') not in ('每百万tokens','每百万Token'): continue
            mode, side = target
            band = item.get('time_band') or 'standard'
            quote = buckets.setdefault((mode,band), {'mode':mode,'time_band':band,'input':None,'output':None})
            identity = (mode,band,side)
            if identity in seen: quote[side] = None
            else: quote[side] = number(item.get('price'))
            seen.add(identity)
        quotes = sorted(buckets.values(),key=lambda q:(q['mode']!='standard',{'standard':0,'peak':1,'offpeak':2}.get(q['time_band'],3)))
    comparable = [q for q in quotes if q['time_band'] in ('standard','peak','offpeak')]
    chosen = comparable[0] if comparable else {'input':None,'output':None}
    price = {k:chosen[k] for k in ('input','output')}
    status = 'complete' if all(v is not None for v in price.values()) else ('not-provided' if not groups else 'incomplete')
    return {'beijing':price,'raw':groups,'input_tokens_basis':10000,'quotes':quotes,'status':status,
            'comparison':{'mode':chosen.get('mode'),'time_band':chosen.get('time_band'),'input_range':selected[0].get('range_name') if len(selected)==1 else None}}

def simple_prices(row):
    return parse_pricing(row)['beijing']

def public_release_date(matched):
    value = (matched or {}).get('release_date')
    if not isinstance(value,str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',value): return None
    try: datetime.strptime(value,'%Y-%m-%d')
    except ValueError: return None
    return value

def release_metadata(row, matched, aa_rows):
    date = public_release_date(matched)
    if not date:
        names = {normalize_name(row.get('name')), normalize_name(row.get('model'))} - {''}
        candidates = [r for r in aa_rows if normalize_name(r.get('name')) in names or normalize_name(r.get('slug')) in names]
        if len(candidates) == 1: date = public_release_date(candidates[0])
    if date: return date, 'Artificial Analysis'
    published = row.get('published_time')
    date = public_release_date({'release_date':published[:10]}) if isinstance(published,str) else None
    return date, 'Bailian' if date else None

def normalize_name(value):
    return re.sub(r'[^a-z0-9]', '', str(value).lower())

def match_aa(row, aa_rows, mappings):
    explicit = mappings.get(row['model'])
    if explicit:
        matches = [r for r in aa_rows if r.get('id') == explicit.get('aa_id')]
    else:
        # Strict spelling normalization only, never remove versions/effort/suffixes.
        codes = {normalize_name(row['model']), normalize_name(row.get('equivalent_snapshot') or row['model'])}
        matches = [r for r in aa_rows if normalize_name(r.get('slug')) in codes]
        if not matches:
            names = codes | {normalize_name(row.get('name'))}
            matches = [r for r in aa_rows if normalize_name(r.get('name')) in names]
    return matches[0] if len(matches) == 1 else None

def build_models(rows, aa_rows, version, mappings, timestamp):
    models = []
    for row in rows:
        code = row.get('model')
        if not code or row.get('inference_provider') not in (None, 'aliyun-bailian'): continue
        if 'Text' not in (row.get('inference_metadata') or {}).get('response_modality', []): continue
        matched = match_aa(row, aa_rows, mappings)
        ev = (matched or {}).get('evaluations') or {}
        scores = {k:number(ev.get('artificial_analysis_'+v+'_index')) for k,v in [('capability','intelligence'),('coding','coding'),('agentic','agentic')]}
        # Display indices independently. No assertion that their arithmetic mean is meaningful.
        scores.update(comparable_scale=False, version=version if matched else None)
        context = number((row.get('model_info') or {}).get('context_window'))
        pricing = parse_pricing(row)
        price = pricing['beijing']
        speed = number(((matched or {}).get('performance') or {}).get('median_output_tokens_per_second'))
        release_date, release_source = release_metadata(row, matched, aa_rows)
        model = {'code':code,'name':row.get('name') or code,'context_k':context/1000 if context is not None else None,'pricing':pricing,'release_date':release_date,'release_date_source':release_source,'catalog_published_at':row.get('published_time'),'scores':scores,'speed':{'tokens_per_second':speed,'scope':'AA 跨供应商中位数，非百炼实测速率','prompt_type':'free-endpoint-default'},'features':row.get('features') or [],'sources':['Bailian']+(['Artificial Analysis'] if matched else []),'provenance':{'catalog':{'url':BAILIAN_DOC,'fetched_at':timestamp,'model_id':code},'benchmark':{'url':AA_DOC,'fetched_at':timestamp,'aa_id':matched.get('id'),'aa_slug':matched.get('slug'),'aa_name':matched.get('name'),'match_method':'explicit-aa-id' if code in mappings else ('unique-normalized-slug' if normalize_name(matched.get('slug')) in {normalize_name(code),normalize_name(row.get('equivalent_snapshot') or code)} else 'unique-normalized-name'),'index_version':version} if matched else None}}
        checks = [context is not None,price['input'] is not None and price['output'] is not None,*[v is not None for k,v in scores.items() if k in ('capability','coding','agentic')],speed is not None]
        model['evidence_coverage'] = sum(checks)/len(checks)
        models.append(model)
    unique = {m['code']:m for m in models}
    if len(unique) != len(models): raise ValueError('Duplicate provider model IDs')
    return sorted(models, key=lambda m:m['code'])

def recommendations(models):
    # Operational tiers use capability quartiles, not equivalence to official models.
    eligible = [m for m in models if 'function-calling' in m['features'] and m['scores']['capability'] is not None]
    eligible.sort(key=lambda m:(-m['scores']['capability'],m['code']))
    descriptions = {'fable':'能力前 25% · 高难度任务','opus':'能力 25–50% · 复杂编程','sonnet':'能力 50–75% · 日常开发','haiku':'能力后 25% · 轻量任务'}
    roles = {}
    for i,key in enumerate(descriptions):
        pool = [m for rank,m in enumerate(eligible) if rank*4//len(eligible) == i]
        roles[key] = {'positioning':descriptions[key],'candidates':[m['code'] for m in pool],'best':pool[0]['code'] if pool else None}
    return roles

def dump(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp')
    temp.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');temp.replace(path)

def error_details(exc):
    details = {'type':type(exc).__name__}
    if isinstance(exc, urllib.error.HTTPError):
        details['http_status'] = exc.code
        try:
            payload = json.loads(exc.read(8192))
            code = payload.get('code') or (payload.get('error') or {}).get('code')
            if isinstance(code,str) and re.fullmatch(r'[A-Za-z0-9_.-]{1,100}',code): details['provider_code'] = code
        except (ValueError, AttributeError, OSError): pass
    if isinstance(exc, ValueError): details['validation'] = str(exc)
    cause = exc.__cause__ or exc.__context__
    if cause and cause is not exc: details['cause'] = {'type':type(cause).__name__}
    return details

def report(status, reason, **extra):
    info = {'status':status,'attempted_at':datetime.now(timezone.utc).isoformat(),'execution': 'github-actions' if os.getenv('GITHUB_ACTIONS') else 'local','run_url': ('https://github.com/'+os.environ['GITHUB_REPOSITORY']+'/actions/runs/'+os.environ['GITHUB_RUN_ID']) if os.getenv('GITHUB_RUN_ID') else None,'reason':reason,**extra}
    dump(ROOT/'data/update-status.json', info)
    print(('PASS' if status=='updated' else 'FAIL')+'\tdata-update\t'+status)
    print(json.dumps(info,ensure_ascii=False),file=sys.stderr)
    if os.getenv('GITHUB_STEP_SUMMARY'):
        with open(os.environ['GITHUB_STEP_SUMMARY'],'a') as stream:
            stream.write('## Data update\n\n'+json.dumps(info,ensure_ascii=False,indent=2)+'\n')

def main():
    key, endpoint = os.getenv('DASHSCOPE_API_KEY'), os.getenv('BAILIAN_MODELS_ENDPOINT') or DEFAULT_CATALOG_URL
    if not key:
        report('blocked','Missing DASHSCOPE_API_KEY');return 1
    parsed = urllib.parse.urlparse(endpoint)
    if parsed.scheme != 'https' or not parsed.hostname or not (parsed.hostname == 'dashscope.aliyuncs.com' or parsed.hostname.endswith('.cn-beijing.maas.aliyuncs.com')) or parsed.path != '/api/v1/models' or parsed.query or parsed.username or parsed.password or parsed.port not in (None,443):
        report('failed','Expected legacy DashScope or Beijing workspace HTTPS model-list endpoint');return 1
    try:
        rows, raw_catalog = fetch_catalog(endpoint,key)
        aa_rows, raw_aa, version = [], [], None
        aa_state = 'missing-key'; aa_error = None
        if os.getenv('ARTIFICIAL_ANALYSIS_API_KEY'):
            try:
                aa_rows,raw_aa,version = fetch_aa(os.environ['ARTIFICIAL_ANALYSIS_API_KEY']);aa_state='success'
            except Exception as exc:
                aa_state='failed'; aa_error=error_details(exc)
        mappings = json.loads((ROOT/'config/model-mappings.json').read_text())
        timestamp = datetime.now(timezone.utc).isoformat()
        models = build_models(rows,aa_rows,version,mappings,timestamp)
        for model in models: model['provenance']['catalog']['endpoint'] = endpoint
        if not models: raise ValueError('No supported text models')
        doc = {'schema_version':2,'verified_catalog':True,'updated_at':timestamp,'region':'华北2（北京）','currency':'CNY','price_unit':'per 1M tokens','models':models}
        rec = {'updated_at':timestamp,'region':doc['region'],'schema_version':2,'standard_task':{'input_tokens':10000,'output_tokens':2000},'tier_method':'工具调用模型按 AA 综合能力四分位分组；非官方模型等效关系','roles':recommendations(models)}
        # Raw catalog/benchmarks are public model facts. Never save request headers or keys.
        dump(ROOT/'data/raw/bailian.json',{'fetched_at':timestamp,'pages':raw_catalog})
        if raw_aa: dump(ROOT/'data/raw/artificial-analysis.json',{'fetched_at':timestamp,'pages':raw_aa})
        dump(ROOT/'data/models.json',doc);dump(ROOT/'data/recommendations.json',rec)
        coverage = sum(m['provenance']['benchmark'] is not None for m in models)
        report('updated' if aa_state=='success' else 'partial','Published dynamic provider catalog',models=len(models),benchmark_matches=coverage,aa_status=aa_state,aa_error=aa_error,catalog_endpoint=endpoint,field_counts={field:sum(m['scores'][field] is not None for m in models) for field in ('capability','coding','agentic')},speed_count=sum(m['speed']['tokens_per_second'] is not None for m in models))
        return 0 if aa_state=='success' else 1
    except Exception as exc:
        report('failed','Published snapshot retained',error=error_details(exc));return 1

if __name__ == '__main__': sys.exit(main())
