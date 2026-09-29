(() => {
  'use strict';
  function csv(rows) {
    const headers = ['row_id','item','description','quantity','inventory_cost','currency','reference','status','cost_centre','reason','review_note','candidate_rows','source_row'];
    const cell = value => {
      let s=Array.isArray(value)?value.join('; '):String(value??'');
      if (/^[\s]*[=+@-]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s="'"+s;
      return '"'+s.replaceAll('"','""')+'"';
    };
    return [headers,...rows.map(r=>headers.map(h=>r[h]))].map(row=>row.map(cell).join(',')).join('\r\n');
  }
  globalThis.LabExport={csv};
})();
