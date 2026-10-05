(() => {
  function holdings(order){const projected=order.held+order.quantity;return {held:order.held,requested:order.quantity,projected,max:order.maxHolding,allowed:projected<=order.maxHolding};}
  function route(source,order,available){const totalMinutes=source.driveMinutes+source.handlingMinutes,spareMinutes=order.windowMinutes-totalMinutes;return {...source,available,totalMinutes,spareMinutes,enough:available>=order.quantity,onTime:spareMinutes>=0,eligible:available>=order.quantity&&spareMinutes>=0};}
  function warehouses(data){return data.warehouses.map(w=>route(w,data.order,w.stock)).sort((a,b)=>a.driveMinutes-b.driveMinutes);}
  function peer(data){const p=data.peer,available=Math.max(0,p.held-p.allocated-p.minHolding);return {...route(p,data.order,available),remaining:p.held-data.order.quantity,unallocatedRemaining:p.held-p.allocated-data.order.quantity};}
  function execute(name,data){if(name==='check_holdings')return holdings(data.order);if(name==='check_warehouses')return warehouses(data);if(name==='check_nearby_technician')return peer(data);throw Error('Unknown tool');}
  globalThis.LabTools={holdings,warehouses,peer,execute};
})();
