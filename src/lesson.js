(() => {
 const steps=[
  ['job','The hourly refresh brings in an order','In this example, a completed Fabric pipeline triggers the agent’s job. Nobody needs to start a chat.'],
  ['agent','First, check the holding limit','The agent receives the order, rules and tools. Its first choice is to check whether Alex can receive two more units.'],
  ['tool','Code checks the numbers','The application runs the holding check. Rules and arithmetic are handled by code, not guessed by the LLM.'],
  ['result','The order is within the limit','This result lets the agent move on to finding stock. A failed check would instead need an exception review.'],
  ['agent','Try the nearest warehouse first','The agent requests warehouse stock and travel estimates. Nearer is useful only if the stock and deadline also work.'],
  ['tool','The tool compares the warehouses','Code checks available stock and adds driving plus collection time, then compares that with the delivery SLA.'],
  ['result','Neither warehouse works','The nearest has no stock. The other would miss the deadline. These results give the agent a reason to try another source.'],
  ['agent','Could another technician help?','The agent chooses a new tool: look for a nearby technician’s spare stock without taking allocated units or their minimum reserve.'],
  ['tool','Check Sam’s spare stock and journey','Code subtracts allocated stock and the protected reserve, then checks transfer time against the same SLA.'],
  ['result','Sam is a feasible option','There is enough transferable stock and enough time. The agent now has evidence for a recommendation.'],
  ['agent','Recommend the transfer for approval','The agent brings the checks together: Alex’s limit, Sam’s spare stock and the delivery time. It proposes a transfer; it does not dispatch it.'],
  ['result','A recommendation with a clear next step','The hourly snapshot may be stale. Before approval, recheck current stock and travel time, then reserve the units. This lesson stops at the recommendation.']
 ];
 class Lesson{
  constructor(){this.data=LabData.snapshot();this.index=-1;this.events=[];this.results={};}
  next(){if(this.done)return null;const index=++this.index;let request=null,result=null;
   const tool={2:'check_holdings',5:'check_warehouses',8:'check_nearby_technician'}[index];
   if(tool){request={tool,order:this.data.order.id};result=LabTools.execute(tool,this.data);this.results[tool]=result;}
   const [actor,title,caption]=steps[index],o=this.data.order;let evidence='';
   if(index===0)evidence=`13:00 · Fabric refresh complete\n${o.id} · Alex requests ${o.quantity} additional units\nDelivery deadline: ${o.deadline}`;
   if(index===1)evidence='Goal: fulfil the order before 14:00\nRules: respect holding limits and protected stock\nRequest → Check Alex’s holdings';
   if(index===2)evidence='check_holdings(ORD-2048)';
   if(index===3){const r=this.results.check_holdings;evidence=`${r.held} held + ${r.requested} requested = ${r.projected}\nMaximum holding: ${r.max} · ${r.allowed?'PASS':'EXCEPTION'}`;}
   if(index===4)evidence='Request → Check warehouse stock and delivery time';
   if(index===5)evidence='check_warehouses(ORD-2048)';
   if(index===6)evidence=this.results.check_warehouses.map(r=>`${r.name}: ${r.available} available · ${r.totalMinutes} min total\n${!r.enough?'Not enough stock':!r.onTime?`${-r.spareMinutes} min beyond the SLA`:'Feasible'}`).join('\n\n');
   if(index===7)evidence='Request → Check nearby technicians’ transferable stock';
   if(index===8)evidence='check_nearby_technician(ORD-2048)';
   if(index===9){const r=this.results.check_nearby_technician;evidence=`${r.held} held − ${r.allocated} allocated − ${r.minHolding} reserve = ${r.available} transferable\n${r.driveMinutes} min driving + ${r.handlingMinutes} min handover = ${r.totalMinutes} min\n${r.spareMinutes} min before the deadline`;}
   if(index>=10){const r=this.results.check_nearby_technician,h=this.results.check_holdings;const feasible=h.allowed&&r.eligible;evidence=feasible?`PROPOSED · Transfer ${o.quantity} units from Sam to Alex\nEstimated handover: 13:25 · Deadline: 14:00\nAwaiting approval and fresh availability check`:'EXCEPTION · No verified feasible transfer. Human review needed.';}
   const event={index,actor,title,caption,evidence,request,result};this.events.push(event);return event;
  }
  get done(){return this.index===steps.length-1;}
 }
 globalThis.LabLesson={Lesson,total:steps.length};
})();
