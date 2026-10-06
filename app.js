const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined) ? 'N/A' : Number(n).toFixed(Number(n)%1?1:0);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
const copy = async text => { try { await navigator.clipboard.writeText(text); toast(`已复制 ${text}`); } catch { toast("复制失败，请手动选择代码复制"); } };
const modelLabel = m => `${m.name} (${m.code})`;

async function boot(){
  const [data, modelsDoc, fields] = await Promise.all([
    fetch('data/recommendations.json').then(r=>r.json()),
    fetch('data/models.json').then(r=>r.json()),
    fetch('config/claude-code-fields.json').then(r=>r.json())
  ]);
  const models = Object.fromEntries(modelsDoc.models.map(m=>[m.code,m]));
  $('#updatedAt').textContent = new Date(data.updated_at).toLocaleString('zh-CN',{hour12:false});
  $('#evidenceNote').textContent = `评分版本 ${data.scoring_version} · ${data.region}`;

  const roles=['fable','opus','sonnet','haiku'];
  $('#summaryGrid').innerHTML = roles.map(r=>{
    const x=data.roles[r], m=models[x.best];
    return `<article class="summary-card"><div class="role">${r}</div><div class="pick">${m?.name||x.best}</div><div class="code">${x.best}</div><div class="muted" style="margin-top:8px">${x.positioning}</div></article>`;
  }).join('');

  const valid = n => typeof n === 'number' && Number.isFinite(n);
  // Compare coding and agentic only when they are supplied on the same scale.
  const ability = m => valid(m.scores?.coding) && valid(m.scores?.agentic) && m.scores?.comparable_scale === true ? (m.scores.coding+m.scores.agentic)/2 : null;
  const cost = m => { const p=m.pricing?.beijing; return valid(p?.input)&&valid(p?.output) ? p.input*.01+p.output*.002 : null; };
  const entry = (m, value, unit, rank) => { const p=m.pricing?.beijing; return `<div class="rank-item"><div class="rank-title"><span class="rank-number">${rank}</span><strong>${m.name}</strong></div><button class="code copy" data-copy="${m.code}">${m.code}</button><div class="rank-metric">${fmt(value)} ${unit}</div><div class="muted">输入 ¥${fmt(p?.input)} / 输出 ¥${fmt(p?.output)} · /M</div></div>`; };
  const ranking = (pool, metric, unit) => {
    const ranked=pool.map(m=>({m,value:metric(m)})).filter(x=>valid(x.value)).sort((a,b)=>b.value-a.value || a.m.code.localeCompare(b.m.code));
    if (!ranked.length) return '<div class="missing">暂无法排序</div><div class="muted">缺少可比较指标</div>';
    return ranked.slice(0,3).map((x,i)=>entry(x.m,x.value,unit,1+ranked.filter(y=>y.value>x.value).length)).join('') + `<div class="muted">${ranked.length} 个模型有可比较数据</div>`;
  };
  const rows=[...roles.map(role=>({label:role[0].toUpperCase()+role.slice(1),positioning:data.roles[role].positioning,reference:data.roles[role].best,pool:role})),fields.subagent,fields.fallback];
  $('#recommendationRows').innerHTML=rows.map(x=>{
    const pool=[...new Set([...(data.roles[x.pool]?.candidates||[]),x.reference])].map(c=>models[c]).filter(Boolean), m=models[x.reference];
    const p=m?.pricing?.beijing;
    const setup=m ? `<div class="muted">${x.label==='Subagent'?'显示名称：不显示在菜单中':'显示名称' + (x.label==='默认兜底模型'?'：无此字段':'：'+m.name)}</div><button class="code copy" data-copy="${m.code}" aria-label="复制 ${x.label} 实际请求模型">${m.code}</button><div class="muted">输入 ¥${fmt(p?.input)} / 输出 ¥${fmt(p?.output)} · /M</div><div class="muted">上下文 ${fmt(m.context_k)}K · 1M 支持待端点核实</div><div class="seed-label">初始填写参考 · 未经完整跑分验证</div>${x.reason?`<div class="muted">${x.reason}</div>`:''}` : 'N/A';
    return `<tr><td class="role-cell"><strong>${x.label}</strong><p class="field-description">${x.positioning}</p></td><td>${ranking(pool,ability,'分')}</td><td>${ranking(pool,m=>m.speed?.tokens_per_second,'tok/s')}</td><td>${ranking(pool,m=>{const a=ability(m),c=cost(m);return valid(a)&&c>0?a/c:null;},'分/¥')}</td><td>${setup}</td></tr>`;
  }).join('');

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
