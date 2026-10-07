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
