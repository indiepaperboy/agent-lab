import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import '../src/data.js';
import '../src/tools.js';
import '../src/lesson.js';
const T=LabTools,run=(name,args)=>T.execute(name,args), fresh=()=>T.useSample();
const tool=(name,args={})=>({type:'tool',summary:'Run '+name,tool:name,args});
test('embedded sample exactly matches canonical source files',async()=>{
 const dir=new URL('../data/',import.meta.url);assert.deepEqual(Object.keys(AgentData).sort(),(await readdir(dir)).sort());
 for(const [f,data] of Object.entries(AgentData))assert.equal(data,await readFile(new URL(f,dir),'utf8'));
});
test('all input cost is retained; only unique exact references allocate',()=>{
 fresh();assert.equal(run('reconcile_inventory').ok,true);
 const r=T.snapshot().report;assert.equal(r.rows.length,8);assert.equal(r.input_cents,159000);assert.equal(r.allocated_cents,69000);assert.equal(r.unresolved_cents,90000);
 assert.equal(r.input_cents,r.allocated_cents+r.unresolved_cents);
 assert.deepEqual(r.rows.map(x=>x.reason_code),['','','','reference_not_found','missing_cost_centre','reference_not_found','ambiguous_reference','missing_reference']);
 assert.ok(r.rows.filter(x=>x.status==='exception').every(x=>x.cost_centre===''));
 assert.deepEqual(run('get_report').data.by_cost_centre,[{cost_centre:'CC-210',allocated_cost:'AUD 330.00'},{cost_centre:'CC-220',allocated_cost:'AUD 360.00'}]);
});
test('candidate reviews cannot approve allocations or use evidence from another row',()=>{
 fresh();run('reconcile_inventory');assert.equal(run('record_review',{row_id:'C-006',note:'candidate',candidate_rows:[5]}).ok,false);
 const candidates=run('search_references',{row_id:'C-006',query:'pump repair east'}).data;assert.deepEqual(candidates.map(x=>x.source_row),[5,6]);
 assert.equal(run('record_review',{row_id:'C-004',note:'wrong evidence',candidate_rows:[5]}).ok,false);
 assert.equal(run('record_review',{row_id:'C-006',note:'Two candidates need review',candidate_rows:[5,6]}).data.allocation_changed,false);
 assert.equal(run('record_review',{row_id:'C-001',note:'change allocation'}).ok,false);
 run('reconcile_inventory');let s=T.snapshot();assert.equal(s.report.allocated_cents,69000);assert.equal(s.report.rows[5].review_note,'Two candidates need review');
 s.report.rows[5].cost_centre='FORGED';assert.equal(T.snapshot().report.rows[5].cost_centre,'');T.reset();assert.equal(T.snapshot().report,null);
});
test('signed cost, case-sensitive exact matching and trimmed references',()=>{
 fresh();let {consumption:c,references:r}=T.snapshot().inputs;
 c=c.slice(0,3);c[0].inventory_cost='-10.25';c[0].reference=' JOB-1042 ';c[1].inventory_cost='0';c[2].reference='job-1042';T.load(c,r);run('reconcile_inventory');
 assert.equal(T.snapshot().report.allocated_cents,-1025);assert.equal(T.snapshot().report.unresolved_cents,9000);
});
test('invalid inputs are rejected atomically, including duplicate IDs and mixed currency',()=>{
 fresh();const old=T.snapshot();const bad=fn=>{const {consumption:c,references:r}=structuredClone(old.inputs);fn(c,r);assert.throws(()=>T.load(c,r));assert.deepEqual(T.snapshot(),old);};
 bad(c=>c[0].row_id=c[1].row_id);bad(c=>c[0].currency='USD');bad(c=>c[0].inventory_cost='1.001');bad(c=>c[0].reference=1042);bad(c=>c[0].quantity='oops');bad((c,r)=>r[0].reference='');
 assert.throws(()=>T.cents('1e5'));assert.throws(()=>T.cents('Infinity'));assert.equal(T.cents('-0.01'),-1);
});
test('duplicate references remain ambiguous even with the same cost centre',()=>{
 fresh();const {consumption:c,references:r}=T.snapshot().inputs;r.push({...r[0]});T.load(c,r);run('reconcile_inventory');assert.equal(T.snapshot().report.rows[0].reason_code,'ambiguous_reference');
});
test('unknown tools and malformed requests return errors without escaping allowlist',()=>{
 for(const [name,args]of [['__proto__',{}],['toString',{}],['read_file',{}],['inspect_inputs',[]],['search_references',{row_id:'missing',query:''}]])assert.equal(run(name,args).ok,false);
});
test('short lesson executes tools only at the three tool steps and preserves unresolved cost',()=>{
 const lesson=new LabLesson.Lesson();
 for(let i=0;i<12;i++){
  const e=lesson.next();assert.equal(e.index,i);assert.equal(lesson.events.length,i+1);
  assert.equal(!!e.request,[3,6,9].includes(i));
  if(i<3)assert.equal(T.snapshot().report,null);
 }
 assert.equal(lesson.done,true);assert.equal(lesson.next(),null);
 assert.deepEqual(lesson.results.search.map(r=>r.reference),['JOB-1050','JOB-1051']);
 const r=T.snapshot().report;assert.equal(r.allocated_cents,69000);assert.equal(r.unresolved_cents,90000);
 assert.equal(r.rows[5].status,'exception');assert.deepEqual(r.rows[5].candidate_rows,[5,6]);
 assert.equal(r.rows.filter(r=>r.review_note).length,1);
 const restart=new LabLesson.Lesson();assert.equal(restart.index,-1);assert.equal(T.snapshot().report,null);
});
