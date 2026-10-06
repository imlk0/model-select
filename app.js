const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined) ? 'N/A' : Number(n).toFixed(Number(n)%1?1:0);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
const copy = async text => { try { await navigator.clipboard.writeText(text); toast(`已复制 ${text}`); } catch { toast("复制失败，请手动选择代码复制"); } };
const modelLabel = m => `${m.name} (${m.code})`;

const complete = snapshot => {
  if(!snapshot?.modelsDoc?.models?.length || !snapshot?.data?.roles) return false;
  const models=snapshot.modelsDoc.models;
  const codes=new Set(models.map(m=>m.code));
  return models.every(m=>m.name && m.code && Number.isFinite(m.scores?.coding) && Number.isFinite(m.scores?.agentic) && m.scores?.comparable_scale===true && Number.isFinite(m.scores?.capability) && Number.isFinite(m.speed?.tokens_per_second) && Number.isFinite(m.pricing?.beijing?.input) && Number.isFinite(m.pricing?.beijing?.output) && Number.isFinite(m.context_k)) && ['fable','opus','sonnet','haiku'].every(r=>snapshot.data.roles[r]?.candidates?.length>=3 && snapshot.data.roles[r].candidates.every(c=>codes.has(c)) && codes.has(snapshot.data.roles[r].best));
};
async function loadSnapshot(){
  const key='model-select:last-good:v1';
  const get=async path=>{const r=await fetch(path,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Unavailable');return r.json();};
  if(new URLSearchParams(location.search).get('demo')==='1')return window.MODEL_SELECT_DEMO;
  try{
    const [data,modelsDoc]=await Promise.all([get('data/recommendations.json'),get('data/models.json')]);
    const live={data,modelsDoc,mode:'live'};
    if(complete(live)){try{localStorage.setItem(key,JSON.stringify(live));}catch{}return live;}
  }catch{}
  try{const saved=JSON.parse(localStorage.getItem(key));if(complete(saved))return {...saved,mode:'cached'};}catch{}
  return window.MODEL_SELECT_DEMO;
}
async function boot(){
  const {data,modelsDoc,mode}=await loadSnapshot();
  $('#demoWarning').hidden=mode!=='demo';
  const models = Object.fromEntries(modelsDoc.models.map(m=>[m.code,m]));
  $('#updatedAt').textContent = new Date(data.updated_at).toLocaleString('zh-CN',{hour12:false});
  $('#evidenceNote').textContent = mode==='demo'?'演示数据':mode==='cached'?'最近有效快照':data.region;

  const roles=['fable','opus','sonnet','haiku'];
  const valid = n => typeof n === 'number' && Number.isFinite(n);
  // Compare coding and agentic only when they are supplied on the same scale.
  const ability = m => valid(m.scores?.coding) && valid(m.scores?.agentic) && m.scores?.comparable_scale === true ? (m.scores.coding+m.scores.agentic)/2 : null;
  const cost = m => { const p=m.pricing?.beijing; return valid(p?.input)&&valid(p?.output) ? p.input*.01+p.output*.002 : null; };
  const entry = (m, value, rank) => `<button class="model-trigger" data-model="${m.code}" data-status="${valid(value)?'排序值 '+fmt(value):'数据快照'}" aria-describedby="modelPopover">${rank?`<span class="rank-number">${rank}</span>`:''}${m.name}</button>`;
  const ranking = (pool, metric) => {
    const ranked=pool.map(m=>({m,value:metric(m)})).filter(x=>valid(x.value)).sort((a,b)=>b.value-a.value || a.m.code.localeCompare(b.m.code));
    return ranked.slice(0,3).map(x=>entry(x.m,x.value,1+ranked.filter(y=>y.value>x.value).length)).join('');
  };
  const metrics={ability:ability,speed:m=>m.speed?.tokens_per_second,value:m=>{const a=ability(m),c=cost(m);return valid(a)&&c>0?a/c:null;}};
  let selectedMetric='ability';
  const renderSummary=()=>{
    const metric=metrics[selectedMetric];
    $('#summaryGrid').innerHTML=roles.map(role=>{
      const pool=data.roles[role].candidates.map(c=>models[c]).filter(Boolean);
      const m=pool.filter(m=>valid(metric(m))).sort((a,b)=>metric(b)-metric(a)||a.code.localeCompare(b.code))[0];
      return `<article class="summary-card"><div class="role">${role}</div><div class="pick">${m.name}</div><button class="code copy" data-copy="${m.code}">${m.code}</button></article>`;
    }).join('');
    $('#summaryGrid').querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderSummary();
  document.querySelectorAll('[data-metric]').forEach(el=>el.onclick=()=>{selectedMetric=el.dataset.metric;document.querySelectorAll('[data-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button===el)));renderSummary();renderCodexPicks();});
  let transition=null;
  $('#toggleRanking').onclick=()=>{
    const button=$('#toggleRanking'), expanded=button.getAttribute('aria-expanded')!=='true';
    const summary=$('#summaryGrid'),details=$('#rankingDetails'), host=summary.parentElement;
    transition?.cancel(); host.style.height=''; host.style.overflow='';
    const before=host.getBoundingClientRect().height;
    button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'收起排名':'展开排名';
    details.hidden=!expanded;summary.hidden=expanded;$('.sort-control').hidden=expanded;
    if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      const after=host.getBoundingClientRect().height;
      host.style.overflow='hidden';
      transition=host.animate([{height:before+'px'},{height:after+'px'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});
      transition.onfinish=()=>{host.style.overflow='';transition=null;};
      (expanded?details:summary).animate([{opacity:0,transform:'translateY(-6px)'},{opacity:1,transform:'translateY(0)'}],{duration:220,easing:'ease-out'});
    }
  };
  $('#recommendationRows').innerHTML=roles.map(role=>{
    const x=data.roles[role],pool=x.candidates.map(c=>models[c]).filter(Boolean);
    return `<tr><td class="role-cell"><strong>${role[0].toUpperCase()+role.slice(1)}</strong><p class="field-description">${x.positioning}</p></td><td>${ranking(pool,ability)}</td><td>${ranking(pool,m=>m.speed?.tokens_per_second)}</td><td>${ranking(pool,m=>{const a=ability(m),c=cost(m);return valid(a)&&c>0?a/c:null;})}</td></tr>`;
  }).join('');
  const popover=$('#modelPopover');
  let active=null,closeTimer;
  const close=()=>{popover.hidden=true;active=null;};
  const show=el=>{
    clearTimeout(closeTimer); active=el; const m=models[el.dataset.model],p=m.pricing?.beijing;
    popover.innerHTML=`<strong>${m.name}</strong><div class="muted">${el.dataset.status}</div><button class="code copy" data-copy="${m.code}" aria-label="复制模型代码">${m.code} ↗ 复制</button><dl><dt>输入 / 输出价格</dt><dd>¥${fmt(p?.input)} / ¥${fmt(p?.output)} 每百万 token</dd><dt>上下文</dt><dd>${fmt(m.context_k)}K tokens</dd><dt>Coding / Agentic</dt><dd>${fmt(m.scores?.coding)} / ${fmt(m.scores?.agentic)}</dd><dt>输出速度</dt><dd>${fmt(m.speed?.tokens_per_second)} tok/s</dd></dl><p class="muted">${modelsDoc.region}</p>`;
    popover.querySelector('[data-copy]').onclick=()=>copy(m.code);
    popover.hidden=false;
    const r=el.getBoundingClientRect(),h=popover.offsetHeight,w=popover.offsetWidth;
    const cell=el.closest('td').getBoundingClientRect();
    const right=cell.right+10,left=cell.left-w-10;
    const side=right+w<=window.innerWidth-8?right:left>=8?left:Math.max(8,window.innerWidth-w-8);
    popover.style.left=side+'px';
    popover.style.top=Math.max(8,Math.min(r.top-12,window.innerHeight-h-8))+'px';
  };
  document.querySelectorAll('[data-model]').forEach(el=>{
    el.onmouseenter=()=>show(el); el.onfocus=()=>show(el); el.onclick=()=>{
      clearTimeout(closeTimer); close();
      $('#search').value=''; renderCards('');
      const row=document.getElementById('model-'+encodeURIComponent(el.dataset.model));
      document.querySelectorAll('.model-selected').forEach(r=>r.classList.remove('model-selected'));
      if(row){setTimeout(()=>row.classList.remove('model-selected'),1500);row.classList.add('model-selected');row.focus({preventScroll:true});row.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
    };
    el.onmouseleave=()=>{closeTimer=setTimeout(close,600);};
    el.onblur=e=>{if(!popover.contains(e.relatedTarget))closeTimer=setTimeout(close,600);};
  });
  popover.onmouseenter=()=>clearTimeout(closeTimer);
  popover.onmouseleave=()=>{closeTimer=setTimeout(close,600);};
  popover.onfocusin=()=>clearTimeout(closeTimer);
  popover.onfocusout=e=>{if(!popover.contains(e.relatedTarget))close();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('click',e=>{if(!e.target.closest('[data-model]')&&!popover.contains(e.target))close();});
  window.addEventListener('resize',close); window.addEventListener('scroll',close,{passive:true});

  let tableSort=null, sortDirection=-1;
  const sortValues={name:m=>m.name,capability:m=>m.scores?.capability,coding:m=>m.scores?.coding,agentic:m=>m.scores?.agentic,speed:m=>m.speed?.tokens_per_second,input:m=>m.pricing?.beijing?.input,output:m=>m.pricing?.beijing?.output,context:m=>m.context_k,evidence:m=>m.evidence_coverage};
  const renderCards = q => {
    const needle=q.trim().toLowerCase();
    const filtered=modelsDoc.models.filter(m=>!needle || `${m.name} ${m.code}`.toLowerCase().includes(needle));
    if(tableSort)filtered.sort((a,b)=>{const x=sortValues[tableSort](a),y=sortValues[tableSort](b);if(x==null)return y==null?0:1;if(y==null)return -1;return sortDirection*(typeof x==='string'?x.localeCompare(y):(x-y));});
    const cell = n => `<td class="numeric ${n==null?'missing':''}">${fmt(n)}</td>`;
    $('#modelCards').innerHTML=filtered.map(m=>{
      const p=m.pricing?.beijing||{};
      return `<tr id="model-${encodeURIComponent(m.code)}" tabindex="-1"><td><div class="model-name">${m.name}</div><button class="catalog-add ranking-toggle" data-catalog-add="${m.code}">＋ 加入清单</button><button class="code copy" data-copy="${m.code}" aria-label="复制 ${m.code}">${m.code}</button></td>${cell(m.scores?.capability)}${cell(m.scores?.coding)}${cell(m.scores?.agentic)}${cell(m.speed?.tokens_per_second)}${cell(p.input)}${cell(p.output)}${cell(m.context_k)}<td class="numeric">${Math.round((m.evidence_coverage||0)*100)}%</td></tr>`;
    }).join('') || '<tr><td colspan="9">没有匹配的模型</td></tr>';
    document.querySelectorAll('[data-catalog-add]').forEach(el=>el.onclick=()=>addModel(el.dataset.catalogAdd));
    $('#filterCount').textContent = `${filtered.length} / ${modelsDoc.models.length} MODELS`;
    document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderCards('');
  document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{
    sortDirection=tableSort===button.dataset.sort?-sortDirection:(['name','input','output'].includes(button.dataset.sort)?1:-1);tableSort=button.dataset.sort;
    document.querySelectorAll('[data-sort]').forEach(b=>{const active=b===button;b.parentElement.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');b.querySelector('span').textContent=active?(sortDirection===1?' ↑':' ↓'):'';});renderCards($('#search').value);
  });
  const config=new Map();let defaultCode=null;
  const escapeAttr=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const renderConfig=()=>{
    $('#codexRows').innerHTML=[...config].map(([code,x])=>`<tr><td><input type="radio" name="codex-default" data-default="${escapeAttr(code)}" ${code===defaultCode?'checked':''} aria-label="设为默认 ${escapeAttr(x.name)}"></td>${['name','code','context','reasoning'].map(key=>`<td><input data-config="${escapeAttr(code)}" data-field="${key}" value="${escapeAttr(x[key])}" aria-label="${({name:'菜单显示名',code:'实际请求模型',context:'上下文窗口',reasoning:'思考等级'})[key]}" placeholder="${key==='context'||key==='reasoning'?'按服务商填写':''}"></td>`).join('')}<td><button class="ranking-toggle" data-remove="${escapeAttr(code)}">移除</button></td></tr>`).join('')||'<tr><td colspan="6">从上方加入你想使用的模型。</td></tr>';
    document.querySelectorAll('[data-config]').forEach(el=>el.oninput=()=>config.get(el.dataset.config)[el.dataset.field]=el.value);
    document.querySelectorAll('[data-default]').forEach(el=>el.onchange=()=>defaultCode=el.dataset.default);
    document.querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>{config.delete(el.dataset.remove);if(defaultCode===el.dataset.remove)defaultCode=config.keys().next().value;renderConfig();renderCodexPicks();});
  };
  const addModel=code=>{const m=models[code];if(!config.has(code))config.set(code,{name:m.name,code:m.code,context:'',reasoning:''});defaultCode??=code;renderConfig();renderCodexPicks();toast('已加入配置清单');};
  const renderCodexPicks=()=>{
    const metric=metrics[selectedMetric];
    $('#codexPicks').innerHTML=modelsDoc.models.slice().sort((a,b)=>metric(b)-metric(a)||a.code.localeCompare(b.code)).slice(0,3).map((m,i)=>`<article class="summary-card"><div class="role">${i+1} / ${selectedMetric==='ability'?'能力':selectedMetric==='speed'?'速度':'性价比'}</div><div class="pick">${m.name}</div><button class="code" data-add="${m.code}" ${config.has(m.code)?'disabled':''}>${config.has(m.code)?'已加入':'＋ 加入清单'}</button></article>`).join('');
    document.querySelectorAll('[data-add]').forEach(el=>el.onclick=()=>{addModel(el.dataset.add);});
  };
  $('#copyCodex').onclick=()=>{if(!config.size){toast('先加入一个模型');return;}copy('默认模型\t'+(config.get(defaultCode)?.code||'')+'\n菜单显示名\t实际请求模型\t上下文窗口\t思考等级\n'+[...config.values()].map(x=>[x.name,x.code,x.context,x.reasoning].join('\t')).join('\n'));};
  document.querySelectorAll('[data-tool]').forEach(el=>el.onclick=()=>{
    const codex=el.dataset.tool==='codex';document.body.classList.toggle('codex-active',codex);document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-selected',String(b===el));});
    $('#codexView').hidden=!codex;$('#toggleRanking').hidden=codex;
    const expanded=$('#toggleRanking').getAttribute('aria-expanded')==='true';$('#summaryGrid').hidden=codex||expanded;$('#rankingDetails').hidden=codex||!expanded;$('.sort-control').hidden=!codex&&expanded;
  });
  renderConfig();renderCodexPicks();
  $('#search').addEventListener('input',e=>renderCards(e.target.value));
  document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
}
boot().catch(()=>{ $('#evidenceNote').textContent='数据暂不可用'; });
