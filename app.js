const themeNames={system:'跟随系统',light:'浅色',dark:'深色'};
const themeButton=document.querySelector('#themeToggle');
const themeIcons={system:'<rect x="3" y="4" width="18" height="13" rx="1"></rect><path d="M8 21h8m-4-4v4"></path>',light:'<circle cx="12" cy="12" r="4"></circle><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"></path>',dark:'<path d="M20.5 13.2A8.5 8.5 0 0 1 10.8 3.5 8.5 8.5 0 1 0 20.5 13.2Z"></path>'};
const updateThemeLabel=()=>{const mode=document.documentElement.dataset.theme||'system';themeButton.innerHTML='<svg aria-hidden="true" viewBox="0 0 24 24">'+themeIcons[mode]+'</svg>';themeButton.title='当前：'+themeNames[mode]+' · 点击切换';themeButton.setAttribute('aria-label','当前'+themeNames[mode]+'，点击切换主题');};
updateThemeLabel();
themeButton.onclick=()=>{const modes=['system','light','dark'],current=document.documentElement.dataset.theme||'system',next=modes[(modes.indexOf(current)+1)%3];document.documentElement.dataset.theme=next;try{localStorage.setItem('model-select:theme',next);}catch{}updateThemeLabel();};
const $ = s => document.querySelector(s);
const escapeHTML=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const fmt = n => (n === null || n === undefined) ? 'N/A' : Number(n).toFixed(Number(n)%1?1:0);
const fmtPrice = n => n==null?'N/A':Number(n).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:20});
const priceLabel = q => [q.mode==='thinking'?'思考':'',({peak:'高峰',offpeak:'低谷'})[q.time_band]||''].filter(Boolean).join(' · ');
const priceLines = (m,side) => {
  const quotes=m.pricing?.quotes;
  if(!quotes)return fmtPrice(m.pricing?.beijing?.[side]);
  if(!quotes.length)return '<span class="missing">'+(m.pricing?.raw?.length?'未识别':'未提供')+'</span>';
  return quotes.map(q=>`<div class="price-line">${q[side]==null?'<span class="missing">未提供</span>':fmtPrice(q[side])}${priceLabel(q)||quotes.length>1?`<small>${escapeHTML(priceLabel(q)||'普通')}</small>`:''}</div>`).join('');
};
const billingDetails = m => `<details class="data-source billing"><summary>计费明细</summary>${m.pricing?.status==='incomplete'?'<p>百炼未提供完整输入、输出价格，不参与性价比计算。</p>':''}<p>价格单位沿用百炼原始响应；排序采用 10k 输入档位，分时模型采用高峰价。</p>${(m.pricing?.raw||[]).map(g=>`<p>${escapeHTML(g.range_name)}<br>${(g.prices||[]).map(p=>`${escapeHTML(p.price_name||p.type)}${p.time_band?' · '+escapeHTML(({peak:'高峰',offpeak:'低谷'})[p.time_band]||p.time_band):''}：${escapeHTML(p.price)} ${escapeHTML(p.price_unit)}`).join('<br>')}</p>`).join('')||'<p>百炼未提供价格列表。</p>'}</details>`;
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
const copy = async text => { try { await navigator.clipboard.writeText(text); toast(`已复制 ${text}`); } catch { toast("复制失败，请手动选择代码复制"); } };
const modelLabel = m => `${escapeHTML(m.name)} (${escapeHTML(m.code)})`;

const complete = snapshot => {
  const doc=snapshot?.modelsDoc,roles=snapshot?.data?.roles;
  if(doc?.schema_version!==2||doc.updated_at!==snapshot?.data?.updated_at||doc.verified_catalog!==true||!doc.models?.length||!roles)return false;
  const codes=new Set(doc.models.map(m=>m.code));
  return codes.size===doc.models.length&&doc.models.every(m=>m.name&&m.code&&m.provenance?.catalog?.fetched_at&&m.provenance?.catalog?.model_id===m.code)&&['fable','opus','sonnet','haiku'].every(r=>Array.isArray(roles[r]?.candidates)&&roles[r].candidates.every(c=>codes.has(c)));
};
async function loadSnapshot(){
  const key='model-select:last-good:v2';
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
  const warning=$('#updateWarning');
  try {
    const response=await fetch('data/update-status.json',{cache:'no-store',signal:AbortSignal.timeout(4000)});
    const status=response.ok?await response.json():null;
    const notice=window.modelUpdateNotice(status,mode);
    if(notice){
      warning.hidden=false;
      const title=document.createElement('strong');title.textContent=notice.title;
      const detail=document.createElement('span');detail.textContent=notice.detail;
      warning.replaceChildren(title,detail);
      if(status?.run_url?.startsWith('https://github.com/imlk0/model-select/actions/runs/')){
        const link=document.createElement('a');link.href=status.run_url;link.textContent='查看更新记录 ↗';link.target='_blank';link.rel='noopener';warning.append(link);
      }
    }
  }catch{
    warning.hidden=false;warning.textContent='暂时无法确认 CI 更新状态，请核对数据快照时间。';
  }

  if(mode!=='demo'&&modelsDoc.models.some(m=>m.provenance?.benchmark)){const credit=document.createElement('a');credit.href='https://artificialanalysis.ai/';credit.textContent='评测：Artificial Analysis ↗';credit.target='_blank';credit.rel='noopener';$('footer').append(credit);}
  const models = Object.fromEntries(modelsDoc.models.map(m=>[m.code,m]));
  $('#updatedAt').textContent = new Date(data.updated_at).toLocaleString('zh-CN',{hour12:false});
  $('#evidenceNote').textContent = mode==='demo'?'演示数据':mode==='cached'?'最近有效快照':data.region;

  let activeTool='claude';
  const profiles={claude:['fable','opus','sonnet','haiku'].map(key=>({key,label:key, ...data.roles[key]})),codex:[{key:'astra',label:'Astra',positioning:'高难度分析、复杂 Agent 任务',candidates:data.roles.fable.candidates},{key:'sol',label:'Sol',positioning:'复杂编程与日常主力',candidates:data.roles.opus.candidates},{key:'terra',label:'Terra',positioning:'能力与成本均衡',candidates:data.roles.sonnet.candidates},{key:'luna',label:'Luna',positioning:'明确的小任务、快速响应',candidates:data.roles.haiku.candidates}]};
  if(mode!=='demo'&&data.tier_method){const note=document.createElement('p');note.className='table-note';note.textContent=data.tier_method;$('.recommendations').append(note);}
  const valid = n => typeof n === 'number' && Number.isFinite(n);
  // Preserve the original AA Intelligence Index; do not average different indices.
  const ability = m => m.scores?.capability ?? null;
  const cost = m => { const p=m.pricing?.beijing; return valid(p?.input)&&valid(p?.output) ? p.input*.01+p.output*.002 : null; };
  const entry = (m, value, rank) => `<button class="model-trigger" data-model="${escapeHTML(m.code)}" data-status="${valid(value)?'排序值 '+fmt(value):'数据快照'}" aria-describedby="modelPopover">${rank?`<span class="rank-number">${rank}</span>`:''}${escapeHTML(m.name)}</button>`;
  const ranking = (pool, metric) => {
    const ranked=pool.map(m=>({m,value:metric(m)})).filter(x=>valid(x.value)).sort((a,b)=>b.value-a.value || a.m.code.localeCompare(b.m.code));
    if(!ranked.length)return '<span class="muted">暂无可靠指标</span>';
    return ranked.slice(0,3).map(x=>entry(x.m,x.value,1+ranked.filter(y=>y.value>x.value).length)).join('');
  };
  const metrics={ability:ability,speed:m=>m.speed?.tokens_per_second,value:m=>{const a=ability(m),c=cost(m);return valid(a)&&c>0?a/c:null;}};
  const motionAllowed=()=>!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal=(selector)=>{
    if(!motionAllowed())return;
    document.querySelectorAll(selector).forEach((el,i)=>{
      el.getAnimations().forEach(a=>a.cancel());
      el.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:Math.min(i,7)*24,easing:'cubic-bezier(.2,.8,.2,1)',fill:'backwards'});
    });
  };
  let selectedMetric='ability';
  const renderSummary=(animateChanges=false)=>{
    const metric=metrics[selectedMetric];
    const previous=[...$('#summaryGrid').children];
    const next=profiles[activeTool].map(role=>{
      const pool=role.candidates.map(c=>models[c]).filter(Boolean);
      const m=pool.filter(m=>valid(metric(m))).sort((a,b)=>metric(b)-metric(a)||a.code.localeCompare(b.code))[0];
      if(!m)return `<article class="summary-card"><div class="role">${role.label}</div><div class="pick">暂无可靠推荐</div><p class="muted">等待指标核实</p></article>`;
      return `<article class="summary-card"><div class="role">${role.label}</div><div class="pick">${escapeHTML(m.name)}</div><button class="code copy" data-copy="${escapeHTML(m.code)}">${escapeHTML(m.code)}</button></article>`;
    });
    if(animateChanges&&previous.length===next.length){
      next.forEach((html,i)=>{const template=document.createElement('template');template.innerHTML=html;const fresh=template.content.firstElementChild,old=previous[i];
        if(!old.querySelector('.copy')||!fresh.querySelector('.copy')){old.replaceWith(fresh);return;}
        if(old.querySelector('.copy').dataset.copy===fresh.querySelector('.copy').dataset.copy)return;
        ['.pick','.copy'].forEach(selector=>{const element=old.querySelector(selector);element.replaceWith(fresh.querySelector(selector));});
        if(motionAllowed())old.querySelectorAll('.pick,.copy').forEach(el=>el.animate([{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:210,easing:'ease-out'}));
      });
    }else $('#summaryGrid').innerHTML=next.join('');
    $('#summaryGrid').querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderSummary();
  document.querySelectorAll('[data-metric]').forEach(el=>el.onclick=()=>{selectedMetric=el.dataset.metric;document.querySelectorAll('[data-metric]').forEach(button=>button.setAttribute('aria-pressed',String(button===el)));renderSummary(true);});
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
  const renderRanking=()=>{
    $('#recommendationRows').innerHTML=profiles[activeTool].map(x=>{
      const pool=x.candidates.map(c=>models[c]).filter(Boolean);
      return `<tr><td class="role-cell"><strong>${x.label==='fable'?'Fable':x.label==='opus'?'Opus':x.label==='sonnet'?'Sonnet':x.label==='haiku'?'Haiku':x.label}</strong><p class="field-description">${escapeHTML(x.positioning)}</p></td><td>${ranking(pool,ability)}</td><td>${ranking(pool,metrics.speed)}</td><td>${ranking(pool,metrics.value)}</td></tr>`;
    }).join('');
    $('.selection-table th').textContent=activeTool==='claude'?'Claude 档位':'GPT 档位';
    $('.field-hint').hidden=activeTool!=='claude';
  };
  renderRanking();
  const popover=$('#modelPopover');
  let active=null,closeTimer;
  const close=()=>{popover.hidden=true;active=null;};
  const show=el=>{
    clearTimeout(closeTimer); active=el; const m=models[el.dataset.model],p=m.pricing?.beijing;
    popover.innerHTML=`<strong>${escapeHTML(m.name)}</strong><div class="muted">${escapeHTML(el.dataset.status||'百炼模型目录')}</div><button class="code copy" data-copy="${escapeHTML(m.code)}" aria-label="复制模型代码">${escapeHTML(m.code)} ↗ 复制</button><dl><dt>输入 / 输出价格 · 10k 输入口径</dt><dd>输入 ${priceLines(m,'input')} / 输出 ${priceLines(m,'output')} 每百万 token</dd><dt>上下文</dt><dd>${fmt(m.context_k)}K tokens</dd><dt>Coding / Agentic</dt><dd>${fmt(m.scores?.coding)} / ${fmt(m.scores?.agentic)}</dd><dt>输出速度 · AA 跨供应商参考</dt><dd>${fmt(m.speed?.tokens_per_second)} tok/s</dd><dt>公开发布时间 · AA</dt><dd>${escapeHTML(m.release_date||'未收录')}</dd></dl>${billingDetails(m)}<p class="muted">${escapeHTML(modelsDoc.region)}</p>`;
    const evidence=m.provenance;
    if(evidence){
      popover.insertAdjacentHTML('beforeend',`<div class="popover-sources"><a href="https://bailian.console.aliyun.com/cn-beijing/model/market/detail/${encodeURIComponent(m.code)}" target="_blank" rel="noopener">百炼模型介绍 ↗</a>${evidence.benchmark?`<a href="https://artificialanalysis.ai/models/${encodeURIComponent(evidence.benchmark.aa_slug)}" target="_blank" rel="noopener">AA 模型测评 ↗</a>`:'<span class="muted">AA 尚未匹配</span>'}<p class="muted">目录核验：${escapeHTML(new Date(evidence.catalog.fetched_at).toLocaleString('zh-CN'))}${evidence.benchmark?' · AA Index v'+escapeHTML(evidence.benchmark.index_version):''}</p></div>`);
    }
    popover.querySelector('[data-copy]').onclick=()=>copy(m.code);
    const wasHidden=popover.hidden;
    popover.hidden=false;
    if(wasHidden&&motionAllowed()){popover.getAnimations().forEach(a=>a.cancel());popover.animate([{opacity:0,transform:'translateY(4px)'},{opacity:1,transform:'translateY(0)'}],{duration:150,easing:'ease-out'});}
    const r=el.getBoundingClientRect(),h=popover.offsetHeight,w=popover.offsetWidth;
    const cell=el.closest('td').getBoundingClientRect();
    const right=cell.right+10,left=cell.left-w-10;
    const side=right+w<=window.innerWidth-8?right:left>=8?left:Math.max(8,window.innerWidth-w-8);
    popover.style.left=side+'px';
    popover.style.top=Math.max(8,Math.min(r.top-12,window.innerHeight-h-8))+'px';
  };
  const bindModels=()=>document.querySelectorAll('[data-model]').forEach(el=>{
    el.onmouseenter=()=>show(el); el.onfocus=()=>show(el); el.onclick=()=>{
      if(el.classList.contains('table-model')){show(el);return;}
      clearTimeout(closeTimer); close();
      $('#search').value=''; renderCards('');
      const row=document.getElementById('model-'+encodeURIComponent(el.dataset.model));
      document.querySelectorAll('.model-selected').forEach(r=>r.classList.remove('model-selected'));
      if(row){setTimeout(()=>row.classList.remove('model-selected'),1500);row.classList.add('model-selected');row.focus({preventScroll:true});row.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});}
    };
    el.onmouseleave=()=>{closeTimer=setTimeout(close,600);};
    el.onblur=e=>{if(!popover.contains(e.relatedTarget))closeTimer=setTimeout(close,600);};
  });
  bindModels();
  popover.onmouseenter=()=>clearTimeout(closeTimer);
  popover.onmouseleave=()=>{closeTimer=setTimeout(close,600);};
  popover.onfocusin=()=>clearTimeout(closeTimer);
  popover.onfocusout=e=>{if(!popover.contains(e.relatedTarget))close();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('click',e=>{if(!e.target.closest('[data-model]')&&!popover.contains(e.target))close();});
  window.addEventListener('resize',close); window.addEventListener('scroll',close,{passive:true});

  let tableSort=null, sortDirection=-1;
  const sortValues={name:m=>m.name,release:m=>m.release_date,capability:m=>m.scores?.capability,coding:m=>m.scores?.coding,agentic:m=>m.scores?.agentic,speed:m=>m.speed?.tokens_per_second,input:m=>m.pricing?.beijing?.input,output:m=>m.pricing?.beijing?.output,context:m=>m.context_k,evidence:m=>m.evidence_coverage};
  const renderCards = q => {
    const needle=q.trim().toLowerCase();
    const filtered=modelsDoc.models.filter(m=>!needle || `${escapeHTML(m.name)} ${escapeHTML(m.code)}`.toLowerCase().includes(needle));
    if(tableSort)filtered.sort((a,b)=>{const x=sortValues[tableSort](a),y=sortValues[tableSort](b);if(x==null)return y==null?0:1;if(y==null)return -1;return sortDirection*(typeof x==='string'?x.localeCompare(y):(x-y));});
    const cell = (n,format=fmt) => `<td class="numeric ${n==null?'missing':''}">${format(n)}</td>`;
    $('#modelCards').innerHTML=filtered.map(m=>{
      const p=m.pricing?.beijing||{};
      return `<tr id="model-${encodeURIComponent(m.code)}" tabindex="-1"><td><button class="model-name table-model" data-model="${escapeHTML(m.code)}" aria-label="查看 ${escapeHTML(m.name)} 详情">${escapeHTML(m.name)}</button><button class="code copy" data-copy="${escapeHTML(m.code)}" aria-label="复制 ${escapeHTML(m.code)}">${escapeHTML(m.code)}</button></td>${cell(m.scores?.capability)}${cell(m.scores?.coding)}${cell(m.scores?.agentic)}${cell(m.speed?.tokens_per_second)}<td class="numeric">${priceLines(m,'input')}</td><td class="numeric">${priceLines(m,'output')}</td>${cell(m.context_k)}<td class="numeric ${m.release_date?'':'missing'}" title="公开发布时间 · Artificial Analysis">${escapeHTML(m.release_date||'未收录')}</td><td class="numeric">${Math.round((m.evidence_coverage||0)*100)}%</td></tr>`;
    }).join('') || '<tr><td colspan="10">没有匹配的模型</td></tr>';
    bindModels();
    reveal('#modelCards tr');
    $('#filterCount').textContent = `${filtered.length} / ${modelsDoc.models.length} MODELS`;
    document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderCards('');
  document.querySelectorAll('[data-sort]').forEach(button=>button.onclick=()=>{
    sortDirection=tableSort===button.dataset.sort?-sortDirection:(['name','input','output'].includes(button.dataset.sort)?1:-1);tableSort=button.dataset.sort;
    document.querySelectorAll('[data-sort]').forEach(b=>{const active=b===button;b.parentElement.setAttribute('aria-sort',active?(sortDirection===1?'ascending':'descending'):'none');b.querySelector('span').textContent=active?(sortDirection===1?' ↑':' ↓'):'';});renderCards($('#search').value);
  });
  document.querySelectorAll('[data-tool]').forEach(el=>el.onclick=()=>{
    if(activeTool===el.dataset.tool){$('#toggleRanking').click();return;}
    const host=$('.recommendations'),before=host.getBoundingClientRect().height;
    activeTool=el.dataset.tool;
    document.querySelectorAll('[data-tool]').forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-selected',String(b===el));});
    $('#summaryGrid').classList.toggle('gpt-summary',activeTool==='codex');
    close();renderSummary();renderRanking();bindModels();
    if(motionAllowed()){host.getAnimations().forEach(a=>a.cancel());host.animate([{height:before+'px'},{height:host.getBoundingClientRect().height+'px'}],{duration:260,easing:'cubic-bezier(.2,.8,.2,1)'});reveal($('#rankingDetails').hidden?'#summaryGrid .summary-card':'#recommendationRows tr');}
  });
  $('#search').addEventListener('input',e=>renderCards(e.target.value));
  document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
}
boot().catch(()=>{ $('#evidenceNote').textContent='数据暂不可用'; });
