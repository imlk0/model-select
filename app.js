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
    return `<article class="summary-card"><div class="role">${r}</div><div class="pick">${m?.name||x.best}</div><div class="code">${x.best}</div><div class="muted" style="margin-top:8px">${x.positioning}</div></article>`;
  }).join('');

  $('#recommendationRows').innerHTML = roles.map(r=>{
    const x=data.roles[r];
    const picks=x.candidates.map(c=>models[c]).filter(Boolean);
    const best=models[x.best], fast=models[x.fastest], value=models[x.best_value];
    const p=best?.pricing?.beijing;
    return `<tr>
      <td class="role-cell"><strong>${r[0].toUpperCase()+r.slice(1)}</strong></td>
      <td>${x.positioning}</td>
      <td>${picks.map(m=>`<button class="pill copy" data-copy="${m.code}">${modelLabel(m)}</button>`).join('')}</td>
      <td><button class="pill copy" data-copy="${fast?.code}">${fast?modelLabel(fast):'N/A'}</button></td>
      <td><button class="pill copy" data-copy="${value?.code}">${value?modelLabel(value):'N/A'}</button></td>
      <td class="price">${p ? `¥${fmt(p.input)}/¥${fmt(p.output)}` : 'N/A'}</td>
      <td><span class="evidence ${x.confidence>=.8?'good':'mid'}">${Math.round(x.confidence*100)}%</span></td>
    </tr>`;
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
