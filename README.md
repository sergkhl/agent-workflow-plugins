# Agent Workflow Plugins

`agent-workflow-plugins` is the public catalog for `agent-workflow-core`, a set of reusable design,
planning, and documentation skills. The catalog supports two installation modes.

## Choose one installation mode

### Repository installation (recommended for teams)

Repository mode vendors an immutable plugin snapshot, records its source commit and digest, and
checks in repository-scoped skill links for both Codex and Claude:

```text
.agents/plugins/agent-workflow-core/       one vendored plugin tree
.agents/skills/<skill>                     relative links into that tree
.claude/skills -> ../.agents/skills        one shared Claude entry point
```

Install release `0.6.2` from the public tag:

```bash
node scripts/install-repository.mjs \
  --repo <consumer-repository-root> \
  --plugin agent-workflow-core \
  --ref agent-workflow-core--v0.6.2 \
  --apply
```

When developing the catalog locally, replace the network fetch with a clean, tagged checkout:

```bash
node scripts/install-repository.mjs \
  --repo <consumer-repository-root> \
  --plugin agent-workflow-core \
  --ref agent-workflow-core--v0.6.2 \
  --source . \
  --apply
```

Lifecycle operations use the same contract:

```bash
node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core --check

node scripts/install-repository.mjs \
  --repo <root> \
  --plugin agent-workflow-core \
  --ref <new-release-tag> \
  --update \
  --apply

node scripts/install-repository.mjs \
  --repo <root> \
  --plugin agent-workflow-core \
  --uninstall \
  --apply
```

Omit `--apply` from install, update, or uninstall to run the complete preflight without changing the
consumer. The installer never overwrites a project skill, never merges an existing
`.claude/skills` directory, and never falls back to copying skills when symlinks are unavailable.
On Windows, enable Developer Mode or grant symlink permission and retry.

The lock at `.agents/plugins/agent-workflow-core.vendor.json` records the public repository, release
tag, exact commit, plugin version, content digest, and every installer-managed symlink. Project-only
skills remain real directories beside the portable links in `.agents/skills`.

### Catalog-backed repository installation

When a repository's setup owns discovery links, add `--catalog-root <repo-relative-directory>`
to every installer operation. For example:

```bash
node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core \
  --catalog-root dev-setup/catalog --ref agent-workflow-core--v0.6.2 --update --apply
```

This manages the selected plugin snapshot and lock under `<catalog-root>/plugins/`, and its portable links under
`<catalog-root>/skills/`. It does not change a preset or create `.agents`/`.claude` discovery links.
Catalog locks use schema 2 and record the layout plus actual managed paths. Direct installations
retain schema 1. A relocated schema-1 snapshot is checked against its manifests, content digest,
and actual catalog skill links; only `--update --apply` migrates its lock. Unrelated project skills
and generated discovery links remain owned by the consumer. Catalog roots must be relative paths
with real directory ancestors; escaping paths and symlinked anchors are rejected.

`--check`, preflight without `--apply`, and uninstall accept the same `--catalog-root` option.
Public consumers must reference a published immutable tag; a local tag plus `--source` supports
review and validation before publishing.

### Marketplace installation (recommended for personal/global use)

Marketplace mode installs the plugin into the product-managed plugin cache and exposes its bundled
`skills/` everywhere the plugin is enabled:

```bash
codex plugin marketplace add sergkhl/agent-workflow-plugins
codex plugin add agent-workflow-core@agent-workflow

claude plugin marketplace add sergkhl/agent-workflow-plugins
claude plugin install agent-workflow-core@agent-workflow
```

Update a marketplace installation with:

```bash
codex plugin marketplace upgrade agent-workflow
codex plugin add agent-workflow-core@agent-workflow

claude plugin marketplace update agent-workflow
claude plugin update agent-workflow-core@agent-workflow
```

These commands do **not** create `.agents/skills` or `.claude/skills` in the current repository.
Plugin installation and repository skill discovery are separate mechanisms.

## Do not combine the modes

Repository mode and marketplace mode are mutually exclusive for the same working context. Codex
does not merge two skills with the same name, so enabling the marketplace copy while a repository
also exposes these links can produce duplicate entries. A shared team repository should use the
vendored links. An individual who wants the workflow available across repositories should use the
marketplace without repository links.

The catalog itself dogfoods repository discovery through its checked-in links and must not install
its own marketplace plugin at the same time.

## Catalog contract

- Marketplace ID: `agent-workflow`
- Marketplace display name: `Agent Workflow Plugins`
- Plugin ID: `agent-workflow-core`
- Current version: `0.6.2`
- Release tag: `agent-workflow-core--v0.6.2`
- Plugin path: `./plugins/agent-workflow-core`
- Installation policy: `AVAILABLE`
- Authentication policy: `ON_INSTALL`
- Category: `Developer Tools`

Run all catalog and installer tests with:

```bash
npm test
```

The installer manages repository-scoped snapshots, locks, and discovery links.

## License

Original work is licensed under MIT. Seven skills derived from `mattpocock/skills` retain the complete
upstream MIT notice inside the plugin. See
[`plugins/agent-workflow-core/THIRD_PARTY_NOTICES.md`](plugins/agent-workflow-core/THIRD_PARTY_NOTICES.md).
