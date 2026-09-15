---
name: worklog
description: Use $worklog to estimate one author’s hands-on effort from Git history and produce a daily timesheet CSV.
disable-model-invocation: true
---

# Hands-on effort estimate

Produce a per-day estimate of **one person's actual working time** for a date range, as a CSV.

Use inputs already supplied in the task. The start date is the only normally required input;
resolve omitted inputs with the defaults below and continue without requesting confirmation.

**Hands-on hours are a timesheet number, not a measure of delivered scope.** Never report
scope-equivalent or conventional-equivalent hours anywhere in the output. When the user works with
coding agents, often several at once, hands-on time is well below wall-clock span; the estimate must
reflect that rather than the span.

## Authorization boundary

Begin when the user names `$worklog` (including its namespaced form) or this skill path.
Continue the same invocation through follow-ups until completion, cancellation, or a scope change. "How long
did that take" and "how much have I done this week" are questions to answer in prose, not triggers
for this skill.

The output attributes a **named person's** commits and states hours someone may invoice against.
Within an explicit invocation, use the supplied author or the current Git author default below.
Do not initiate an estimate over a shared repository's history without that invocation.

## Inputs and defaults

Explicit task inputs override defaults. Resolve the repository and reporting timezone before the
author and dates; interpret relative dates and compute today's calendar date in that timezone.

| Input | Default when omitted |
|---|---|
| Start date | Ask for it. A supplied date range or unambiguous relative period already supplies it. |
| End date | Today's calendar date in the reporting timezone. Include both range endpoints. |
| Repository | The current Git repository. |
| Author | The effective configured Git author name and email in the target repository, respecting author environment overrides and repository/global configuration. |
| Timezone | The current user's timezone from task context; otherwise discover the local system timezone. Use its historical timezone rules, including daylight-saving changes, throughout the range. |
| InvoiceId | `INV-YYYY-MM-DD`, using the resolved end date for every row. A supplied ID or convention overrides this. |
| Output directory | A `worklogs/` subdirectory of the repository's documented ignored artifacts directory; otherwise `worklogs/` under the system temporary directory. |
| Filename | `worklog-<repository>-<author>-<start>-<end>.csv`, using filesystem-safe names and `YYYY-MM-DD` dates. Add a numeric suffix if the generated path already exists. |
| Report language | English summaries and weekday names, unless the user or repository specifies another reporting language. |

Read the default author in the target repository, for example with
`git -c user.useConfigOnly=true var GIT_AUTHOR_IDENT`; use its name and email, not its timestamp.
Do not fall back to a synthesized login/hostname identity. Attribute by exact author email; do not
expand to other contributors because their names are similar. If a supplied author is ambiguous,
ask for clarification. If no commits match, keep one zero-hour row per requested day and the
selected author.

Ask only for a missing start date, invalid or ambiguous supplied values (including an end before
the start), or a default that cannot be resolved reliably. Use an existing documented artifact
location only when it is ignored; do not change repository ignore rules to save the report.

## Method

- Attribute by commit **author**, and exclude other contributors' commits.
- Use **author-date, not commit-date**. Rebased branches bunch every commit date at the rebase moment,
  which destroys the daily distribution.
- Include unmerged feature branches. Deduplicate rebased copies with `git patch-id`, never by commit
  subject — a rebase preserves the subject.
- Put the workday boundary at 04:00 in the reporting timezone so past-midnight work counts toward
  the previous day. This changes workday attribution, not the default end date of today.
- Report days with no commits as `0`. Do not spread work into them.

## Estimating the number

Compute each day's first→last commit span **first**. Hands-on hours must not exceed that span, and
should normally land well under it.

**Do not use lines changed as the effort proxy.** Estimate from the number of distinct problems solved
and how hard each was.

- Weight **upward** for: production migrations, especially multi-stage or with a backfill; native
  platform work; cross-cutting refactors; and anything debugged rather than written.
- Weight **downward** for: generated or formulaic code, documentation, and mechanical call-site updates.
- Treat iteration as a difficulty signal: repeated commits touching the same files, fix and revert
  commits, and large deletions of code added earlier all indicate something was hard.

Exclude from all analysis: generated migration snapshots, lockfiles, and binary assets.

## Output

A CSV file with this exact header:

```
Date,InvoiceId,Day,Summary,Estimated Hands-on h
```

- One row per calendar day in the range, including zero days, in date order.
- `Date`: `YYYY-MM-DD`. `Day`: weekday name.
- `InvoiceId`: the resolved ID or convention from Inputs and defaults. Derive period-ending IDs
  from the resolved end date rather than hardcoding one.
- `Summary`: what was actually worked on that day, as one quoted field. Commas allowed inside the
  quotes, no line breaks. Empty `""` for zero days.
- `Estimated Hands-on h`: a number to one decimal place, no unit suffix.

Alongside the CSV, report the resolved repository, author name and email, date range, timezone,
invoice ID, and output path. These are informational settings, not a confirmation gate.
