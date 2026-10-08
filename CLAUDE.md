# RIOT CONTROL — agent notes

- Read `PLAN.md` (design, art bible §3, architecture §4) and `HANDOFF.md` (live status) before working.
- Stay inside the directories your milestone owns; don't add npm deps without orchestrator approval.
- Art: pixel-perfect only (nearest, integer zoom), RIOT-64 palette only, sun from upper-left, coloured outlines, no programmer art. Always export and *look at* your sprites (`npm run shots` / gallery) before handing off.
- Quality gates: `npm run typecheck && npm run lint && npm test && npm run build` must pass.
- Subagents do not commit; the orchestrator commits and pushes.
