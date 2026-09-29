(() => {
  'use strict';
  const goal = 'Why were customer orders delayed yesterday?';
  const date = '2026-09-28';
  const action = (summary, tool, args = {}) => ({ type: 'tool', summary, tool, args });
  // Rehearsal is intentionally authored. Every result still comes from a real tool.
  const rehearsal = [
    action('Discover the available evidence.', 'list_files'),
    action('Check which orders were delayed on 28 September.', 'query_csv', { file: 'orders.csv', filters: { date }, groupBy: 'status' }),
    action('Compare delivery delays across warehouses.', 'query_csv', { file: 'deliveries.csv', filters: { date }, groupBy: 'warehouse', aggregate: { delay_minutes: 'avg' } }),
    action('Match warehouse identifiers to their locations.', 'read_file', { file: 'warehouses.csv' }),
    action('Check weather as an alternative explanation.', 'read_file', { file: 'weather.txt' }),
    action('No weather disruption is reported. Search the affected site’s records.', 'search_files', { query: 'WH-04' }),
    action('Inspect the operational timeline at the affected site.', 'read_file', { file: 'system-log.txt' }),
    action('Verify the incident and its link to delayed orders.', 'read_file', { file: 'incident-notes.txt' }),
    action('Calculate the outage duration from 09:17 to 12:42.', 'calculate', { expression: '(12 * 60 + 42) - (9 * 60 + 17)' })
  ];
  function rehearsalAnswer(history) {
    const get = name => history.find(h => h.action.args.file === name)?.result.data;
    const delays = get('deliveries.csv'), orders = get('orders.csv');
    const minutes = history.find(h => h.action.tool === 'calculate')?.result.data?.result;
    if (!delays || !orders || !Number.isFinite(minutes)) throw new Error('Required evidence is missing. Restart the investigation.');
    const nc = delays.find(r => r.warehouse === 'WH-04');
    return { type: 'answer', summary: 'Investigation complete. The evidence points to a warehouse outage.', answer: `A conveyor controller power-supply failure at Newcastle (WH-04) held up picking and dispatch on 28 September 2026. The outage lasted ${minutes} minutes (3h 25m), from 09:17 to 12:42. The ${orders.find(r => r.status === 'delayed').count} delayed orders in this fictional sample all came from Newcastle, where the average delivery delay was ${nc.avg_delay_minutes} minutes. Sydney averaged ${delays.find(r => r.warehouse === 'WH-01').avg_delay_minutes} minutes and Melbourne ${delays.find(r => r.warehouse === 'WH-02').avg_delay_minutes} minutes. Incident INC-042 explicitly links the four orders to the picking queue; the system log corroborates the outage. No severe weather or carrier-side incident was reported. Stock a spare power supply and test manual picking, as recommended in the incident note.`, sources: ['orders.csv', 'deliveries.csv', 'warehouses.csv', 'system-log.txt', 'incident-notes.txt', 'weather.txt'] };
  }
  function validateAction(value) {
    if (!value || typeof value !== 'object') throw new Error('The model did not return an action');
    if (!['tool', 'answer'].includes(value.type) || typeof value.summary !== 'string' || value.summary.length > 350) throw new Error('Expected a tool or answer with a concise action summary');
    if (value.type === 'tool' && (!Object.hasOwn(LabTools.definitions, value.tool) || !value.args || typeof value.args !== 'object' || Array.isArray(value.args))) throw new Error('Invalid tool or arguments');
    if (value.type === 'answer' && (typeof value.answer !== 'string' || !value.answer.trim() || !Array.isArray(value.sources) || value.sources.some(f => !Object.hasOwn(AgentData, f)))) throw new Error('The answer needs text and valid source filenames');
    return value;
  }
  class AgentLoop {
    constructor(decide, objective = goal, buildRequest = (history, objective) => ({ objective, tools: LabTools.definitions, observations: history })) { this.buildRequest = buildRequest; this.request = null; this.decide = decide; this.goal = objective; this.events = []; this.history = []; this.phase = 'goal'; this.busy = false; this.done = false; this.pending = null; }
    async next() {
      if (this.busy || this.done) return null;
      this.busy = true;
      try {
        let event;
        if (this.phase === 'goal') {
          event = { stage: 'GOAL', summary: this.goal, data: { objective: this.goal, caseDate: date } }; this.phase = 'ask';
        } else if (this.phase === 'ask') {
          this.request = structuredClone(this.buildRequest(this.history, this.goal));
          event = { stage: 'ASK', summary: 'The app prepares the next model request.', data: this.request, observations: this.history.length };
          this.phase = 'decide';
        } else if (this.phase === 'decide') {
          if (this.history.length >= 20) throw new Error('Reached the 20-tool limit. Review the evidence or restart.');
          this.pending = validateAction(await this.decide(this.history, this.goal, this.request));
          event = { stage: 'DECIDE', summary: this.pending.summary, data: this.pending };
          this.phase = this.pending.type === 'answer' ? 'answer' : 'tool';
        } else if (this.phase === 'tool') {
          event = { stage: 'TOOL', summary: this.pending.tool, data: { name: this.pending.tool, arguments: this.pending.args } }; this.phase = 'observe';
        } else if (this.phase === 'observe') {
          const result = LabTools.execute(this.pending.tool, this.pending.args);
          this.history.push({ action: this.pending, result });
          event = { stage: 'OBSERVE', summary: result.ok ? `Result from ${this.pending.tool}` : `Tool error: ${this.pending.tool}`, data: result, tool: this.pending.tool, args: this.pending.args };
          this.phase = 'ask';
        } else {
          event = { stage: 'ANSWER', summary: this.pending.summary, data: this.pending }; this.done = true;
        }
        event.id = this.events.length + 1;
        this.events.push(event);
        return event;
      } finally { this.busy = false; }
    }
  }
  globalThis.LabAgent = { AgentLoop, goal, date, validateAction, rehearsal, rehearsalDecide: async history => history.length < rehearsal.length ? rehearsal[history.length] : rehearsalAnswer(history) };
})();
