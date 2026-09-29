(() => {
  'use strict';
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (!quoted && (c === ',' || c === '\n')) {
        row.push(cell.replace(/\r$/, '')); cell = '';
        if (c === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
      } else cell += c;
    }
    if (quoted) throw new Error('Unclosed CSV quote');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const headers = rows.shift();
    if (!headers?.length || new Set(headers).size !== headers.length) throw new Error('Invalid CSV headers');
    return rows.map(r => {
      if (r.length !== headers.length) throw new Error('Invalid CSV row');
      return Object.fromEntries(headers.map((h, i) => [h, r[i]]));
    });
  }
  const columns = {
    consumption: ['row_id','item','description','quantity','inventory_cost','reference','currency'],
    references: ['reference','description','cost_centre']
  };
  const reasons = { missing_reference: 'Consumption reference is blank', reference_not_found: 'Reference not found in the register', missing_cost_centre: 'Reference has no cost centre', ambiguous_reference: 'Reference has multiple register entries' };
  let inputs, report = null, searches = new Map();
  function cents(value) {
    const text = String(value).trim();
    if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error('inventory_cost must be a number with at most two decimal places');
    const negative = text.startsWith('-'), [whole, decimals = ''] = text.replace('-', '').split('.');
    const amount = Number(whole) * 100 + Number(decimals.padEnd(2, '0'));
    if (!Number.isSafeInteger(amount) || amount > 1e11) throw new Error('inventory_cost is outside the supported range');
    return negative ? -amount : amount;
  }
  const money = (amount, currency = inputs?.currency || 'AUD') => `${currency} ${(amount/100).toLocaleString('en-AU', {minimumFractionDigits:2,maximumFractionDigits:2})}`;
  function validate(kind, rows) {
    const limit = kind === 'consumption' ? 50 : 200;
    if (!Array.isArray(rows) || !rows.length || rows.length > limit) throw new Error(`${kind}: provide 1–${limit} data rows`);
    const seen = new Set();
    return rows.map((source, i) => {
      for (const key of columns[kind]) if (!Object.hasOwn(source,key)) throw new Error(`${kind}: missing column ${key}`);
      const row = {};
      for (const key of columns[kind]) {
        const value = source[key] ?? '';
        if (!['string','number'].includes(typeof value)) throw new Error(`${kind} row ${i+2}: invalid ${key}`);
        if (['row_id','reference','cost_centre'].includes(key) && typeof value !== 'string') throw new Error(`${kind} row ${i+2}: ${key} must be stored as text to preserve identifiers`);
        row[key] = String(value).trim();
        if (row[key].length > 300) throw new Error(`${kind} row ${i+2}: ${key} is too long`);
      }
      if (kind === 'consumption') {
        if (!row.row_id || seen.has(row.row_id)) throw new Error(`Consumption row ${i+2}: missing or duplicate row_id`);
        seen.add(row.row_id);
        if (!row.item || !row.description) throw new Error(`Consumption row ${i+2}: item and description are required`);
        if (!row.quantity || !Number.isFinite(Number(row.quantity))) throw new Error(`Consumption row ${i+2}: quantity must be numeric`);
        row.quantity = Number(row.quantity);
        row.cost_cents = cents(row.inventory_cost);
        if (!/^[A-Z]{3}$/.test(row.currency)) throw new Error(`Consumption row ${i+2}: currency must be a three-letter uppercase code`);
      } else if (!row.reference) throw new Error(`Reference register row ${i+2}: reference is required`);
      row.source_row = Number.isInteger(source.__source_row) ? source.__source_row : i+2;
      return row;
    });
  }
  function load(consumption, references, sources = {consumption:'Sample consumption.xlsx',references:'Sample reference-register.xlsx'}) {
    const c = validate('consumption', consumption), r = validate('references', references);
    if (new Set(c.map(row => row.currency)).size !== 1) throw new Error('Use one currency per job. Mixed currencies cannot be added without an explicit conversion policy.');
    // Replace the active dataset only after both inputs pass validation.
    inputs = { consumption: c, references: r, currency:c[0].currency, sources: structuredClone(sources) };
    reset(); return snapshot();
  }
  function reset() { report = null; searches = new Map(); }
  function useSample() { return load(parseCSV(AgentData['consumption.csv']), parseCSV(AgentData['reference-register.csv'])); }
  function snapshot() { return structuredClone({inputs, report}); }
  function requireReport() { if (!report) throw new Error('Call reconcile_inventory first'); return report; }
  function findException(row_id) {
    const row = requireReport().rows.find(row => row.row_id === row_id);
    if (!row || row.status !== 'exception') throw new Error('Choose an unresolved row_id from the reconciliation result');
    return row;
  }
  function summary() {
    const r = requireReport();
    return { currency:inputs.currency, input_cost:money(r.input_cents), allocated_cost:money(r.allocated_cents), unresolved_cost:money(r.unresolved_cents), difference:money(r.input_cents-r.allocated_cents-r.unresolved_cents), allocated_rows:r.rows.filter(x=>x.status==='allocated').length, exception_rows:r.rows.filter(x=>x.status==='exception').length, reviewed_exceptions:r.rows.filter(x=>x.review_note).length };
  }
  const definitions = {
    inspect_inputs: '{}. Inspect the two active workbook schemas, row counts and source names. Does not allocate costs.',
    reconcile_inventory: '{}. Code performs exact case-sensitive reference matching after trimming outer spaces. Only a single match with a nonblank cost_centre is allocated. Returns totals and every exception. Does not change source files.',
    get_exception: '{row_id:string}. Read one unresolved consumption row and its review status.',
    search_references: '{row_id:string,query:string}. Search register reference and description for ALL query words, case-insensitive. Returns candidate source_row values and records that evidence for this exception. Candidates are not allocations.',
    record_review: '{row_id:string,note:string,candidate_rows?:number[]}. Record a review note, with candidate rows from a previous search for this same exception. It NEVER assigns a cost centre or removes an exception. All suggestions require human review.',
    get_report: '{}. Return control totals, cost-centre allocations and exceptions with review notes. No ledger posting.'
  };
  const runners = {
    inspect_inputs: () => ({ sources: inputs.sources, columns, consumption_rows:inputs.consumption.length, reference_rows:inputs.references.length, currency:inputs.currency, cost_basis:'inventory_cost is the signed total consumption line cost, not a unit price' }),
    reconcile_inventory: () => {
      if (!report) {
        const rows = inputs.consumption.map(row => {
          const matches = inputs.references.filter(ref => ref.reference === row.reference);
          const reason = !row.reference ? 'missing_reference' : !matches.length ? 'reference_not_found' : matches.length > 1 ? 'ambiguous_reference' : !matches[0].cost_centre ? 'missing_cost_centre' : '';
          return {...row, status:reason ? 'exception' : 'allocated', reason:reasons[reason] || 'Unique exact reference match', reason_code:reason, cost_centre:reason ? '' : matches[0].cost_centre, register_rows:matches.map(x=>x.source_row), review_note:'', candidate_rows:[]};
        });
        const sum = list => list.reduce((n,r)=>n+r.cost_cents,0);
        report = {rows, input_cents:sum(rows), allocated_cents:sum(rows.filter(r=>r.status==='allocated')), unresolved_cents:sum(rows.filter(r=>r.status==='exception'))};
      }
      return {...summary(), exceptions:report.rows.filter(r=>r.status==='exception').map(r=>({row_id:r.row_id, reference:r.reference, description:r.description, inventory_cost:r.inventory_cost, reason:r.reason}))};
    },
    get_exception: ({row_id}) => structuredClone(findException(row_id)),
    search_references: ({row_id, query}) => {
      findException(row_id);
      if (typeof query !== 'string' || !query.trim() || query.length > 300) throw new Error('Provide a nonempty search query up to 300 characters');
      const words = query.toLowerCase().trim().split(/\s+/);
      const found = inputs.references.filter(r=>words.every(word=>`${r.reference} ${r.description}`.toLowerCase().includes(word)));
      if (!searches.has(row_id)) searches.set(row_id,new Set());
      found.forEach(r=>searches.get(row_id).add(r.source_row));
      return structuredClone(found);
    },
    record_review: ({row_id,note,candidate_rows=[]}) => {
      const row = findException(row_id);
      if (typeof note !== 'string' || !note.trim() || note.length>600) throw new Error('Provide a review note of 1–600 characters');
      if (!Array.isArray(candidate_rows) || candidate_rows.some(n=>!Number.isInteger(n) || !searches.get(row_id)?.has(n))) throw new Error('Candidate rows must come from a previous search for this exception');
      row.review_note = note.trim(); row.candidate_rows=[...new Set(candidate_rows)];
      return {row_id,status:'exception',review_note:row.review_note,candidate_rows:row.candidate_rows,allocation_changed:false,human_review_required:true};
    },
    get_report: () => {
      const r = requireReport(), costs = new Map();
      r.rows.filter(row=>row.status==='allocated').forEach(row=>costs.set(row.cost_centre,(costs.get(row.cost_centre)||0)+row.cost_cents));
      return {...summary(), by_cost_centre:[...costs].map(([cost_centre,c])=>({cost_centre,allocated_cost:money(c)})), exceptions:r.rows.filter(row=>row.status==='exception').map(({row_id,reason,review_note,candidate_rows})=>({row_id,reason,review_note,candidate_rows})), job_status:r.rows.some(row=>row.status==='exception')?'Completed with exceptions':'Completed'};
    }
  };
  function execute(name,args={}) {
    try {
      if (!Object.hasOwn(runners,name)) throw new Error(`Unknown tool: ${name}`);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object');
      return {ok:true,data:structuredClone(runners[name](args))};
    } catch(error) { return {ok:false,error:error.message}; }
  }
  useSample();
  globalThis.LabTools = { execute, definitions, parseCSV, load, useSample, reset, snapshot, columns, money, cents };
})();
