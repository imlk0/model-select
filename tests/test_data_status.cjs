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
assert.match(card, /<dt>发布日期<\/dt>/);
assert.doesNotMatch(card, /公开发布时间 · AA|华北2|目录核验|百炼模型目录/);
assert.match(details({name:'Other',code:'other',release_date:'2025-01-01',release_date_source:'Bailian'}), /百炼上架：2025-01-01；公开发布日期未收录">未收录/);
const prices=details({name:'Timed',code:'timed',pricing:{quotes:[{time_band:'peak',input:9,output:27},{time_band:'offpeak',input:4.5,output:13.5}]}});
assert.match(prices, /9<small>高峰/);
assert.match(prices, /price-secondary[^>]*>4.5<small>低谷/);
assert.doesNotMatch(prices, /<dt[^>]*>价格/);
const cached=priceHelpers.priceLines({pricing:{quotes:[{input:4,output:12}],raw:[{range_name:'Default',prices:[{type:'input_token_cache',price:'0.8',price_unit:'每百万tokens'}]}]}},'input');
assert.match(cached,/price-cache[^>]*>0.8<small>缓存/);
assert.doesNotMatch(priceHelpers.priceLines({pricing:{quotes:[{input:4,output:12}],raw:[{prices:[{type:'input_token_cache',price:'0.8',price_unit:'每百万tokens'}]}]}},'output'),/缓存/);
console.log('Compact shared model details passed');

const cacheVariants=priceHelpers.priceLines({pricing:{quotes:[{input:2,output:3}],comparison:{input_range:'selected'},raw:[{range_name:'other',prices:[{type:'input_token_cache',price:99,price_unit:'每百万tokens'}]},{range_name:'selected',prices:[{type:'input_token_cache_read',price:0,price_unit:'每百万tokens'},{type:'input_token_cache_creation_5m',price:1,price_unit:'每百万tokens'}]}]}},'input');
assert.match(cacheVariants,/0<small>读缓存/);
assert.match(cacheVariants,/1<small>写缓存/);
assert.doesNotMatch(cacheVariants,/99/);
