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
