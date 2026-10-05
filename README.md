# Agent Lab

[Open the walkthrough](https://indiepaperboy.github.io/agent-lab/).

A twelve-step simulated lesson: an hourly Fabric pipeline supplies technician orders; the agent chooses checks, tools perform them, and results guide the next choice. No Fabric connection or LLM is used.

## Present the example

Press **Start walkthrough**. Each click reveals one action and a short caption. The **Agent → Tool → Result** diagram highlights the actor. A schematic map and stock-source cards progressively reveal what has been checked. **Auto** advances every 6.5 seconds; **Pause**, **Restart** and **Raw** are available. **View the example data** shows the fixed fictional snapshot.

At 13:00, Alex requests **two additional units** for delivery by **14:00**. Alex already holds one; the maximum is three.

- The North warehouse is 15 minutes away but has no stock.
- The Central warehouse has stock, but 70 minutes driving plus 10 minutes collection exceeds the 60-minute delivery window by 20 minutes.
- Nearby technician Sam holds five units: one allocated and two protected as a minimum reserve, leaving two transferable. A 20-minute drive plus five-minute handover gives a 13:25 arrival and 35 minutes of SLA margin.

The agent recommends a transfer for approval. No stock is moved or reserved. The lesson explicitly calls for checking current stock and travel time before approval because hourly data can become stale.

## Teaching boundaries

Fabric represents the scheduled data intake. In this fictional architecture, successful pipeline completion triggers the agent's job. The application supplies the goal, rules and tool descriptions. The LLM's choices are scripted for repeatability; browser functions calculate holdings, stock availability and time feasibility.

The clock is fixed at the 13:00 snapshot, not a live countdown. Travel estimates are fictional one-way trips to the handover, with collection/handover time included. The SLA ends at delivery, not completion of a repair. The map is schematic, not geographic. No route provider, real Fabric service, accounting system or autonomous dispatch is connected.

Only one order is demonstrated. The lesson illustrates an alternative search after warehouses fail, rather than a complete optimiser or production fulfilment system.

## Run and edit

Open `index.html` with `style.css` and `src/` alongside it, or serve the folder on any static host. No build, npm installation, API keys or uploads are required. GitHub Pages publishes **main / (root)** automatically.

- `src/data.js`: fictional pipeline, order, warehouse and technician snapshot.
- `src/tools.js`: deterministic holdings, stock and SLA checks.
- `src/lesson.js`: scripted sequence and tool execution.
- `src/app.js`: playback, map states, activity log and example-data dialog.

Run `npm test` for holding limits, protected stock, travel calculations, tool sequencing and non-mutating recommendations.
