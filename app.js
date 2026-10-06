const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined) ? 'N/A' : Number(n).toFixed(Number(n)%1?1:0);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
const copy = async text => { try { await navigator.clipboard.writeText(text); toast(`已复制 ${text}`); } catch { toast("复制失败，请手动选择代码复制"); } };
const modelLabel = m => `${m.name} (${m.code})`;

async function boot(){
  const [data, modelsDoc] = await Promise.all([
    fetch('data/recommendations.json').then(r=>r.json()),
    fetch('data/models.json').then(r=>r.json())
  ]);
  const models = Object.fromEntries(modelsDoc.models.map(m=>[m.code,m]));
  $('#updatedAt').textContent = new Date(data.updated_at).toLocaleString('zh-CN',{hour12:false});
  $('#evidenceNote').textContent = `评分版本 ${data.scoring_version} · ${data.region}`;

  const roles=['fable','opus','sonnet','haiku'];
  $('#summaryGrid').innerHTML = roles.map(r=>{
    const x=data.roles[r], m=models[x.best];
    return `<article class="summary-card"><div class="role">${r}</div><div class="pick">${m?.name||x.best}</div><div class="code">${x.best}</div></article>`;
  }).join('');

  const valid = n => typeof n === 'number' && Number.isFinite(n);
  // Compare coding and agentic only when they are supplied on the same scale.
  const ability = m => valid(m.scores?.coding) && valid(m.scores?.agentic) && m.scores?.comparable_scale === true ? (m.scores.coding+m.scores.agentic)/2 : null;
  const cost = m => { const p=m.pricing?.beijing; return valid(p?.input)&&valid(p?.output) ? p.input*.01+p.output*.002 : null; };
  const entry = (m, value, rank) => `<button class="model-trigger" data-model="${m.code}" data-status="${valid(value)?'排序值 '+fmt(value):'缺少指标，暂未排序'}" aria-describedby="modelPopover">${rank?`<span class="rank-number">${rank}</span>`:''}${m.name}</button>`;
  const ranking = (pool, metric) => {
    const ranked=pool.map(m=>({m,value:metric(m)})).filter(x=>valid(x.value)).sort((a,b)=>b.value-a.value || a.m.code.localeCompare(b.m.code));
    const selected=ranked.slice(0,3);
    const missing=pool.filter(m=>!valid(metric(m))).slice(0,3-selected.length);
    return selected.map(x=>entry(x.m,x.value,1+ranked.filter(y=>y.value>x.value).length)).join('')+missing.map(m=>entry(m,null,null)).join('')+(missing.length?'<div class="unranked">'+(ranked.length?'其余候选暂未排序':'候选 · 暂未排序')+'</div>':'');
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
    popover.innerHTML=`<strong>${m.name}</strong><div class="muted">${el.dataset.status}</div><button class="code copy" data-copy="${m.code}" aria-label="复制模型代码">${m.code} ↗ 复制</button><dl><dt>输入 / 输出价格</dt><dd>¥${fmt(p?.input)} / ¥${fmt(p?.output)} 每百万 token</dd><dt>上下文</dt><dd>${fmt(m.context_k)}K tokens</dd><dt>Coding / Agentic</dt><dd>${fmt(m.scores?.coding)} / ${fmt(m.scores?.agentic)}</dd><dt>输出速度</dt><dd>${fmt(m.speed?.tokens_per_second)} tok/s</dd></dl><p class="muted">${modelsDoc.region} · 1M 声明请核实实际端点支持</p>`;
    popover.querySelector('[data-copy]').onclick=()=>copy(m.code);
    popover.hidden=false;
    const r=el.getBoundingClientRect(),h=popover.offsetHeight,w=popover.offsetWidth;
    popover.style.left=Math.max(8,Math.min(r.left,window.innerWidth-w-8))+'px';
    popover.style.top=Math.max(8,Math.min(r.bottom+6,window.innerHeight-h-8))+'px';
  };
  document.querySelectorAll('[data-model]').forEach(el=>{
    el.onmouseenter=()=>show(el); el.onfocus=()=>show(el); el.onclick=()=>show(el);
    el.onmouseleave=()=>{closeTimer=setTimeout(close,180);};
    el.onblur=e=>{if(!popover.contains(e.relatedTarget))closeTimer=setTimeout(close,180);};
  });
  popover.onmouseenter=()=>clearTimeout(closeTimer);
  popover.onmouseleave=()=>{closeTimer=setTimeout(close,180);};
  popover.onfocusin=()=>clearTimeout(closeTimer);
  popover.onfocusout=e=>{if(!popover.contains(e.relatedTarget))close();};
  document.addEventListener('keydown',e=>{if(e.key==='Escape')close();});
  document.addEventListener('click',e=>{if(!e.target.closest('[data-model]')&&!popover.contains(e.target))close();});
  window.addEventListener('resize',close); window.addEventListener('scroll',close,{passive:true});

  const renderCards = q => {
    const needle=q.trim().toLowerCase();
    const filtered=modelsDoc.models.filter(m=>!needle || `${m.name} ${m.code}`.toLowerCase().includes(needle));
    const cell = n => `<td class="numeric ${n==null?'missing':''}">${fmt(n)}</td>`;
    $('#modelCards').innerHTML=filtered.map(m=>{
      const p=m.pricing?.beijing||{};
      return `<tr><td><div class="model-name">${m.name}</div><button class="code copy" data-copy="${m.code}" aria-label="复制 ${m.code}">${m.code}</button></td>${cell(m.scores?.capability)}${cell(m.scores?.coding)}${cell(m.scores?.agentic)}${cell(m.speed?.tokens_per_second)}${cell(p.input)}${cell(p.output)}${cell(m.context_k)}<td class="numeric">${Math.round((m.evidence_coverage||0)*100)}%</td></tr>`;
    }).join('') || '<tr><td colspan="9">没有匹配的模型</td></tr>';
    $('#filterCount').textContent = `${filtered.length} / ${modelsDoc.models.length} MODELS · PRICE: ${modelsDoc.region}`;
    document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderCards('');
  $('#search').addEventListener('input',e=>renderCards(e.target.value));
  document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
}
boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend',`<pre style="color:#ff9c9c">${err.message}</pre>`)});
