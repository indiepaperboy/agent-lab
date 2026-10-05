# Agent Lab

[Open the walkthrough](https://indiepaperboy.github.io/agent-lab/).

A short, simulated lesson about what an agent does: an LLM chooses an action, the application runs a tool, and the result informs the next choice.

## Present it

Open the webpage and press **Start walkthrough**. Twelve steps follow one inventory exception from an incoming job to a human review. Each step has one short caption and a visible example. The **Agent → Tool → Result** diagram highlights who is acting, while the activity log retains previous steps.

**Auto** advances every 6.5 seconds. **Pause** stops it. **Restart** resets the lesson. **Raw** reveals event details. **View example spreadsheets** opens the two fictional inputs, highlighting the consumption row we follow.

The choices are scripted; no LLM is called. Matching and searches run against the example data in the browser. There are no uploads, accounts, API keys, dependencies or external network requests.

## The example

Eight consumption rows total AUD 1,590.00. Exact matching allocates AUD 690.00 and leaves AUD 900.00 unresolved. Matching is case-sensitive after trimming outer spaces; only one register match with a nonblank cost centre can allocate a cost. Costs are signed line totals, added in integer cents.

The lesson follows **C-006: Pump repair east**, with AUD 150.00 in costs. Its reference is not an exact match. Searching the description returns two candidates: JOB-1050 / CC-310 and JOB-1051 / CC-320. The agent follows its instruction to never guess and requests human review. The review tool records both candidates without allocating the cost.

Only this one exception is reviewed in the short lesson. The other exceptions remain untouched. This is an educational example, not an accounting system or a complete batch-processing demonstration.

## Run locally or deploy

Open `index.html` with `style.css` and the `src/` folder alongside it, or use any static web server. No build is needed. GitHub Pages serves **main / (root)** at the link above; pushing to main updates the public site.

- `src/lesson.js`: the twelve-step lesson and real tool calls.
- `src/app.js`: visual flow, activity log, playback and spreadsheet previews.
- `src/tools.js`: exact matching, searches, integer-cent totals and review controls.
- `src/data.js`: bundled fictional CSV files from `data/`.

Run `npm test` for matching, review evidence, retained costs and lesson sequencing. After editing the CSV source files, run `npm run bundle-data`. No npm dependencies are needed.
