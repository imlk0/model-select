const assert = require('node:assert/strict');
const notice = require('../data-status.js');
const now = Date.parse('2026-10-07T00:00:00Z');
const status = {execution: 'github-actions', status: 'updated', attempted_at: '2026-10-06T00:00:00Z'};
assert.equal(notice(status, 'live', now), null);
for (const state of ['partial','failed','blocked']) {
  assert.ok(notice({...status,status:state}, 'live', now));
  assert.match(notice({...status,status:state}, 'demo', now).detail, /演示数据/);
}
assert.match(notice({...status,attempted_at:'2026-10-01T00:00:00Z'}, 'live', now).title, /逾期/);
assert.match(notice(null, 'live', now).title, /未知/);
assert.equal(notice({execution:'local'}, 'demo', now), null);
console.log('CI notice states passed');
const fs = require('node:fs');
const app = fs.readFileSync(require.resolve('../app.js'),'utf8');
const validSnapshot = new Function(app.slice(app.indexOf('const complete ='),app.indexOf('async function loadSnapshot'))+'return complete;')();
const model = {name:'Dynamic model',code:'dynamic',provenance:{catalog:{model_id:'dynamic',fetched_at:'now'}}};
const roles = Object.fromEntries(['fable','opus','sonnet','haiku'].map(role=>[role,{candidates:[]}])) ;
const snapshot = {modelsDoc:{schema_version:2,verified_catalog:true,updated_at:'now',models:[model]},data:{updated_at:'now',roles}};
assert.equal(validSnapshot(snapshot), true);
assert.equal(validSnapshot({...snapshot,data:{...snapshot.data,updated_at:'older'}}),false);
assert.equal(validSnapshot({...snapshot,modelsDoc:{...snapshot.modelsDoc,models:[model,model]}}),false);
console.log('Snapshot consistency passed');

const priceFormat = new Function(app.slice(app.indexOf('const fmtPrice ='),app.indexOf('const toast ='))+'return fmtPrice;')();
assert.equal(priceFormat(0.15),'0.15');
assert.equal(priceFormat(0.001),'0.001');
assert.equal(priceFormat(0),'0');
assert.equal(priceFormat(null),'N/A');
console.log('Price precision passed');
const priceHelpers = new Function(app.slice(app.indexOf('const escapeHTML='),app.indexOf('const toast ='))+'return {priceLines,billingDetails};')();
assert.match(priceHelpers.priceLines({pricing:{quotes:[{mode:'thinking',time_band:'standard',input:0,output:null}]}},'input'),/0.*思考/);
assert.match(priceHelpers.priceLines({pricing:{quotes:[],raw:[]}},'output'),/未提供/);
assert.match(priceHelpers.billingDetails({pricing:{raw:[{range_name:'<unsafe>',prices:[]}]}}),/&lt;unsafe&gt;/);
console.log('Price variants and escaped billing details passed');

const details = new Function(app.slice(app.indexOf('const escapeHTML='),app.indexOf('const toast ='))+'return modelDetails;')();
const card = details({name:'Example',code:'example',context_k:32.8,scores:{},speed:{},release_date:'2025-01-20',release_date_source:'Artificial Analysis',provenance:{benchmark:{aa_slug:'example'}}});
assert.ok(card.indexOf('Artificial Analysis ↗') < card.indexOf('<dl>'));
assert.match(card, /上下文（K tokens）<\/dt><dd>32.8<\/dd>/);
assert.match(card, /输出速度（tok\/s）<\/dt><dd>N\/A<\/dd>/);
assert.match(card, /<dt>公开发布时间<\/dt>/);
assert.doesNotMatch(card, /公开发布时间 · AA|华北2|目录核验|百炼模型目录/);
assert.match(details({name:'Other',code:'other',release_date_source:'Bailian'}), /<dt>百炼上架日期<\/dt>/);
console.log('Compact shared model details passed');
