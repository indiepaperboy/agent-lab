(() => {
  const steps = [
    ['job','A job arrives','A file arriving can start an agent. Nobody needs to open a chat.','Assign these inventory costs to the right cost centres.'],
    ['agent','Give it a goal, rules and tools','The application tells the LLM what to achieve, what it may do, and when to ask for help.','Goal: assign costs\nRule: never guess a cost centre\nTools: match references, search the register, flag for review'],
    ['agent','The agent chooses the first action','The LLM uses those instructions to request the matching tool. Choosing an action is its role.','Request → Match consumption references'],
    ['tool','The application runs the tool','Ordinary code looks up exact references and adds the costs. The LLM does not do this calculation.','Matching the two example spreadsheets…'],
    ['result','One row needs a closer look','The result goes back to the agent. We’ll follow this one exception through the next loop.','C-006 · Pump repair east\nCost: AUD 150.00\nReference: PUMP REPAIR EAST\nNo exact reference found'],
    ['agent','The agent chooses a different action','It uses “Pump repair east” from the failed row as a search query. The previous result tells it what to try next.','Request → Search register for “Pump repair east”'],
    ['tool','The search tool checks the register','The application executes that request against the available records.','Searching reference descriptions…'],
    ['result','Two possible matches come back','The agent receives both candidates. Similar wording alone cannot tell it which cost centre is correct.','JOB-1050 · Pump repair east intake → CC-310\nJOB-1051 · Pump repair east booster → CC-320'],
    ['agent','The agent knows when to stop','Its rule says never guess. With two possible matches, it requests a human review instead.','Request → Flag C-006, with both candidates'],
    ['tool','The application records the exception','The review tool saves the evidence. The AUD 150.00 stays unallocated.','Recording the review note…'],
    ['result','A useful hand-off, without a guess','A person can now confirm the right reference. The agent has progressed the job without inventing an answer.','C-006 · Needs human review\nTwo candidate references attached\nAUD 150.00 remains unresolved'],
    ['agent','That is the agent loop','The LLM chooses an action. The application runs a tool. The result comes back, and the LLM chooses again—until it finishes or needs help.','Choose → Act → Observe → Choose again']
  ];
  class Lesson {
    constructor(){this.index=-1;this.events=[];this.results={};LabTools.useSample();}
    next(){
      if(this.index>=steps.length-1)return null;
      const index=++this.index; let request=null,result=null;
      if(index===3) request={tool:'reconcile_inventory',args:{}};
      if(index===6) request={tool:'search_references',args:{row_id:'C-006',query:'Pump repair east'}};
      if(index===9) request={tool:'record_review',args:{row_id:'C-006',note:'Two possible references. Confirm the correct job with the owner before allocating.',candidate_rows:this.results.search.map(r=>r.source_row)}};
      if(request){result=LabTools.execute(request.tool,request.args);if(!result.ok)throw Error(result.error);this.results[ index===3?'match':index===6?'search':'review']=result.data;}
      const [actor,title,caption,evidence]=steps[index];const event={index,actor,title,caption,evidence,request,result};this.events.push(event);return event;
    }
    get done(){return this.index===steps.length-1;}
  }
  globalThis.LabLesson={Lesson,total:steps.length};
})();
