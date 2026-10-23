# START HERE

Drop every file in this folder into the root of a fresh repo, keeping `.claude/agents/design-reviewer.md` at that path. Then open Claude Code in that folder.

## File map

| File | Claude reads it | You read it |
|---|---|---|
| `CLAUDE.md` | **automatically, every session** — keep it short, prune anything that isn't actually preventing a mistake | once |
| `PRD.md` | when you point at it | to check scope |
| `ARCHITECTURE.md` | when it needs to know where code goes | once |
| `DESIGN.md` | before any UI work (tell it to) | before Phase 5 |
| `TASKS.md` | as the build order | to track progress |
| `DEMO.md` | at Phase 9 | before you send anything |
| `.claude/agents/design-reviewer.md` | when invoked as a subagent | never |

## First message to Claude Code

```
Read CLAUDE.md, PRD.md and ARCHITECTURE.md. Then do Phase 0 and Phase 1
of TASKS.md. Don't start Phase 2 until the Phase 1 gate passes.
```

Then, one phase at a time. `/clear` between phases — a clean context window produces noticeably better code than a 150k-token one.

## At Phase 5

```
/model opus
Read DESIGN.md completely. Then do Phase 5 — inspect the live cars24.com
with playwright, extract real computed styles, and write the token file.
Do not use any hex code you didn't extract yourself.
```

Stay on Opus until Phase 9 is done.

## Why these files and not more

Claude Code's own guidance is that `CLAUDE.md` gets read every single turn, so bloat there makes it start ignoring rules. The split here follows that: `CLAUDE.md` holds only the rules that prevent actual mistakes, everything else is a document you point at when it's relevant. The single highest-leverage practice is giving it a check it can run itself — which is why every phase in `TASKS.md` ends with a gate, and why `DESIGN.md` ends in a screenshot-and-review loop rather than a style guide.

## Three things that will go wrong

1. **Units.** Lakh vs rupee. When a number looks insane, this is why. `CLAUDE.md` says it; it will still happen once.
2. **Library palettes.** Components copied from magicui/reactbits arrive with their own colors baked in. If the UI looks slightly "not CARS24", grep for hex.
3. **ROI ranking.** If the top results are all cheap grade-C cars, the blended score got reverted to ROI%. Check the weights are 0.5 / 0.3 / 0.2.
