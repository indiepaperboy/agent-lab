// Fictional, fixed snapshot for a repeatable lesson. No Fabric connection.
(() => {
  const sample={
    pipeline:{name:'Technician orders',cadence:'Hourly',snapshot:'13:00',nextRefresh:'14:00'},
    order:{id:'ORD-2048',technician:'Alex',item:'Replacement unit',quantity:2,held:1,maxHolding:3,deadline:'14:00',windowMinutes:60},
    warehouses:[{id:'near',name:'North warehouse',stock:0,driveMinutes:15,handlingMinutes:5},{id:'far',name:'Central warehouse',stock:12,driveMinutes:70,handlingMinutes:10}],
    peer:{id:'peer',name:'Sam · nearby technician',held:5,allocated:1,minHolding:2,driveMinutes:20,handlingMinutes:5}
  };
  globalThis.LabData={snapshot:()=>structuredClone(sample)};
})();
