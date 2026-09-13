# HTML Report Format

Deliver a single HTML artifact in the OS temporary directory unless the user requests another
format or location. Keep it self-contained so it remains readable when shared or opened offline.
Use inline CSS and SVG, or embed rendered diagrams. Adapt the layout to the actual findings and
available rendering tools.

## Scaffold

Optional HTML starting point:

```html
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Architecture review</title>
<style>
  body { max-width: 70rem; margin: auto; padding: 2rem; font: 1rem/1.6 system-ui; color: #172033; }
  article { margin-block: 2rem; border-top: 1px solid #ccd3dd; padding-top: 1rem; }
  svg { max-width: 100%; height: auto; }
  code { overflow-wrap: anywhere; }
</style>
<main>
  <header><h1>Architecture review</h1></header>
  <section id="candidates"><!-- Evidence and candidate comparisons --></section>
  <section id="top-recommendation"><h2>Recommendation</h2></section>
</main>
</html>
```

## Header

Identify the repository, reviewed scope, and date. Add context or a diagram legend when it helps
readers understand the findings without the conversation.

## Candidate card

Give each candidate an anchor so the recommendation can link to it. Include:

- Affected files and observed friction, grounded in the current code.
- A proposed interface or responsibility change and a before/after visual that explains it.
- Concrete benefits, relevant costs, confidence in the recommendation, and substantive ADR conflicts.

Match the detail and number of candidates to the findings. Explain the evidence, tradeoffs, and
uncertainty that affect the choice.

## Diagram patterns

Choose a visual that exposes the relevant relationship: a dependency graph for call flow, a
cross-section for redundant layers, or an interface/implementation comparison for module depth.
Use consistent notation across comparable candidates.

Mermaid is useful for graphs when a renderer is available; embed the rendered result for an offline
artifact. Inline SVG or simple HTML works for boxes and annotated comparisons. Explain symbolic
areas or line weights so a reader does not mistake them for measured code size or performance.

## Style guidance

Prioritize readable labels, sufficient contrast, useful spacing, and a layout that fits the content.
Check the rendered artifact for clipped text and broken diagrams using the available preview.
The report should remain understandable if a visual needs a textual fallback.

## Top recommendation section

Recommend a candidate, explain why it has the strongest benefit for the requested scope, and link
to its evidence. State any decision that must be settled before detailed design or implementation.

## Tone

Use the repository's domain vocabulary and the relevant concepts from `codebase-design`. Explain
how complexity moves, what callers can stop knowing, and where behavior can be tested. Familiar
terms such as service, wrapper, API, or boundary are useful when they accurately describe the code.
