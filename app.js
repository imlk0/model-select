const $ = s => document.querySelector(s);
const fmt = n => (n === null || n === undefined) ? 'N/A' : Number(n).toFixed(Number(n)%1?1:0);
const toast = msg => { const t=$('#toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),1200); };
const copy = async text => { await navigator.clipboard.writeText(text); toast(`已复制 ${text}`); };
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
      <td>${picks.map(m=>`<span class="pill copy" data-copy="${m.code}">${modelLabel(m)}</span>`).join('')}</td>
      <td><span class="pill copy" data-copy="${fast?.code}">${fast?modelLabel(fast):'N/A'}</span></td>
      <td><span class="pill copy" data-copy="${value?.code}">${value?modelLabel(value):'N/A'}</span></td>
      <td class="price">${p ? `¥${fmt(p.input)}/¥${fmt(p.output)}` : 'N/A'}</td>
      <td><span class="evidence ${x.confidence>=.8?'good':'mid'}">${Math.round(x.confidence*100)}%</span></td>
    </tr>`;
  }).join('');

  const renderCards = q => {
    const needle=q.trim().toLowerCase();
    $('#modelCards').innerHTML=modelsDoc.models.filter(m=>!needle || `${m.name} ${m.code}`.toLowerCase().includes(needle)).map(m=>{
      const p=m.pricing?.beijing||{};
      return `<article class="model-card"><div class="model-top"><div><div class="model-name">${m.name}</div><div class="code copy" data-copy="${m.code}">${m.code}</div></div><span class="pill">${m.context_k?`${m.context_k}K ctx`:'ctx N/A'}</span></div>
      <div class="score-grid">
        <div class="metric"><div class="label">能力</div><div class="value">${fmt(m.scores?.capability)}</div></div>
        <div class="metric"><div class="label">速度 t/s</div><div class="value">${fmt(m.speed?.tokens_per_second)}</div></div>
        <div class="metric"><div class="label">¥ 输入/输出</div><div class="value" style="font-size:14px">${p.input!=null?`${fmt(p.input)} / ${fmt(p.output)}`:'N/A'}</div></div>
      </div>
      <div class="sources">证据覆盖 ${Math.round((m.evidence_coverage||0)*100)}% · ${m.sources.join(' · ')}</div></article>`;
    }).join('');
    document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
  };
  renderCards('');
  $('#search').addEventListener('input',e=>renderCards(e.target.value));
  document.querySelectorAll('[data-copy]').forEach(el=>el.onclick=()=>copy(el.dataset.copy));
}
boot().catch(err=>{console.error(err);document.body.insertAdjacentHTML('beforeend',`<pre style="color:#ff9c9c">${err.message}</pre>`)});
