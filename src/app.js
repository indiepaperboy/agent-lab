(() => {
  const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
  let lesson=new LabLesson.Lesson(),timer=null,auto=false;
  function stop(){clearTimeout(timer);auto=false;$('auto').textContent='Auto';$('auto').setAttribute('aria-pressed','false');}
  function render(){
    const e=lesson.events.at(-1);$('scene').replaceChildren();
    $('scene').append(el('p','eyebrow',e?({job:'THE TRIGGER',agent:'THE AGENT · SIMULATED LLM',tool:'THE TOOL · APPLICATION CODE',result:'THE RESULT · BACK TO THE AGENT'}[e.actor]):'A SMALL EXAMPLE'));
    $('scene').append(el('h2','',e?.title||'Can this order arrive before the SLA?'),el('p','caption',e?.caption||'Follow Alex’s order from an hourly Fabric refresh to a recommended stock transfer.'));
    if(e)$('scene').append(el('div','evidence '+e.actor,e.evidence));
    document.querySelectorAll('[data-actor]').forEach(n=>{const active=n.dataset.actor===e?.actor;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});
    renderOptions();
    $('count').textContent=`${Math.max(0,lesson.index+1)} / ${LabLesson.total}`;
    $('next').disabled=lesson.done;$('next').textContent=lesson.done?'Lesson complete ✓':e?'Next step →':'Start walkthrough →';
    $('log').replaceChildren();
    lesson.events.forEach((event,i)=>{const row=el('article','log-event'+(event===e?' current':''));row.append(el('small','',`${String(i+1).padStart(2,'0')} · ${event.actor.toUpperCase()}`),el('p','',event.title));if($('raw').checked)row.append(el('pre','',JSON.stringify(event,null,2)));$('log').append(row);});
    const current=$('log').lastElementChild;if(current)$('log').scrollTop=current.offsetTop;
  }
  function advance(){lesson.next();if(lesson.done)stop();render();if(auto)timer=setTimeout(advance,6500);}
  $('next').onclick=()=>{stop();advance();};
  $('auto').onclick=()=>{if(auto){stop();return;}if(lesson.done)return;auto=true;$('auto').textContent='Pause';$('auto').setAttribute('aria-pressed','true');advance();};
  $('restart').onclick=()=>{stop();lesson=new LabLesson.Lesson();render();};$('raw').onchange=render;
  function renderOptions(){
    const wh=lesson.results.check_warehouses,peer=lesson.results.check_nearby_technician;
    $('options').replaceChildren();
    for(const [id,name,result]of [['near','North warehouse',wh?.find(r=>r.id==='near')],['far','Central warehouse',wh?.find(r=>r.id==='far')],['peer','Sam · technician',peer]]){
      const state=!result?'unchecked':result.eligible?'pass':'fail';
      const card=el('div','option '+state);card.append(el('strong','',name),el('span','',!result?'Not checked':!result.enough?'Insufficient stock':!result.onTime?'Misses SLA':'Feasible · approval needed'));
      if(result)card.append(el('small','',`${result.available} transferable · ${result.driveMinutes} min drive + ${result.handlingMinutes} min ${id==='peer'?'handover':'collection'}`));
      $('options').append(card);document.getElementById('route-'+id).setAttribute('class',state);
    }
  }
  $('files').onclick=()=>{const d=lesson.data;$('sheet-data').replaceChildren();
    for(const [title,rows]of [['Technician order',[d.order]],['Warehouse stock',d.warehouses],['Other technician holdings',[d.peer]]]){
      const wrap=el('div','sheet-scroll'),table=el('table'),head=el('tr'),keys=Object.keys(rows[0]);keys.forEach(k=>head.append(el('th','',k)));table.append(head);
      rows.forEach(r=>{const tr=el('tr');keys.forEach(k=>tr.append(el('td','',r[k])));table.append(tr);});wrap.append(table);$('sheet-data').append(el('h3','',title),wrap);
    }$('sheets').showModal();};$('close').onclick=()=>$('sheets').close();render();
})();
