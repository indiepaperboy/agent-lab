# Agent Lab

A small, browser-only case investigator for demonstrating the agent loop. Dark split-screen UI, a visible evidence room, and an event console that highlights the current action while retaining the history.

The case: **Why were customer orders delayed yesterday?** Here, “yesterday” is fixed to **28 September 2026** so the demo remains repeatable. All people, orders, incidents and business records are fictional.

## Run it

Open **index.html** in a browser. The default guided rehearsal needs no install, build, network connection, account, API key or server. Keep the accompanying `src/` folder and `style.css` beside it.

To use the optional local model, serve the folder over HTTPS or localhost, for example:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000. This is only a static file server; there is no application backend or inference server.

## Present the demo

1. Start in **Step** mode and press **Next step** to supply the goal.
2. Advance to **ASK** to inspect the input prepared for the LLM: instructions, goal, tools and previous results. This step does not call the model yet.
3. Advance to **DECIDE** to call the local model (or reveal the authored rehearsal choice). Its chosen action appears with an explanation.
4. Advance to **TOOL** to see the proposed tool and its exact arguments. The tool has not run yet.
5. Press **Execute tool** to run it locally and emit **OBSERVE** with its real result.
6. Continue as new evidence leads to more decisions, then an **ANSWER** with clickable source files.
7. Restart, select **Auto**, then **Run auto** to replay the same event loop every 8 seconds to leave time to read the teaching notes. Pause or switch back to Step at any point. A pending model decision may finish, but no subsequent event runs while paused.
8. Toggle **Raw events** to inspect the structured event objects. This is a view switch, not a second investigator. It never advances the loop.

The stage strip is `GOAL → ASK → DECIDE → TOOL → OBSERVE → ASK → … → ANSWER`. Every click adds exactly one observable event. Each current event explains **what is happening**, **how it works**, **why it helps**, and **what comes next**. Teaching notes explain the visible mechanics and purpose, not private model reasoning. The visible ASK payload is the same request object passed to the live model on the next click. The tutorial explicitly identifies the instruction that guides the first `list_files` call. Current events are bordered and highlighted; previous events are dimmed and remain scrollable. Raw output contains public summaries, actions, arguments, and observations, never hidden chain-of-thought.

## Two honest decision makers

### Guided rehearsal — default

This is an **authored, deterministic sequence**, not an autonomous model. It is explicitly labelled that way in the interface. The tools really execute over the CSV/text files; results and numerical findings are computed, not fake console output. This mode is useful for a reliable first presentation and works offline even from `file://`.

The fixed route discovers files, confirms delayed orders, compares warehouse averages, resolves warehouse identifiers, checks weather as an alternative, searches operations records, verifies the incident, and calculates the outage duration.

### Local AI — optional

Select **Local AI · WebGPU**, then **Download & load local model**. The app loads `Qwen3-4B-q4f16_1-MLC` through pinned WebLLM `0.2.85` in a Web Worker. Model inference happens entirely in the browser. The model receives the objective and tool descriptions; it does **not** receive the dataset until it requests tool results. It chooses the path and can correct tool errors from observations. The task field is editable before a local-AI run.

Requirements and boundaries:

- HTTPS or localhost; a desktop browser/device with WebGPU and `shader-f16` support.
- Several GB of initial model download and available GPU/unified memory. Load well before a presentation. The model is cached by WebLLM for later use.
- The optional runtime is fetched from jsDelivr; model weights and compiled model libraries are fetched from WebLLM's configured Hugging Face/GitHub locations. No external requests occur in rehearsal mode.
- No API key, hosted inference service, telemetry, or user data upload is implemented. Inference uses local GPU resources.
- Small models can choose unhelpful tools, cite poorly, or reach incorrect conclusions. JSON schema constrains output structure, not factual accuracy. Source links identify model-supplied filenames, not an automatic proof that every claim is supported.
- Tool errors are returned to the model. Invalid model JSON pauses the run with an error and allows retry. The app stops at 20 tool calls to avoid endless loops.
- Restart during a pending model decision or download terminates the worker; load the model again to continue. Switching investigator unloads it. Inference and download latency vary by hardware and network.

The local model integration uses the documented [WebLLM worker API](https://webllm.mlc.ai/docs/user/advanced_usage.html) and [structured-output API](https://webllm.mlc.ai/docs/user/api_reference.html). A successful rehearsal does not establish that a device supports local AI; test and load that option on the presentation machine in advance.

## What is the agent loop?

`src/agent.js` owns a small state machine. Its decision-maker is injected: either the authored rehearsal or a real model adapter.

```text
objective
  → decision maker chooses an action
  → application displays the request
  → browser executes the selected tool
  → result is added to the observation history
  → decision maker chooses again
  → final answer
```

A chatbot can answer directly; an agent can request actions and use their results to choose its next action. The application controls the tools and execution boundary. Tools do not “think.” Rehearsal demonstrates that boundary; Local AI supplies actual model-selected actions.

## Tools and evidence

| Tool | What it does |
| --- | --- |
| `list_files()` | Lists the bundled files and byte sizes |
| `read_file({file})` | Reads a named file from the allowlisted dataset |
| `search_files({query})` | Literal, case-insensitive text search with filenames and line numbers |
| `query_csv({file, filters?, groupBy?, aggregate?})` | Exact-value filters and grouped `avg`, `sum`, `min`, `max`, `count` |
| `calculate({expression})` | Arithmetic with parentheses and `+ - * /`; no eval or executable code |

Example query:

```json
{
  "file": "deliveries.csv",
  "filters": {"date": "2026-09-28"},
  "groupBy": "warehouse",
  "aggregate": {"delay_minutes": "avg"}
}
```

The fictional sample contains 10 orders on the case date and two baseline orders on the preceding date. Four delayed orders originate at **WH-04 / Newcastle**. Mean delivery delays are **4.2 minutes in Sydney**, **7.1 in Melbourne**, and **94.3 in Newcastle**. The incident note links the four orders to a conveyor power-supply failure; the log corroborates the **09:17–12:42 outage (205 minutes)**. Weather and staffing files provide alternative avenues to investigate. These are teaching-sized records, not a statistically representative operational dataset.

Files in `data/` are the canonical editable evidence. `src/data.js` bundles their exact contents so direct-file use does not need fetch requests. After editing the dataset, run:

```sh
npm run bundle-data
npm test
```

The authored route and conclusion assume this specific case; update them too if changing the scenario. All tool output and model text are rendered as text, not HTML. There are no write, shell, network-search, or arbitrary-file tools.

## GitHub Pages

No build step is required. All asset links are relative and work under `/agent-lab/`.

In the repository's **Settings → Pages**, choose **Deploy from a branch**, then **main / (root)** and save. The expected project URL is `https://indiepaperboy.github.io/agent-lab/` once GitHub has completed deployment. `.nojekyll` keeps the files as plain static assets.

The repository was created private. GitHub Pages availability for private repositories depends on the account plan; a privately stored repository does not necessarily imply a private published website. Enable Pages only with the intended visibility. Repository creation and committing the app do not automatically enable Pages.

Any other static host can serve the same folder unchanged.

## Source map and verification

- `index.html`, `style.css`: accessible controls, responsive dark interface and file dialogs.
- `src/tools.js`: data access, CSV queries and arithmetic parser.
- `src/agent.js`: one-event-at-a-time loop and authored rehearsal.
- `src/live.js`, `model-worker.js`: optional local model, structured action contract and cancellation.
- `src/app.js`: playback, rendering, highlighting, scrolling, sources and UI controls.
- `src/tutorial.js`: per-event teaching notes about the actors, mechanics, purpose and next hand-off.
- `scripts/bundle-data.mjs`: regenerate browser data from the canonical files.
- `tests/agent.test.mjs`: Node built-in tests for evidence consistency, tools, calculations, event ordering, completion, concurrent-step protection and error recovery.

Run `npm test` with a modern Node.js version. There are no npm dependencies to install for rehearsal or tests.

### Verified on 29 September 2026

- Initial implementation: all 9 automated tests passed.
- Initial implementation browser checks covered all 30 rehearsal events, full Auto completion, pause/resume, restart, Raw view, current-event highlighting, source dialogs and Escape dismissal.
- Desktop and 390px-wide layouts were inspected with screenshots; the narrow layout had no horizontal page overflow.
- The optional Qwen3 model downloaded and loaded in the test browser, then completed a real 12-event investigation. It selected `list_files`, `search_files`, and `read_file` and identified the Newcastle conveyor power-supply failure. This validates the integration on that environment, not every WebGPU device or future model run.

### In-app tutorial update

The narrated walkthrough adds a separate input-preparation event before every decision (40 events in the full rehearsal). Eleven automated tests cover the loop, exact visible/request payload identity, observation history, and explanations based on actual returned data. The hand-off strip names the actors explicitly: your goal, app asks LLM, LLM chooses, tool request, app returns result, answer. Rehearsal remains clearly labelled as authored throughout.

The updated browser walkthrough was checked through all 40 rehearsal events. A real local-model run also verified the new input step, model-selected action, tool execution, and updated request containing the returned result. Desktop and narrow-layout screenshots were inspected.
