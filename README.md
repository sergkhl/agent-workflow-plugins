# Agent Workflow Plugins

`agent-workflow-plugins` is the public catalog for `agent-workflow-core`, a set of reusable design,
planning, and documentation skills. The catalog supports three installation modes.

## Choose one installation mode

### Repository installation (recommended for teams)

Repository mode vendors an immutable plugin snapshot, records its source commit and digest, and
checks in repository-scoped skill links for both Codex and Claude:

```text
.agents/plugins/agent-workflow-core/       one vendored plugin tree
.agents/skills/<skill>                     relative links into that tree
.claude/skills -> ../.agents/skills        one shared Claude entry point
```

Install release `0.8.1` from the public tag:

```bash
node scripts/install-repository.mjs \
  --repo <consumer-repository-root> \
  --plugin agent-workflow-core \
  --ref agent-workflow-core--v0.8.1 \
  --apply
```

When developing the catalog locally, replace the network fetch with a clean, tagged checkout:

```bash
node scripts/install-repository.mjs \
  --repo <consumer-repository-root> \
  --plugin agent-workflow-core \
  --ref agent-workflow-core--v0.8.1 \
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
consumer. The installer never overwrites a project skill, never merges an existing repository
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
  --catalog-root dev-setup/catalog --ref agent-workflow-core--v0.8.1 --update --apply
```

This manages the selected plugin snapshot and lock under `<catalog-root>/plugins/`, and its portable links under
`<catalog-root>/skills/`. It does not change a preset or create `.agents`/`.claude` discovery links.
Catalog and global locks use schema 2 and record their layout plus actual managed paths. Direct
installations retain schema 1. A relocated schema-1 snapshot is checked against its manifests, content digest,
and actual catalog skill links; only `--update --apply` migrates its lock. Unrelated project skills
and generated discovery links remain owned by the consumer. Catalog roots must be relative paths
with real directory ancestors; escaping paths and symlinked anchors are rejected.

`--check`, preflight without `--apply`, and uninstall accept the same `--catalog-root` option.
Public consumers must reference a published immutable tag; a local tag plus `--source` supports
review and validation before publishing.

### Global Claude installation (recommended for personal Claude Code use)

Global mode installs the same pinned snapshot once for your user account and links every skill into
Claude Code's personal skills, so `/grilling`, `/drain-plans`, and the rest work without a plugin
namespace in every project:

```text
~/.agents/plugins/agent-workflow-core/               one vendored plugin tree
~/.agents/plugins/agent-workflow-core.vendor.json    lock (schema 2, layout "global")
~/.claude/skills/<skill>                             relative links into that tree
```

Replace `--repo` with `--global`; every other option and operation works as in repository mode:

```bash
node scripts/install-repository.mjs --global --plugin agent-workflow-core \
  --ref agent-workflow-core--v0.8.1 --apply

node scripts/install-repository.mjs --global --plugin agent-workflow-core --check

node scripts/install-repository.mjs --global --plugin agent-workflow-core \
  --ref <new-release-tag> --update --apply

node scripts/install-repository.mjs --global --plugin agent-workflow-core --uninstall --apply
```

Start a new Claude Code session afterwards to load the skills.

- The links sit beside your other personal skills. If a personal skill already uses one of the
  twelve names, the installer refuses without changing anything. It never touches other entries
  or Claude Code's `synced/` directory, and uninstall removes only the snapshot, the lock, and its
  links.
- `~/.claude` must already exist, so start Claude Code once first. `~/.claude`, `~/.claude/skills`,
  `~/.agents`, and `~/.agents/plugins` must be real directories, not symlinks. The symlink
  requirements are the same as in repository mode.
- Leave `CLAUDE_CONFIG_DIR` unset or pointing at `~/.claude`; Claude Code reads personal skills
  from that directory.
- `--global` cannot be combined with `--catalog-root`. Global mode is Claude-only; Codex users
  install the marketplace plugin.

### Marketplace installation

Marketplace mode installs the plugin into the product-managed plugin cache and exposes its bundled
`skills/` everywhere the plugin is enabled. It is the personal route for Codex, and for Claude users
who prefer a namespaced plugin (`/agent-workflow-core:<skill>`) with product-managed updates:

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
vendored links. An individual who wants the workflow available across repositories should use
either the global Claude installation or the marketplace, not both: Claude lists the plugin's
namespaced skills beside the personal ones.

Claude Code gives a personal skill precedence over a project skill with the same name. In a
repository that vendors this plugin, a global installation therefore replaces that repository's
pinned copies for you in Claude, while Codex keeps using the repository's links. Keep the release
tags aligned, or uninstall the global copy while working there.

The catalog itself dogfoods repository discovery through its checked-in links and must not install
its own marketplace plugin at the same time. A global installation shadows those links too, so
uninstall it while editing skills here; otherwise Claude runs the pinned release instead of the
working tree.

## Catalog contract

- Marketplace ID: `agent-workflow`
- Marketplace display name (Codex): `Agent Workflow Plugins`
- Plugin ID: `agent-workflow-core`
- Current version: `0.8.1`
- Release tag: `agent-workflow-core--v0.8.1`
- Plugin path: `./plugins/agent-workflow-core`
- Installation policy (Codex): `AVAILABLE`
- Authentication policy (Codex): `ON_INSTALL`
- Category: `Developer Tools`

The Claude marketplace and plugin manifests carry only fields that Claude Code recognizes, so
`claude plugin validate . --strict` passes; Codex-only metadata stays in the Codex manifests.

Run all catalog and installer tests with:

```bash
npm test
```

The installer manages repository-scoped and personal snapshots, locks, and links. It validates a
release with its own copy of the catalog contract, so update your catalog checkout before
installing a newer release: checkouts older than 0.8.0 cannot validate 0.8.0 or later tags.

## License

Original work is licensed under MIT. Seven skills derived from `mattpocock/skills` retain the complete
upstream MIT notice inside the plugin. See
[`plugins/agent-workflow-core/THIRD_PARTY_NOTICES.md`](plugins/agent-workflow-core/THIRD_PARTY_NOTICES.md).
