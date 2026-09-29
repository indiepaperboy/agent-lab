# Agent Lab

A self-contained, simulated walkthrough of an inventory reconciliation agent. Open the page and present it: no uploads, live LLM, downloads, accounts, API keys or backend are needed. All records are fictional.

The example job assigns consumption costs to cost centres using a reference register. Exact matches are handled by code. Scripted LLM responses illustrate how an agent investigates exceptions, searches supporting records and records review notes.

## Run and present

Open `index.html` with its accompanying `src/` folder and `style.css`, or serve this directory using any static web host. No build or dependency installation is required.

1. Open either **Example spreadsheet** to show the input data.
2. Press **Next step** to introduce the job.
3. **ASK** shows the instructions, tool menu and results an LLM would receive. Expand the example request to inspect it.
4. **DECIDE** reveals one scripted LLM choice. The explanation shows where its next search comes from: a reference or description in an unresolved row.
5. **TOOL** displays the requested function and arguments. It has not run yet.
6. **Execute tool** performs the local operation and displays **OBSERVE**. The result becomes context for the next choice.
7. Continue to the report. **Restart** clears the lesson and review notes. **Auto** advances every eight seconds; pause at any time. **Raw events** changes the display without advancing it.

The complete sample has 56 observable events. Each click advances one event. The current event is highlighted and scrolled into view; previous entries are dimmed. Every step explains what happens, how it works, why it is useful and what comes next.

This is deliberately a worked example, not an autonomous agent. No model is called. Public action summaries illustrate the LLM's role without claiming to reveal private reasoning. The matching, searches, totals and report are calculated from the bundled data.

## Example and rules

The consumption data contains eight rows totalling **AUD 1,590.00**. Three exact matches allocate **AUD 690.00**: CC-210 receives AUD 330.00 and CC-220 receives AUD 360.00. Five exceptions retain **AUD 900.00**.

| Example | What happens |
| --- | --- |
| Unique exact reference and a populated cost centre | Allocate the line cost |
| JOB-1099 is absent from the register | Flag missing reference |
| JOB-1043 exists but has no cost centre | Flag missing cost centre |
| PUMP REPAIR EAST is descriptive text | Search the description; two possible job references remain unapproved candidates |
| JOB-2000 has two register entries | Flag ambiguity; do not pick one |
| Consumption reference is blank | Flag missing reference and record the evidence gap |

References match case-sensitively after trimming outer spaces. Duplicate matches remain ambiguous even if they name the same cost centre. `inventory_cost` is already the signed total line cost, not a unit price; quantity is not multiplied into it. Costs are added in integer cents.

**Input = allocated + unresolved.** The sample difference is AUD 0.00. Review notes and candidate references cannot change allocations. A finished job can still require human review. There is no payment matching, ledger posting or source-file editing.

## Where the LLM fits

A real application would give a model the job instructions, available tool definitions and previous results. The model would generate a structured request for the next useful action. The application would validate and execute that request, then return its result as new context. It does not retrain the model between steps.

Here that exchange is simulated with scripted choices, so a presenter can reliably show the same sequence. The page explicitly identifies the simulation throughout.

| Function | Role in the example |
| --- | --- |
| `inspect_inputs` | Describe the input columns, counts and cost basis |
| `reconcile_inventory` | Apply exact matching and compute control totals |
| `get_exception` | Read an unresolved row |
| `search_references` | Search reference and description for all query words |
| `record_review` | Save a note and candidate row numbers previously found for this exception |
| `get_report` | Return allocations, totals and the outstanding review queue |

The report can be filtered to allocated rows or exceptions and downloaded as CSV. The original row numbers and candidate register rows remain visible. Everything runs locally in the webpage; there are no external scripts, network calls or persistent storage.

## GitHub Pages

The app is ready for GitHub Pages. All paths are relative and work under `/agent-lab/`.

In **Settings → Pages**, select **Deploy from a branch**, then **main / (root)**. No build step is needed; `.nojekyll` preserves the static assets. The published site is [Agent Lab](https://indiepaperboy.github.io/agent-lab/).

The repository and GitHub Pages website are public. The app contains only fictional example data. Changes pushed to main are published automatically.

## Development and checks

- `index.html`, `style.css`: dark interface, spreadsheet previews and report.
- `src/data.js`: bundled source data, generated from `data/` for direct-file operation.
- `src/tools.js`: deterministic matching, integer-cent totals and exception review controls.
- `src/agent.js`: event loop, example requests and scripted choices.
- `src/tutorial.js`: step-specific what/how/why explanations.
- `src/app.js`: playback, event highlighting, dialogs and report rendering.
- `src/export.js`: CSV report generation.

After changing `data/`, run `npm run bundle-data`. Run `npm test` using a modern Node.js version. No npm packages need installing.

Thirteen automated tests cover sample consistency, matching and signed amounts, retained exceptions, candidate provenance, CSV escaping, exact event ordering, completion, request context, and failure recovery. Spreadsheet importing and live inference are intentionally outside this tutorial's scope.
