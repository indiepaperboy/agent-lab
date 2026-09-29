import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import '../src/data.js';
import '../src/tools.js';
import '../src/agent.js';
const { execute, parseCSV } = globalThis.LabTools;
const { AgentLoop, rehearsalDecide } = globalThis.LabAgent;
test('embedded files exactly match the auditable dataset', async () => {
  const dir = new URL('../data/', import.meta.url);
  assert.deepEqual(Object.keys(AgentData).sort(), (await readdir(dir)).sort());
  for (const [file, text] of Object.entries(AgentData)) assert.equal(text, await readFile(new URL(file, dir), 'utf8'));
});
test('tools calculate the warehouse anomaly from date-filtered rows', () => {
  const out = execute('query_csv', { file: 'deliveries.csv', filters: { date: '2026-09-28' }, groupBy: 'warehouse', aggregate: { delay_minutes: 'avg' } });
  assert.equal(out.ok, true);
  assert.deepEqual(out.data.map(row => row.avg_delay_minutes), [4.2, 7.1, 94.3]);
  assert.equal(execute('query_csv', { file: 'deliveries.csv', filters: { date: '2026-09-27' } }).data.length, 2);
  assert.equal(execute('query_csv', { file: 'deliveries.csv', filters: { date: 'missing' } }).data.length, 0);
});
test('file and search tools preserve evidence and line references', () => {
  assert.equal(execute('list_files').data.length, 7);
  const hits = execute('search_files', { query: 'wh-04' }).data;
  assert.ok(hits.some(h => h.file === 'system-log.txt' && h.text.includes('09:17')));
  for (const hit of hits) assert.equal(AgentData[hit.file].split('\n')[hit.line - 1], hit.text);
  assert.match(execute('read_file', { file: 'incident-notes.txt' }).data.text, /ORD-110/);
});
test('malformed requests return recoverable errors and cannot escape the tools', () => {
  for (const [tool, args] of [ ['toString', {}], ['__proto__', {}], ['read_file', {file:'../secrets'}], ['read_file', {file:'__proto__'}], ['query_csv', {file:'orders.csv',groupBy:'nope'}], ['query_csv', {file:'deliveries.csv',groupBy:'warehouse',aggregate:{delay_minutes:'eval'}}], ['calculate', {expression:'globalThis.process.exit()'}], ['calculate', {expression:'1/0'}], ['search_files', {query:''}] ]) assert.equal(execute(tool,args).ok,false);
});
test('arithmetic precedence and CSV quoting work without code execution', () => {
  assert.equal(execute('calculate', { expression: '(12 * 60 + 42) - (9 * 60 + 17)' }).data.result, 205);
  assert.equal(execute('calculate', { expression: '-2 + 3 * (4 + 1)' }).data.result, 13);
  assert.deepEqual(parseCSV('a,b\r\n"x,y","He said ""hi"""\r\n'), [{a:'x,y',b:'He said "hi"'}]);
});
test('step advances exactly one event; requests do not execute tools', async () => {
  const loop = new AgentLoop(rehearsalDecide);
  for (const stage of ['GOAL','DECIDE','TOOL']) {
    const before = loop.events.length;
    assert.equal((await loop.next()).stage, stage);
    assert.equal(loop.events.length, before+1);
    assert.equal(loop.history.length,0);
  }
  assert.equal((await loop.next()).stage,'OBSERVE');
  assert.equal(loop.history.length,1);
});
test('complete rehearsal is backed by tool outputs, terminates and restarts cleanly', async () => {
  const loop = new AgentLoop(rehearsalDecide);
  while (!loop.done) await loop.next();
  assert.equal(loop.events.length,30);
  assert.equal(loop.history.length,9);
  assert.ok(loop.history.every(h=>h.result.ok));
  assert.match(loop.events.at(-1).data.answer,/205 minutes/);
  assert.match(loop.events.at(-1).data.answer,/94.3 minutes/);
  assert.match(loop.events.at(-1).data.answer,/Newcastle/);
  assert.equal(await loop.next(),null);
  const fresh = new AgentLoop(rehearsalDecide);
  assert.equal(fresh.events.length,0); assert.equal((await fresh.next()).id,1);
});
test('async decision cannot advance twice and a failed decision can be retried', async () => {
  let resolve;
  const loop = new AgentLoop(()=>new Promise(r=>{resolve=r}));
  await loop.next(); const pending = loop.next();
  assert.equal(await loop.next(),null);
  resolve({type:'tool',summary:'List evidence',tool:'list_files',args:{}});
  assert.equal((await pending).stage,'DECIDE'); assert.equal(loop.events.length,2);
  let fails = true;
  const retry = new AgentLoop(async()=>{if(fails) throw new Error('offline'); return {type:'tool',summary:'List',tool:'list_files',args:{}};});
  await retry.next(); await assert.rejects(retry.next(),/offline/);
  assert.equal(retry.phase,'decide'); assert.equal(retry.busy,false);
  fails=false; assert.equal((await retry.next()).stage,'DECIDE');
});
test('a model receives previous observations and can recover from a tool error', async () => {
  const loop = new AgentLoop(async history => history.length === 0 ? {type:'tool',summary:'Read',tool:'read_file',args:{file:'missing.txt'}} : history[0].result.ok ? null : {type:'tool',summary:'Discover files',tool:'list_files',args:{}});
  for(let i=0;i<4;i++) await loop.next();
  assert.equal(loop.history[0].result.ok,false);
  await loop.next(); assert.equal(loop.pending.tool,'list_files');
});
