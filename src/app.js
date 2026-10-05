(() => {
  const $=id=>document.getElementById(id),el=(tag,cls,text)=>{const e=document.createElement(tag);e.className=cls||'';if(text!==undefined)e.textContent=text;return e;};
  let lesson=new LabLesson.Lesson(),timer=null,auto=false;
  function stop(){clearTimeout(timer);auto=false;$('auto').textContent='Auto';$('auto').setAttribute('aria-pressed','false');}
  function render(){
    const e=lesson.events.at(-1);$('scene').replaceChildren();
    $('scene').append(el('p','eyebrow',e?({job:'THE TRIGGER',agent:'THE AGENT · SIMULATED LLM',tool:'THE TOOL · APPLICATION CODE',result:'THE RESULT · BACK TO THE AGENT'}[e.actor]):'A SMALL EXAMPLE'));
    $('scene').append(el('h2','',e?.title||'Follow one unmatched inventory cost.'),el('p','caption',e?.caption||'See how a job becomes an action, how a tool returns evidence, and how the agent decides what to do with it.'));
    if(e)$('scene').append(el('div','evidence '+e.actor,e.evidence));
    document.querySelectorAll('[data-actor]').forEach(n=>{const active=n.dataset.actor===e?.actor;n.classList.toggle('active',active);if(active)n.setAttribute('aria-current','step');else n.removeAttribute('aria-current');});
    $('count').textContent=`${Math.max(0,lesson.index+1)} / ${LabLesson.total}`;
    $('next').disabled=lesson.done;$('next').textContent=lesson.done?'Lesson complete ✓':e?'Next step →':'Start walkthrough →';
    $('log').replaceChildren();
    lesson.events.forEach((event,i)=>{const row=el('article','log-event'+(event===e?' current':''));row.append(el('small','',`${String(i+1).padStart(2,'0')} · ${event.actor.toUpperCase()}`),el('p','',event.title));if($('raw').checked)row.append(el('pre','',JSON.stringify(event,null,2)));$('log').append(row);});
    const current=$('log').lastElementChild;if(current)$('log').scrollTop=current.offsetTop-$('log').offsetTop;
  }
  function advance(){lesson.next();if(lesson.done)stop();render();if(auto)timer=setTimeout(advance,6500);}
  $('next').onclick=()=>{stop();advance();};
  $('auto').onclick=()=>{if(auto){stop();return;}if(lesson.done)return;auto=true;$('auto').textContent='Pause';$('auto').setAttribute('aria-pressed','true');advance();};
  $('restart').onclick=()=>{stop();lesson=new LabLesson.Lesson();render();};$('raw').onchange=render;
  $('files').onclick=()=>{const {inputs}=LabTools.snapshot();$('sheet-data').replaceChildren();for(const [key,title]of [['consumption','Consumption'],['references','Reference register']]){const wrap=el('div','sheet-scroll'),table=el('table'),head=el('tr');LabTools.columns[key].forEach(c=>head.append(el('th','',c)));table.append(head);inputs[key].forEach(r=>{const row=el('tr');if(r.row_id==='C-006')row.className='focus-row';LabTools.columns[key].forEach(c=>row.append(el('td','',r[c])));table.append(row);});wrap.append(table);$('sheet-data').append(el('h3','',title),wrap);}$('sheets').showModal();};$('close').onclick=()=>$('sheets').close();render();
})();
