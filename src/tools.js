(() => {
  'use strict';
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function file(name) {
    if (!has(AgentData, name)) throw new Error(`Unknown file: ${name}`);
    return AgentData[name];
  }
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
  // A small arithmetic parser: no eval, Function constructor or executable expressions.
  function calculate(expression) {
    if (typeof expression !== 'string' || expression.length > 200) throw new Error('Use an arithmetic expression up to 200 characters');
    const tokens = expression.match(/\d+(?:\.\d+)?|[()+*/-]/g) || [];
    if (!tokens.length || tokens.join('') !== expression.replace(/\s/g, '')) throw new Error('Only numbers, parentheses and + - * / are allowed');
    let pos = 0;
    function atom() {
      const t = tokens[pos++];
      if (t === '-') return -atom();
      if (t === '+') return atom();
      if (t === '(') { const n = sum(); if (tokens[pos++] !== ')') throw new Error('Missing closing parenthesis'); return n; }
      if (!/^\d/.test(t || '')) throw new Error('Expected a number');
      return Number(t);
    }
    function product() { let n = atom(); while (['*', '/'].includes(tokens[pos])) { const op = tokens[pos++], v = atom(); n = op === '*' ? n * v : n / v; } return n; }
    function sum() { let n = product(); while (['+', '-'].includes(tokens[pos])) { const op = tokens[pos++], v = product(); n = op === '+' ? n + v : n - v; } return n; }
    const result = sum();
    if (pos !== tokens.length || !Number.isFinite(result)) throw new Error('Invalid or non-finite calculation');
    return { expression, result: Math.round(result * 1e6) / 1e6 };
  }
  const definitions = {
    list_files: 'No arguments. Returns the available filenames and byte sizes.',
    read_file: '{file: string}. Returns the complete text of one bundled file.',
    search_files: '{query: string}. Case-insensitive literal search across files; returns filenames, line numbers and matching text.',
    query_csv: '{file: string, filters?: {column: exactValue}, groupBy?: column, aggregate?: {column: "avg"|"sum"|"min"|"max"|"count"}}. Without groupBy, returns filtered rows. With groupBy, returns grouped count plus aggregates. Column names come from the CSV header.',
    calculate: '{expression: string}. Numeric arithmetic using + - * / and parentheses.'
  };
  const runners = {
    list_files: () => Object.entries(AgentData).map(([name, text]) => ({ name, bytes: new TextEncoder().encode(text).length })),
    read_file: ({ file: name }) => ({ file: name, text: file(name) }),
    search_files: ({ query }) => {
      if (typeof query !== 'string' || !query.trim()) throw new Error('Search query must not be empty');
      return Object.entries(AgentData).flatMap(([name, text]) => text.split('\n').flatMap((line, i) => line.toLowerCase().includes(query.toLowerCase()) ? [{ file: name, line: i + 1, text: line }] : []));
    },
    query_csv: ({ file: name, filters = {}, groupBy, aggregate = {} }) => {
      if (typeof name !== 'string' || !name.endsWith('.csv')) throw new Error('Choose a CSV file');
      const rows = parseCSV(file(name));
      const columns = Object.keys(rows[0] || {});
      for (const c of [...Object.keys(filters), ...Object.keys(aggregate), ...(groupBy ? [groupBy] : [])]) {
        if (!columns.includes(c)) throw new Error(`Unknown column: ${c}. Available: ${columns.join(', ')}`);
      }
      const selected = rows.filter(r => Object.entries(filters).every(([k, v]) => r[k] === String(v)));
      if (!groupBy) {
        if (Object.keys(aggregate).length) throw new Error('aggregate requires groupBy');
        return selected;
      }
      const groups = new Map();
      for (const r of selected) { if (!groups.has(r[groupBy])) groups.set(r[groupBy], []); groups.get(r[groupBy]).push(r); }
      return [...groups].map(([key, group]) => {
        const out = { [groupBy]: key, count: group.length };
        for (const [col, op] of Object.entries(aggregate)) {
          if (!['avg', 'sum', 'min', 'max', 'count'].includes(op)) throw new Error(`Unknown aggregate: ${op}`);
          const nums = group.map(r => Number(r[col]));
          if (op !== 'count' && nums.some(n => !Number.isFinite(n))) throw new Error(`${col} is not numeric`);
          const v = op === 'count' ? group.length : op === 'avg' ? nums.reduce((a, b) => a + b, 0) / nums.length : op === 'sum' ? nums.reduce((a, b) => a + b, 0) : op === 'min' ? Math.min(...nums) : Math.max(...nums);
          out[`${op}_${col}`] = Math.round(v * 100) / 100;
        }
        return out;
      });
    },
    calculate: ({ expression }) => calculate(expression)
  };
  function execute(name, args = {}) {
    try {
      if (!has(runners, name)) throw new Error(`Unknown tool: ${name}`);
      if (!args || typeof args !== 'object' || Array.isArray(args)) throw new Error('Arguments must be an object');
      return { ok: true, data: runners[name](args) };
    } catch (error) { return { ok: false, error: error.message }; }
  }
  globalThis.LabTools = { execute, definitions, parseCSV };
})();
