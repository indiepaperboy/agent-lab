(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let mode = 'step', running = false, timer = null, version = 0;
  let loop = new LabAgent.AgentLoop(LabAgent.rehearsalDecide, LabAgent.goal, LabAgent.buildRequest);
  const hints = { goal: 'Give the agent its job and matching rules.', ask: 'See the input prepared for the language model.', decide: 'Choose the next action using the available evidence.', tool: 'Reveal the tool name and its arguments.', observe: 'Execute the tool and return its result.', answer: 'Connect the evidence into a final answer.' };
  const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  function openFile(name) {
    const input=LabTools.snapshot().inputs,key=name==='consumption.csv'?'consumption':'references';
    $('file-title').textContent=key==='consumption'?'Consumption workbook':'Reference register';
    const table=element('table'),head=element('tr'),body=element('tbody');
    LabTools.columns[key].forEach(col=>head.append(element('th','',col)));
    const thead=element('thead');thead.append(head);
    input[key].forEach(row=>{const tr=element('tr');LabTools.columns[key].forEach(col=>tr.append(element('td','',String(row[col]))));body.append(tr);});
    table.append(thead,body);$('file-content').replaceChildren(table);$('file-dialog').showModal();
  }
  for (const [name] of Object.entries(AgentData)) {
    const row = element('button', 'file-row'); row.dataset.file = name;
    row.append(element('span', 'file-icon', '▤'), element('span', '', name==='consumption.csv'?'Consumption workbook':'Reference register'), element('small', '', 'EXAMPLE'));
    row.onclick = () => openFile(name); $('files').append(row);
  }
  for (const [name, description] of Object.entries(LabTools.definitions)) { const label = element('span', '', `${name}()`); label.title = description; $('tool-list').append(label); }
  $('file-close').onclick = () => $('file-dialog').close();
  $('about-close').onclick = () => $('about-dialog').close();
  $('about-open').onclick = () => $('about-dialog').showModal();
  function setStatus(text) { $('status').textContent = text; }
  function pause() { running = false; clearTimeout(timer); timer = null; updateControls(); }
  function updateControls() {
    $('step-mode').setAttribute('aria-pressed', String(mode === 'step'));
    $('auto-mode').setAttribute('aria-pressed', String(mode === 'auto'));
    $('next').disabled = loop.done || (loop.busy && !running);
    $('next').textContent = running ? 'Pause Ⅱ' : loop.busy ? 'Choosing…' : loop.done ? 'Run complete ✓' : mode === 'auto' ? 'Run auto →' : loop.phase === 'observe' ? 'Execute tool →' : 'Next step →';
    $('next-label').textContent = loop.done ? 'JOB COMPLETE' : `UP NEXT · ${{goal:'YOUR GOAL',ask:'PREPARE MODEL INPUT',decide:'CHOOSE AN ACTION',tool:'SHOW TOOL REQUEST',observe:'RUN THE TOOL',answer:'SHOW THE ANSWER'}[loop.phase]}`;
    $('next-hint').textContent = loop.done ? 'Restart to explore the loop again.' : hints[loop.phase];
    $('event-count').textContent = `${String(loop.events.length).padStart(2, '0')} EVENTS`;
    $('mode-disclosure').textContent = 'SIMULATED WALKTHROUGH · Scripted LLM choices, example spreadsheets and real matching results. No live AI or uploads.';
  }
  function sourceButton(name) { const button = element('button', '', name); button.onclick = () => openFile(name); return button; }
  function renderData(container, data) {
    if (Array.isArray(data) && data.length && typeof data[0] === 'object' && !('text' in data[0])) {
      const wrap = element('div', 'event-table-wrap'), table = element('table'), head = element('thead'), body = element('tbody'), headers = Object.keys(data[0]), tr = element('tr');
      for (const key of headers) tr.append(element('th', '', key)); head.append(tr);
      for (const row of data) { const tr = element('tr', row.status === 'exception' ? 'anomaly' : ''); for (const key of headers) tr.append(element('td', '', String(row[key] ?? ''))); body.append(tr); }
      table.append(head, body); wrap.append(table); container.append(wrap);
    } else if (data?.text) container.append(element('pre', '', data.text));
    else container.append(element('pre', '', JSON.stringify(data, null, 2)));
  }
  function renderEvent(event, current) {
    const card = element('article', `event${current ? ' current' : ''}`);
    if (current) card.setAttribute('aria-current', 'step');
    const head = element('div', 'event-top');
    const owners = { ASK: 'EXAMPLE MODEL INPUT', GOAL: 'YOU → JOB', DECIDE: 'SIMULATED LLM', TOOL: 'REQUEST · NOT EXECUTED', OBSERVE: 'BROWSER → AGENT', ANSWER: 'EVIDENCE → CONCLUSION' };
    head.append(element('span', 'event-id', String(event.id).padStart(2, '0')), element('span', '', event.stage), element('span', 'event-kind', owners[event.stage])); card.append(head);
    if (current) {
      const lesson = LabTutorial.explain(event);
      const panel = element('section', 'step-lesson');
      panel.setAttribute('aria-label', 'Step explanation');
      panel.append(element('p', 'lesson-who', lesson.who), element('h3', 'lesson-title', lesson.title));
      for (const [label, value] of [['WHAT IS HAPPENING', lesson.what], ['HOW IT WORKS', lesson.how], ['WHY THIS HELPS', lesson.why]]) {
        const block = element('div', 'lesson-block'); block.append(element('h4', '', label), element('p', '', value)); panel.append(block);
      }
      panel.append(element('p', 'lesson-next', lesson.next)); card.append(panel);
    }
    if ($('raw').checked) card.append(element('pre', '', JSON.stringify(event, null, 2)));
    else {
      card.append(element('h3', event.stage === 'TOOL' ? 'tool-name' : '', event.summary));
      if (event.stage === 'ASK') {
        const packet = element('details', 'request-details');
        packet.append(element('summary', '', 'Inspect the example request (no model called)'));
        packet.append(element('pre', '', JSON.stringify(event.data, null, 2))); card.append(packet);
      }
      if (event.stage === 'TOOL') card.append(element('pre', '', `${event.data.name}(${JSON.stringify(event.data.arguments, null, 2)})`));
      if (event.stage === 'OBSERVE') {
        if (!event.data.ok) card.append(element('pre', '', event.data.error));
        else renderData(card, event.data.data);
      }
      if (event.stage === 'ANSWER') card.append(element('pre', '', event.data.answer));
    }
    return card;
  }
  function renderConsole() {
    if (!loop.events.length) return;
    $('console').replaceChildren(...loop.events.map((event, i) => renderEvent(event, i === loop.events.length - 1)));
    const last = loop.events.at(-1);
    for (const stage of $('stages').querySelectorAll('[data-stage]')) {
      const active = stage.dataset.stage === last.stage;
      stage.classList.toggle('active', active);
      if (active) stage.setAttribute('aria-current', 'step'); else stage.removeAttribute('aria-current');
    }
    const current = $('console').lastElementChild;
    // Keep the current event's heading visible, including when its result is tall.
    $('console').scrollTop = current.offsetTop - $('console').offsetTop - 16;
  }
  function showError(message) {
    $('console').querySelector('.error-notice')?.remove();
    const notice = element('div', 'error-notice', message); notice.setAttribute('role', 'alert'); $('console').append(notice); $('console').scrollTop = $('console').scrollHeight;
    setStatus('Paused · needs attention');
  }
  async function advance() {
    if (loop.busy || loop.done) return;
    const activeLoop = loop, id = version;
    try {
      if (!loop.events.length) loop.goal = $('objective').value.trim() || LabAgent.goal;
      setStatus('Walking through the job');
      const promise = loop.next(); updateControls();
      const event = await promise;
      if (id !== version || !event) return;
      renderConsole(); renderReport();
      if (event.stage === 'OBSERVE' && event.args.file && event.data.ok) {
        for (const row of $('files').children) if (row.dataset.file === event.args.file) row.classList.add('used');
      }
      $('announcement').textContent = `${event.stage}. ${event.summary}`;
      if (event.stage === 'ANSWER') {
        $('answer-text').textContent = event.data.answer;
        $('answer-sources').replaceChildren(...event.data.sources.map(sourceButton));
        $('answer').hidden = false; pause(); setStatus(LabTools.snapshot().report?.rows.some(r=>r.status==='exception') ? 'Completed with exceptions' : 'Reconciliation complete'); renderReport();
      } else setStatus(running ? 'Auto · processing' : 'Paused · your move');
    } catch (error) { if (id === version) { pause(); showError(error?.message || String(error) || 'The operation failed. Please retry.'); } }
    finally {
      if (id === version) {
        updateControls();
        if (running && !activeLoop.done) timer = setTimeout(advance, 8000);
      }
    }
  }
  $('next').onclick = () => {
    if (running) { pause(); setStatus(loop.busy ? 'Finishing current decision…' : 'Paused · your move'); }
    else if (mode === 'auto') { running = true; advance(); updateControls(); }
    else advance();
  };
  $('step-mode').onclick = () => { pause(); mode = 'step'; updateControls(); if (loop.events.length && !loop.done) setStatus('Paused · your move'); };
  $('auto-mode').onclick = () => { mode = 'auto'; updateControls(); };
  $('raw').onchange = renderConsole;
  const empty = $('console').firstElementChild.cloneNode(true);
  function restart() {
    pause(); version++; LabTools.reset();
    loop = new LabAgent.AgentLoop(LabAgent.rehearsalDecide, LabAgent.goal, LabAgent.buildRequest);
    $('console').replaceChildren(empty.cloneNode(true)); $('answer').hidden = true; $('announcement').textContent = '';
    for (const stage of $('stages').querySelectorAll('[data-stage]')) { stage.classList.remove('active'); stage.removeAttribute('aria-current'); }
    for (const row of $('files').children) row.classList.remove('used');
    setStatus('Ready to reconcile'); updateControls(); renderReport();
  }
  $('restart').onclick = restart;
  function renderReport() {
    const {inputs,report}=LabTools.snapshot();
    const totals = [['Input cost',inputs.consumption.reduce((n,r)=>n+r.cost_cents,0)],['Allocated',report?.allocated_cents],['Unresolved',report?.unresolved_cents]];
    $('control-totals').replaceChildren(...totals.map(([label,cost])=>{const box=element('div','total-box');box.append(element('span','field-label',label),element('strong','',cost===undefined?'—':LabTools.money(cost)));return box;}));
    $('control-note').textContent=report?`Input = allocated + unresolved. Difference: ${LabTools.money(report.input_cents-report.allocated_cents-report.unresolved_cents)}. Candidates and review notes never change allocations.`:'Run reconcile_inventory to match references. No costs have been allocated yet.';
    const exceptions=report?.rows.filter(r=>r.status==='exception')||[];
    $('job-status').textContent=!report?'NOT RUN':loop.done?(exceptions.length?'COMPLETED WITH EXCEPTIONS':'COMPLETED'):`PROCESSING · ${exceptions.length} EXCEPTIONS`;
    $('export-all').disabled=$('export-exceptions').disabled=!report;
    const table=element('table'),thead=element('thead'),head=element('tr'),body=element('tbody');
    ['Row / item','Reference','Line cost','Status / cost centre','Exception & review evidence'].forEach(t=>head.append(element('th','',t)));thead.append(head);
    const all=report?.rows||inputs.consumption.map(r=>({...r,status:'not_run'}));
    const selected=all.filter(r=>$('row-filter').value==='all'||r.status===$('row-filter').value);
    for(const r of selected){
      const tr=element('tr',r.status);const identity=element('td');identity.append(element('strong','',r.row_id),element('small','',`${r.item} · input row ${r.source_row}`));
      const state=element('td');state.append(element('span','row-status',r.status==='not_run'?'Not run':r.status==='allocated'?'Allocated':'Exception'),element('small','',r.cost_centre||'—'));
      const notes=element('td');notes.append(element('span','',r.reason||r.description));
      if(r.review_note) notes.append(element('p','review-note',r.review_note));
      if(r.candidate_rows?.length){const candidates=r.candidate_rows.map(n=>{const c=inputs.references.find(ref=>ref.source_row===n);return `Register row ${n}: ${c.reference} → ${c.cost_centre||'no cost centre'}`;});notes.append(element('small','candidate-note',`Unapproved candidates: ${candidates.join('; ')}`));}
      tr.append(identity,element('td','',r.reference||'(blank)'),element('td','amount',LabTools.money(r.cost_cents)),state,notes);body.append(tr);
    }
    if(!selected.length){const row=element('tr'),cell=element('td','','No rows in this view.');cell.colSpan=5;row.append(cell);body.append(row);}
    table.append(thead,body);$('report-table').replaceChildren(table);
  }
  $('row-filter').onchange=renderReport;
  function downloadReport(exceptionsOnly){const report=LabTools.snapshot().report;if(!report)return;const rows=report.rows.filter(r=>!exceptionsOnly||r.status==='exception');const url=URL.createObjectURL(new Blob(['\uFEFF'+LabExport.csv(rows)],{type:'text/csv;charset=utf-8'}));const a=element('a');a.href=url;a.download=exceptionsOnly?'inventory-exceptions.csv':'inventory-reconciliation.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  $('export-all').onclick=()=>downloadReport(false);$('export-exceptions').onclick=()=>downloadReport(true);
  renderReport();
  updateControls();
})();
