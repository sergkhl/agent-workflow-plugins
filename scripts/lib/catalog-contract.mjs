import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
} from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { computeContentDigest } from '../../plugins/agent-workflow-core/scripts/content-digest.mjs'

export { computeContentDigest }

export const CATALOG_REPOSITORY_URL = 'https://github.com/sergkhl/agent-workflow-plugins'
export const MARKETPLACE_ID = 'agent-workflow'
export const MARKETPLACE_DISPLAY_NAME = 'Agent Workflow Plugins'
export const PLUGIN_ID = 'agent-workflow-core'
// Each released version pins the exact skills it shipped and which of them are explicit-only, so a
// later edit cannot quietly add a skill or drop an invocation gate. A version with no entry here —
// an unreleased working version, or a test fixture — is simply unpinned; every other assertion in
// validateCatalog, including Claude/Codex gate agreement, still applies to it.
export const RELEASE_INVENTORY = {
  '0.1.0': {
    skills: [
      'codebase-design',
      'docs-hygiene',
      'domain-modeling',
      'drain-plans',
      'grill-with-docs',
      'grilling',
      'improve-codebase-architecture',
      'plan-from-tasks',
      'plan-lifecycle',
      'wait-what',
      'worklog',
    ],
    explicitOnly: [
      'docs-hygiene',
      'drain-plans',
      'grill-with-docs',
      'improve-codebase-architecture',
      'plan-from-tasks',
      'wait-what',
      'worklog',
    ],
  },
  '0.2.0': {
    skills: [
      'codebase-design',
      'docs-hygiene',
      'domain-modeling',
      'drain-plans',
      'grill-with-docs',
      'grilling',
      'improve-codebase-architecture',
      'parallel-lanes',
      'plan-from-tasks',
      'plan-lifecycle',
      'wait-what',
      'worklog',
    ],
    explicitOnly: [
      'docs-hygiene',
      'drain-plans',
      'grill-with-docs',
      'improve-codebase-architecture',
      'parallel-lanes',
      'plan-from-tasks',
      'wait-what',
      'worklog',
    ],
  },
}

export function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Cannot read valid JSON from ${path}: ${error.message}`)
  }
}

export function currentRelease(catalogRoot, pluginId = PLUGIN_ID) {
  const manifest = readJson(resolve(catalogRoot, 'plugins', pluginId, '.codex-plugin', 'plugin.json'))
  return { version: manifest.version, releaseTag: `${pluginId}--v${manifest.version}` }
}

export function listSkillDirectories(skillsDirectory) {
  if (!existsSync(skillsDirectory) || !lstatSync(skillsDirectory).isDirectory()) {
    throw new Error(`Missing skills directory: ${skillsDirectory}`)
  }

  return readdirSync(skillsDirectory, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.'))
    .map((entry) => {
      if (!entry.isDirectory()) {
        throw new Error(`Plugin skill must be a real directory: ${resolve(skillsDirectory, entry.name)}`)
      }
      return entry.name
    })
    .sort()
}

export function parseFrontmatter(skillDirectory) {
  const path = resolve(skillDirectory, 'SKILL.md')
  if (!existsSync(path)) throw new Error(`Missing skill entry point: ${path}`)
  const text = readFileSync(path, 'utf8')
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text)
  if (!match) throw new Error(`Missing frontmatter block: ${path}`)

  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    const field = /^([a-z-]+):\s*(.*)$/.exec(line)
    if (field) fields[field[1]] = field[2].trim()
  }
  return fields
}

export function readAgentPolicy(skillDirectory) {
  const path = resolve(skillDirectory, 'agents', 'openai.yaml')
  if (!existsSync(path)) return null
  const text = readFileSync(path, 'utf8')
  const implicit = /^\s+allow_implicit_invocation:\s*(true|false)\s*$/m.exec(text)
  const prompt = /^\s+default_prompt:\s*"(.*)"\s*$/m.exec(text)
  return {
    path,
    text,
    allowImplicitInvocation: implicit ? implicit[1] === 'true' : null,
    defaultPrompt: prompt ? prompt[1] : null,
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function assertDeepEqual(actual, expected, message) {
  assert(JSON.stringify(actual) === JSON.stringify(expected), message)
}

function assertSelfContainedTree(root) {
  const canonicalRoot = realpathSync(root)
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name)
      const stat = lstatSync(path)
      if (stat.isDirectory()) {
        walk(path)
      } else if (stat.isSymbolicLink()) {
        let target
        try {
          target = realpathSync(path)
        } catch {
          throw new Error(`Plugin snapshot contains a broken symlink: ${path} -> ${readlinkSync(path)}`)
        }
        const relativeTarget = relative(canonicalRoot, target)
        assert(relativeTarget !== '..' && !relativeTarget.startsWith(`..${sep}`),
          `Plugin snapshot symlink escapes the plugin root: ${path} -> ${readlinkSync(path)}`)
      }
    }
  }
  walk(canonicalRoot)
}

function resolveMarketplaceSource(catalogRoot, entry) {
  const source = typeof entry.source === 'string' ? entry.source : entry.source?.path
  assert(typeof source === 'string' && source.startsWith('./'), 'Marketplace source must start with ./')
  const resolved = resolve(catalogRoot, source)
  const relativePath = relative(catalogRoot, resolved)
  assert(
    relativePath !== '..' && !relativePath.startsWith(`..${sep}`),
    `Marketplace source escapes the catalog: ${source}`,
  )
  return resolved
}

export function validateCatalog(catalogRoot, { pluginId = PLUGIN_ID, releaseTag } = {}) {
  const root = realpathSync(catalogRoot)
  assert(pluginId === PLUGIN_ID, `Unsupported plugin: ${pluginId}`)

  const pluginRoot = resolve(root, 'plugins', pluginId)
  const skillsRoot = resolve(pluginRoot, 'skills')
  const codexManifestPath = resolve(pluginRoot, '.codex-plugin', 'plugin.json')
  const claudeManifestPath = resolve(pluginRoot, '.claude-plugin', 'plugin.json')
  for (const required of [
    codexManifestPath,
    claudeManifestPath,
    resolve(pluginRoot, 'README.md'),
    resolve(pluginRoot, 'LICENSE'),
    resolve(pluginRoot, 'THIRD_PARTY_NOTICES.md'),
    resolve(pluginRoot, 'scripts', 'content-digest.mjs'),
  ]) {
    assert(existsSync(required) && lstatSync(required).isFile(), `Missing required plugin file: ${required}`)
  }
  assertSelfContainedTree(pluginRoot)

  const codex = readJson(codexManifestPath)
  const claude = readJson(claudeManifestPath)
  for (const field of ['name', 'version', 'description', 'author', 'homepage', 'repository', 'license', 'keywords']) {
    assertDeepEqual(codex[field], claude[field], `Plugin manifests disagree on ${field}`)
  }
  assert(codex.name === pluginId, `Codex manifest name must be ${pluginId}`)
  assert(codex.repository === CATALOG_REPOSITORY_URL, 'Plugin repository metadata is not canonical')
  assert(codex.author?.name === 'sergkhl', 'Plugin author must be sergkhl')
  assert(codex.license === 'MIT', 'Plugin license must be MIT')
  assert(codex.skills === './skills/', 'Codex manifest must discover ./skills/')

  const interfaceMetadata = codex.interface ?? {}
  assert(interfaceMetadata.developerName === 'sergkhl', 'Codex interface.developerName must be sergkhl')
  assert(typeof interfaceMetadata.longDescription === 'string' && interfaceMetadata.longDescription.length > 0,
    'Codex interface.longDescription is required')
  assertDeepEqual(interfaceMetadata.capabilities, ['Read', 'Write'],
    'Codex interface.capabilities must be ["Read", "Write"]')
  assert(Array.isArray(interfaceMetadata.defaultPrompt) && interfaceMetadata.defaultPrompt.length > 0,
    'Codex interface.defaultPrompt must contain starter prompts')

  const skillDirectories = listSkillDirectories(skillsRoot)
  const claudeSkills = claude.skills.map((entry) => {
    assert(/^\.\/skills\/[a-z0-9-]+$/.test(entry), `Invalid Claude skill path: ${entry}`)
    return entry.slice('./skills/'.length)
  }).sort()
  assertDeepEqual(claudeSkills, skillDirectories, 'Claude manifest does not expose every plugin skill')
  const inventory = RELEASE_INVENTORY[codex.version]
  if (inventory) {
    assertDeepEqual(skillDirectories, inventory.skills,
      `Version ${codex.version} skill inventory changed`)
  }

  const gated = []
  for (const name of skillDirectories) {
    const skillDirectory = resolve(skillsRoot, name)
    const frontmatter = parseFrontmatter(skillDirectory)
    assert(frontmatter.name === name, `${name}: frontmatter name does not match its directory`)
    const claudeGate = frontmatter['disable-model-invocation'] === 'true'
    const policy = readAgentPolicy(skillDirectory)
    const codexGate = policy?.allowImplicitInvocation === false
    assert(claudeGate === codexGate, `${name}: Claude and Codex invocation gates disagree`)
    if (claudeGate) {
      gated.push(name)
      if (policy?.defaultPrompt) {
        assert(new RegExp(`\\$${name}\\b`).test(policy.defaultPrompt),
          `${name}: the default prompt must explicitly name the gated skill`)
      }
    }
  }
  if (inventory) {
    assertDeepEqual(gated.sort(), inventory.explicitOnly,
      `Version ${codex.version} explicit-only inventory changed`)
  }

  for (const prompt of interfaceMetadata.defaultPrompt) {
    const references = [...prompt.matchAll(/\$([a-z0-9-]+)/g)].map((match) => match[1])
    for (const name of references) {
      assert(skillDirectories.includes(name), `Starter prompt names an unknown skill: ${name}`)
      if (gated.includes(name)) {
        assert(prompt.includes(`$${name}`), `Starter prompt must explicitly invoke $${name}`)
      }
    }
  }

  const marketplaces = [
    readJson(resolve(root, '.agents', 'plugins', 'marketplace.json')),
    readJson(resolve(root, '.claude-plugin', 'marketplace.json')),
  ]
  for (const marketplace of marketplaces) {
    assert(marketplace.name === MARKETPLACE_ID, `Marketplace name must be ${MARKETPLACE_ID}`)
    assert(marketplace.interface?.displayName === MARKETPLACE_DISPLAY_NAME,
      `Marketplace display name must be ${MARKETPLACE_DISPLAY_NAME}`)
    assert(Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1,
      'Each marketplace must expose exactly one initial plugin')
    const entry = marketplace.plugins[0]
    assert(entry.name === pluginId, `Marketplace plugin must be ${pluginId}`)
    assert(resolveMarketplaceSource(root, entry) === pluginRoot,
      `Marketplace source must resolve to ./plugins/${pluginId}`)
    assert(entry.policy?.installation === 'AVAILABLE', 'Marketplace installation policy must be AVAILABLE')
    assert(entry.policy?.authentication === 'ON_INSTALL', 'Marketplace authentication policy must be ON_INSTALL')
    assert(entry.category === 'Developer Tools', 'Marketplace category must be Developer Tools')
  }

  if (releaseTag !== undefined) {
    assert(releaseTag === `${pluginId}--v${codex.version}`,
      `Release tag ${releaseTag} does not match plugin version ${codex.version}`)
  }

  const upstreamNotice = readFileSync(resolve(pluginRoot, 'THIRD_PARTY_NOTICES.md'), 'utf8')
  assert(upstreamNotice.includes('Copyright (c) 2026 Matt Pocock'),
    'Third-party notices must include the upstream copyright')
  assert(upstreamNotice.includes('THE SOFTWARE IS PROVIDED "AS IS"'),
    'Third-party notices must contain the complete MIT terms')

  return {
    root,
    pluginRoot,
    skillsRoot,
    codex,
    claude,
    version: codex.version,
    skills: skillDirectories,
    digest: computeContentDigest(pluginRoot),
  }
}
