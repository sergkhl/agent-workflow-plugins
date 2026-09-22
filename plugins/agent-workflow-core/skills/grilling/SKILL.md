---
name: grilling
description: Stress-test a plan, decision, or idea through an interview when the user requests grilling.
---

# Grilling

Interview the user until you reach a shared understanding. Map the idea as a design tree: every
decision branches into the decisions that hang off it. Facts are yours to find: inspect the code,
history, and documents, and never ask the user for anything you could look up. Decisions are the
user's: put each one to them and wait. A requirement or evidence that admits more than one
reasonable reading is a decision, not a detail to settle with the reading you prefer.

Work the tree in rounds. The frontier is every decision whose prerequisites are already settled:
the questions you can ask now without guessing at answers you have not heard. Ask the whole
frontier in one round, however large; number each question and give your recommended answer. A
question whose answer depends on another question still open in this round belongs to a later
round. Use concrete scenarios (an empty input, a failure midway, a second actor, an existing
record) to find the branches you would otherwise fill in yourself. Then wait for the answers.

Format a round like so:

```
❓ **Q1** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>

---

❓ **Q2** - **<question title>**: <question body, might be multiple paragraphs, including multiple choices>

➡️ <your recommended answer>
```

The round is the reply's final handoff: finish the round's fact-finding and explanation first, put
the list at the end, and yield. Present it in the reply rather than through a question tool: a
tool's per-call limit would cap the round, and the reply is what the user can always see. Do not
bury the list under further research, progress updates, or a second round while answers are
pending. A lookup still in progress is an unsettled prerequisite: hold back only the questions
downstream of it and ask the rest of the frontier now. Delegate a lookup only when the host permits
delegation; lookups do not require a subagent.

Each round of answers reshapes the tree: settled decisions push the frontier outward and unblock
the questions that depended on them. Retain confirmed choices, recompute the frontier, and ask the
next round, re-asking an unresolved question with its recommendation. An unanswered question or an
unaccepted recommendation is not a user decision, and silence is not delegation.

The interview is done when the frontier is empty: every branch of the design tree visited and
nothing left silently assumed. A tree with no open decision is done at once; say what the evidence
settled. Summarize unresolved issues honestly. An interview alone does not authorize
implementation; an existing implementation request remains authoritative without another
ceremonial confirmation.
