(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let mode = 'step', running = false, timer = null, version = 0, loading = false;
  let loop = new LabAgent.AgentLoop(LabAgent.rehearsalDecide);
  const hints = { goal: 'Give the investigator its objective.', decide: 'Choose the next action using the available evidence.', tool: 'Reveal the tool name and its arguments.', observe: 'Execute the tool and return its result.', answer: 'Connect the evidence into a final answer.' };
  const element = (tag, className, text) => { const el = document.createElement(tag); if (className) el.className = className; if (text !== undefined) el.textContent = text; return el; };
  function openFile(name) { $('file-title').textContent = name; $('file-content').textContent = AgentData[name]; $('file-dialog').showModal(); }
  for (const [name] of Object.entries(AgentData)) {
    const row = element('button', 'file-row'); row.dataset.file = name;
    row.append(element('span', 'file-icon', '▤'), element('span', '', name), element('small', '', name.endsWith('.csv') ? 'CSV' : 'TXT'));
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
    $('next').disabled = loop.done || loading || (loop.busy && !running) || ($('engine').value === 'live' && !LabLive.ready);
    $('next').textContent = running ? 'Pause Ⅱ' : loop.busy ? 'Choosing…' : loop.done ? 'Case closed ✓' : mode === 'auto' ? 'Run auto →' : loop.phase === 'observe' ? 'Execute tool →' : 'Next step →';
    $('next-label').textContent = loop.done ? 'INVESTIGATION COMPLETE' : `UP NEXT · ${loop.phase.toUpperCase()}`;
    $('next-hint').textContent = loop.done ? 'Restart to explore the loop again.' : hints[loop.phase];
    $('event-count').textContent = `${String(loop.events.length).padStart(2, '0')} EVENTS`;
    $('objective').readOnly = $('engine').value === 'rehearsal' || loop.events.length > 0 || loop.busy;
    $('load-model').disabled = loading || LabLive.ready;
  }
  function sourceButton(name) { const button = element('button', '', name); button.onclick = () => openFile(name); return button; }
  function renderData(container, data) {
    if (Array.isArray(data) && data.length && typeof data[0] === 'object' && !('text' in data[0])) {
      const wrap = element('div', 'event-table-wrap'), table = element('table'), head = element('thead'), body = element('tbody'), headers = Object.keys(data[0]), tr = element('tr');
      for (const key of headers) tr.append(element('th', '', key)); head.append(tr);
      for (const row of data) { const tr = element('tr', Number(row.avg_delay_minutes) > 30 ? 'anomaly' : ''); for (const key of headers) tr.append(element('td', '', String(row[key] ?? ''))); body.append(tr); }
      table.append(head, body); wrap.append(table); container.append(wrap);
    } else if (data?.text) container.append(element('pre', '', data.text));
    else container.append(element('pre', '', JSON.stringify(data, null, 2)));
  }
  function renderEvent(event, current) {
    const card = element('article', `event${current ? ' current' : ''}`);
    if (current) card.setAttribute('aria-current', 'step');
    const head = element('div', 'event-top');
    const owners = { GOAL: 'YOU → INVESTIGATOR', DECIDE: $('engine').value === 'rehearsal' ? 'AUTHORED ACTION' : 'LOCAL MODEL', TOOL: 'REQUEST · NOT EXECUTED', OBSERVE: 'BROWSER → INVESTIGATOR', ANSWER: 'EVIDENCE → CONCLUSION' };
    head.append(element('span', 'event-id', String(event.id).padStart(2, '0')), element('span', '', event.stage), element('span', 'event-kind', owners[event.stage])); card.append(head);
    if ($('raw').checked) card.append(element('pre', '', JSON.stringify(event, null, 2)));
    else {
      card.append(element('h3', event.stage === 'TOOL' ? 'tool-name' : '', event.summary));
      if (event.stage === 'TOOL') card.append(element('pre', '', `${event.data.name}(${JSON.stringify(event.data.arguments, null, 2)})`));
      if (event.stage === 'OBSERVE') {
        if (!event.data.ok) card.append(element('pre', '', event.data.error));
        else if (event.tool === 'list_files') { const files = element('div', 'result-files'); for (const file of event.data.data) files.append(sourceButton(file.name)); card.append(files); }
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
      const active = stage.dataset.stage === last.stage && (last.stage !== 'DECIDE' || stage.dataset.position === (loop.history.length ? 'repeat' : 'first'));
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
      setStatus(loop.phase === 'decide' && $('engine').value === 'live' ? 'Local model choosing…' : 'Investigating');
      const promise = loop.next(); updateControls();
      const event = await promise;
      if (id !== version || !event) return;
      renderConsole();
      if (event.stage === 'OBSERVE' && event.args.file && event.data.ok) {
        for (const row of $('files').children) if (row.dataset.file === event.args.file) row.classList.add('used');
      }
      $('announcement').textContent = `${event.stage}. ${event.summary}`;
      if (event.stage === 'ANSWER') {
        $('answer-text').textContent = event.data.answer;
        $('answer-sources').replaceChildren(...event.data.sources.map(sourceButton));
        $('answer').hidden = false; pause(); setStatus('Investigation complete');
      } else setStatus(running ? 'Auto · investigating' : 'Paused · your move');
    } catch (error) { if (id === version) { pause(); showError(error?.message || String(error) || 'The operation failed. Please retry.'); } }
    finally {
      if (id === version) {
        updateControls();
        if (running && !activeLoop.done) timer = setTimeout(advance, 1600);
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
    pause(); version++;
    if (loop.busy || loading) { LabLive.stop(); loading = false; $('load-model').hidden = $('engine').value !== 'live'; $('model-progress').hidden = true; }
    loop = new LabAgent.AgentLoop($('engine').value === 'live' ? LabLive.decide : LabAgent.rehearsalDecide);
    $('console').replaceChildren(empty.cloneNode(true)); $('answer').hidden = true; $('announcement').textContent = '';
    for (const stage of $('stages').querySelectorAll('[data-stage]')) { stage.classList.remove('active'); stage.removeAttribute('aria-current'); }
    for (const row of $('files').children) row.classList.remove('used');
    setStatus('Ready to investigate'); updateControls();
  }
  $('restart').onclick = restart;
  $('engine').onchange = () => {
    loading = false; LabLive.stop();
    const live = $('engine').value === 'live';
    $('objective').value = LabAgent.goal;
    $('load-model').hidden = !live; $('model-progress').hidden = true;
    $('engine-note').textContent = live ? 'Real model, on your GPU. Initial download is several GB; allow a few minutes. No API key.' : 'Authored decisions, real tools. No model or downloads.';
    restart();
  };
  $('load-model').onclick = async () => {
    loading = true; $('model-progress').hidden = false; $('model-progress').textContent = 'Preparing local model…'; updateControls();
    const id = version;
    try {
      await LabLive.load(text => { if (id === version) $('model-progress').textContent = text; });
      if (id !== version) return;
      $('model-progress').textContent = 'Local model ready. Your investigation stays in this browser.';
      $('load-model').hidden = true; setStatus('Local model ready');
    } catch (error) { if (id === version) { $('model-progress').textContent = error?.message || String(error) || 'Model loading failed. Please retry.'; showError(error?.message || String(error) || 'The operation failed. Please retry.'); } }
    finally { if (id === version) { loading = false; updateControls(); } }
  };
  updateControls();
})();
