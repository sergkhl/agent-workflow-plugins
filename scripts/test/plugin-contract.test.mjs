import assert from 'node:assert/strict'
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import {
  EXPLICIT_ONLY,
  INITIAL_SKILLS,
  PLUGIN_ID,
  computeContentDigest,
  readAgentPolicy,
  parseFrontmatter,
  validateCatalog,
} from '../lib/catalog-contract.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..', '..')
const pluginRoot = resolve(repositoryRoot, 'plugins', PLUGIN_ID)
const pluginSkills = resolve(pluginRoot, 'skills')
const pluginManifest = JSON.parse(readFileSync(resolve(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'))
const releaseTag = `${PLUGIN_ID}--v${pluginManifest.version}`

function walk(from, predicate = () => true) {
  return readdirSync(from, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '.git' || entry.name === 'node_modules') return []
    const path = resolve(from, entry.name)
    if (entry.isDirectory()) return walk(path, predicate)
    return predicate(path) ? [path] : []
  })
}

function git(args) {
  const result = spawnSync('git', args, { cwd: repositoryRoot, encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  return result.stdout.trim()
}

test('the catalog, marketplaces, manifests, inventory, gates, and licenses satisfy the release contract', () => {
  const snapshot = validateCatalog(repositoryRoot, {
    pluginId: PLUGIN_ID,
    releaseTag,
  })
  if (snapshot.version === '0.1.0') assert.deepEqual(snapshot.skills, INITIAL_SKILLS)
  assert.match(snapshot.digest, /^sha256:[0-9a-f]{64}$/)
})

test('the seven explicit-only skills carry both harness gates and only those skills do', () => {
  const gated = []
  const snapshot = validateCatalog(repositoryRoot, { pluginId: PLUGIN_ID, releaseTag })
  for (const name of snapshot.skills) {
    const directory = resolve(pluginSkills, name)
    const claudeGate = parseFrontmatter(directory)['disable-model-invocation'] === 'true'
    const policy = readAgentPolicy(directory)
    const codexGate = policy?.allowImplicitInvocation === false
    assert.equal(claudeGate, codexGate, `${name}: invocation gates disagree`)
    if (claudeGate) gated.push(name)
  }
  if (snapshot.version === '0.1.0') assert.deepEqual(gated, EXPLICIT_ONLY)
})

test('catalog discovery uses only relative, resolving symlinks with the documented targets', () => {
  const snapshot = validateCatalog(repositoryRoot, { pluginId: PLUGIN_ID, releaseTag })
  const expected = new Map(snapshot.skills.map((name) => [
    `.agents/skills/${name}`,
    `../../plugins/${PLUGIN_ID}/skills/${name}`,
  ]))
  expected.set('.claude/skills', '../.agents/skills')

  for (const [relativePath, target] of expected) {
    const path = resolve(repositoryRoot, relativePath)
    assert.ok(lstatSync(path).isSymbolicLink(), `${relativePath} must be a symlink`)
    assert.equal(readlinkSync(path), target, `${relativePath} target`)
    assert.ok(realpathSync(path).startsWith(realpathSync(repositoryRoot) + sep),
      `${relativePath} resolves outside the catalog`)
  }
})

test('Git records every catalog discovery link with mode 120000', () => {
  const snapshot = validateCatalog(repositoryRoot, { pluginId: PLUGIN_ID, releaseTag })
  const linkPaths = [
    ...snapshot.skills.map((name) => `.agents/skills/${name}`),
    '.claude/skills',
  ]
  for (const path of linkPaths) {
    const record = git(['ls-files', '-s', '--', path])
    assert.match(record, /^120000 [0-9a-f]{40} 0\t/, `${path} is not tracked as a symlink`)
  }
})

test('every real relative Markdown link resolves', () => {
  const markdownFiles = walk(repositoryRoot, (path) => path.endsWith('.md'))
  for (const path of markdownFiles) {
    // Example documents intentionally show hypothetical links inside fenced Markdown snippets.
    const text = readFileSync(path, 'utf8').replace(/```[\s\S]*?```/g, '')
    for (const match of text.matchAll(/\]\(([^)]+)\)/g)) {
      let destination = match[1].trim().replace(/^<|>$/g, '')
      if (/^(?:https?:|mailto:|#)/.test(destination)) continue
      destination = destination.split('#')[0].split('?')[0]
      if (!destination) continue
      const resolved = resolve(dirname(path), decodeURIComponent(destination))
      assert.ok(existsSync(resolved), `${relative(repositoryRoot, path)} -> ${destination} is broken`)
    }
  }
})

test('portable skill content contains no application, machine, or secret identifiers', () => {
  const forbidden = [
    /\b(easy[- ]?fit|ezfit|izifit|kamal|expo|eas|drizzle|maestro|hono|jotai|nativewind)\b/i,
    /(^|[\s(`])(front|back|portal|global-shared)\//i,
    /\/Users\/[A-Za-z0-9._-]+\//,
    /\/home\/[A-Za-z0-9._-]+\//,
    /[A-Za-z]:\\Users\\[^\\]+\\/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    /\bemulator-\d+\b/,
    /\b[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\b/i,
  ]

  for (const path of walk(pluginSkills)) {
    const text = readFileSync(path, 'utf8')
    for (const pattern of forbidden) {
      const match = pattern.exec(text)
      assert.equal(match, null, `${relative(repositoryRoot, path)} contains forbidden '${match?.[0]}'`)
    }
  }
})

test('the plugin carries its own MIT license and complete upstream notice', () => {
  const license = readFileSync(resolve(pluginRoot, 'LICENSE'), 'utf8')
  const notices = readFileSync(resolve(pluginRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8')
  assert.match(license, /^MIT License\n/)
  assert.match(notices, /Copyright \(c\) 2026 Matt Pocock/)
  assert.match(notices, /Permission is hereby granted, free of charge/)
  assert.match(notices, /THE SOFTWARE IS PROVIDED "AS IS"/)
})

test('the content digest is deterministic and covers the entire plugin folder', () => {
  const first = computeContentDigest(pluginRoot)
  const second = computeContentDigest(pluginRoot)
  assert.equal(first, second)
})

test('the plugin has no implicit repository-mutation hook', () => {
  assert.equal(existsSync(resolve(pluginRoot, 'hooks')), false)
  const codex = JSON.parse(readFileSync(resolve(pluginRoot, '.codex-plugin', 'plugin.json'), 'utf8'))
  assert.equal(codex.hooks, undefined)
})
