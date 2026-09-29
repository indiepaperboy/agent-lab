import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import '../src/data.js';
import '../src/tools.js';
import '../src/agent.js';
import '../src/tutorial.js';
import '../src/export.js';
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
test('CSV export quotes text, preserves signed costs and neutralises formula strings',()=>{
 const text=LabExport.csv([{row_id:'=1+1',description:'say "hi", please',inventory_cost:'-12.50'}]);const rows=T.parseCSV(text);assert.equal(rows[0].row_id,"'=1+1");assert.equal(rows[0].description,'say "hi", please');assert.equal(rows[0].inventory_cost,'-12.50');
});
test('unknown tools and malformed requests return errors without escaping allowlist',()=>{
 for(const [name,args]of [['__proto__',{}],['toString',{}],['read_file',{}],['inspect_inputs',[]],['search_references',{row_id:'missing',query:''}]])assert.equal(run(name,args).ok,false);
});
test('each click advances one observable event; tool request does not execute',async()=>{
 fresh();const loop=new LabAgent.AgentLoop(LabAgent.rehearsalDecide);
 for(const stage of ['GOAL','ASK','DECIDE','TOOL']){const before=loop.events.length;assert.equal((await loop.next()).stage,stage);assert.equal(loop.events.length,before+1);assert.equal(loop.history.length,0);}
 assert.equal((await loop.next()).stage,'OBSERVE');assert.equal(loop.history.length,1);
});
test('full rehearsal reviews all five exceptions and completes in 56 events',async()=>{
 fresh();const loop=new LabAgent.AgentLoop(LabAgent.rehearsalDecide);while(!loop.done){assert.ok(loop.events.length<60);await loop.next();}
 assert.equal(loop.events.length,56);assert.equal(loop.history.length,13);assert.ok(loop.history.every(h=>h.result.ok));assert.equal(run('get_report').data.reviewed_exceptions,5);assert.match(loop.events.at(-1).data.answer,/AUD 900.00/);assert.equal(await loop.next(),null);
});
test('ASK exposes exact model request with only returned observations',async()=>{
 fresh();let received;const loop=new LabAgent.AgentLoop(async(h,g,r)=>{received=r;return tool('inspect_inputs');},LabAgent.goal,LabAgent.buildRequest);
 await loop.next();const ask=await loop.next();assert.equal(received,undefined);assert.equal(ask.observations,0);assert.equal(ask.data.previous_results.length,0);
 await loop.next();assert.deepEqual(received,ask.data);await loop.next();await loop.next();const next=await loop.next();assert.equal(next.observations,1);assert.match(JSON.stringify(next.data.previous_results.at(-1)),/consumption_rows/);assert.equal(ask.data.previous_results.length,0);
});
test('pending model calls cannot double advance and failures are retryable',async()=>{
 let resolve;const loop=new LabAgent.AgentLoop(()=>new Promise(r=>resolve=r));await loop.next();await loop.next();const pending=loop.next();assert.equal(await loop.next(),null);resolve(tool('inspect_inputs'));assert.equal((await pending).stage,'DECIDE');
 let fails=true;const retry=new LabAgent.AgentLoop(async()=>{if(fails)throw Error('offline');return tool('inspect_inputs');});await retry.next();await retry.next();await assert.rejects(retry.next(),/offline/);assert.equal(retry.busy,false);fails=false;assert.equal((await retry.next()).stage,'DECIDE');
});
test('final answers require a computed report and teaching notes reflect real results',async()=>{
 fresh();const loop=new LabAgent.AgentLoop(async()=>({type:'answer',summary:'done',answer:'made up',sources:[]}));await loop.next();await loop.next();await assert.rejects(loop.next(),/get_report/);
 assert.match(LabTutorial.explain({stage:'ASK',observations:0},false).next,/simulated/);
 assert.match(LabTutorial.explain({stage:'ASK',observations:0},true).why,/explicitly tell/);
 assert.match(LabTutorial.explain({stage:'OBSERVE',tool:'search_references',data:{ok:true,data:[]}},true).what,/no supporting reference/);
 assert.match(LabTutorial.explain({stage:'OBSERVE',tool:'record_review',data:{ok:true,data:{row_id:'C-006'}}},true).what,/No allocation/);
});
