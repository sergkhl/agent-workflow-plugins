#!/usr/bin/env node

import { randomUUID } from 'node:crypto'
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  rmdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import {
  CATALOG_REPOSITORY_URL,
  PLUGIN_ID,
  computeContentDigest,
  listSkillDirectories,
  readJson,
  validateCatalog,
} from './lib/catalog-contract.mjs'

const LOCK_SCHEMA_VERSION = 1
const CLAUDE_LINK = { path: '.claude/skills', target: '../.agents/skills' }

const usage = `Usage:
  node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core --ref <tag> [--source <catalog>] --apply
  node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core --check
  node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core --ref <tag> [--source <catalog>] --update --apply
  node scripts/install-repository.mjs --repo <root> --plugin agent-workflow-core --uninstall --apply

Omit --apply from install, update, or uninstall to perform a read-only preflight.`

function fail(message) {
  throw new Error(message)
}

function assert(condition, message) {
  if (!condition) fail(message)
}

function pathType(path) {
  if (!existsSync(path) && !isSymbolicLink(path)) return 'missing'
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return 'symlink'
  if (stat.isDirectory()) return 'directory'
  if (stat.isFile()) return 'file'
  return 'other'
}

function isSymbolicLink(path) {
  try {
    return lstatSync(path).isSymbolicLink()
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

function run(command, args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (result.error) throw result.error
  if (!allowFailure && result.status !== 0) {
    const details = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`${command} ${args.join(' ')} failed${details ? `:\n${details}` : ''}`)
  }
  return result
}

function git(args, cwd) {
  return run('git', args, { cwd }).stdout.trim()
}

function validateGitRoot(input, label) {
  const path = realpathSync(resolve(input))
  assert(lstatSync(path).isDirectory(), `${label} is not a directory: ${path}`)
  const topLevel = git(['rev-parse', '--show-toplevel'], path)
  assert(realpathSync(topLevel) === path, `${label} must be the Git repository root: ${path}`)
  return path
}

function ensureImmutableReleaseTag(pluginId, releaseTag) {
  const escaped = pluginId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  assert(new RegExp(`^${escaped}--v\\d+\\.\\d+\\.\\d+$`).test(releaseTag),
    `--ref must be an immutable ${pluginId} release tag, for example ${pluginId}--v0.1.0`)
}

function runCatalogContractTests(catalogRoot) {
  const result = run(process.execPath, ['--test', 'scripts/test/plugin-contract.test.mjs'], {
    cwd: catalogRoot,
    allowFailure: true,
  })
  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    fail(`Catalog contract tests failed before consumer preflight${output ? `:\n${output}` : ''}`)
  }
}

function prepareCatalogSource({ source, releaseTag, pluginId }) {
  let catalogRoot
  let temporaryRoot = null

  if (source) {
    catalogRoot = validateGitRoot(source, 'Catalog source')
    const status = git(['status', '--porcelain=v1', '--untracked-files=all'], catalogRoot)
    assert(status === '', 'Catalog --source must be a clean Git checkout')
  } else {
    temporaryRoot = mkdtempSync(join(tmpdir(), 'agent-workflow-catalog-'))
    catalogRoot = resolve(temporaryRoot, 'catalog')
    run('git', [
      'clone',
      '--quiet',
      '--depth', '1',
      '--single-branch',
      '--branch', releaseTag,
      CATALOG_REPOSITORY_URL,
      catalogRoot,
    ])
  }

  try {
    const commitSha = git(['rev-parse', 'HEAD'], catalogRoot)
    const taggedCommit = git(['rev-parse', `${releaseTag}^{commit}`], catalogRoot)
    assert(commitSha === taggedCommit,
      `Catalog checkout HEAD ${commitSha} does not match release tag ${releaseTag} (${taggedCommit})`)
    const snapshot = validateCatalog(catalogRoot, { pluginId, releaseTag })
    runCatalogContractTests(catalogRoot)
    return {
      ...snapshot,
      commitSha,
      releaseTag,
      cleanup() {
        if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
      },
    }
  } catch (error) {
    if (temporaryRoot) rmSync(temporaryRoot, { recursive: true, force: true })
    throw error
  }
}

function repositoryPaths(repositoryRoot, pluginId) {
  return {
    repositoryRoot,
    agents: resolve(repositoryRoot, '.agents'),
    plugins: resolve(repositoryRoot, '.agents', 'plugins'),
    skills: resolve(repositoryRoot, '.agents', 'skills'),
    vendor: resolve(repositoryRoot, '.agents', 'plugins', pluginId),
    lock: resolve(repositoryRoot, '.agents', 'plugins', `${pluginId}.vendor.json`),
    claude: resolve(repositoryRoot, '.claude'),
    claudeSkills: resolve(repositoryRoot, '.claude', 'skills'),
  }
}

function ensureDirectoryOrMissing(path, label) {
  const type = pathType(path)
  assert(type === 'missing' || type === 'directory', `${label} must be a real directory; found ${type}: ${path}`)
}

function validateRepositoryAnchors(paths) {
  ensureDirectoryOrMissing(paths.agents, '.agents')
  ensureDirectoryOrMissing(paths.plugins, '.agents/plugins')
  ensureDirectoryOrMissing(paths.skills, '.agents/skills')
  ensureDirectoryOrMissing(paths.claude, '.claude')
}

function managedLinksForSkills(skills, pluginId = PLUGIN_ID) {
  const links = skills.map((name) => ({
    path: `.agents/skills/${name}`,
    target: `../plugins/${pluginId}/skills/${name}`,
  }))
  links.push(CLAUDE_LINK)
  return links.sort((left, right) => left.path.localeCompare(right.path, 'en'))
}

function lockForSnapshot(snapshot) {
  return {
    schemaVersion: LOCK_SCHEMA_VERSION,
    repositoryUrl: CATALOG_REPOSITORY_URL,
    pluginId: snapshot.codex.name,
    releaseTag: snapshot.releaseTag,
    commitSha: snapshot.commitSha,
    pluginVersion: snapshot.version,
    contentDigest: snapshot.digest,
    managedSymlinks: managedLinksForSkills(snapshot.skills, snapshot.codex.name),
  }
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function validateManagedLinkShape(link, pluginId) {
  assert(link && typeof link.path === 'string' && typeof link.target === 'string',
    'Every managedSymlinks entry must contain string path and target fields')
  if (link.path === CLAUDE_LINK.path) {
    assert(link.target === CLAUDE_LINK.target, '.claude/skills has an unexpected lock target')
    return
  }
  const match = /^\.agents\/skills\/([a-z0-9-]+)$/.exec(link.path)
  assert(match, `Unsafe managed symlink path in lock: ${link.path}`)
  assert(link.target === `../plugins/${pluginId}/skills/${match[1]}`,
    `Unexpected managed symlink target in lock: ${link.path} -> ${link.target}`)
}

function validateLock(lock, pluginId) {
  assert(lock && typeof lock === 'object' && !Array.isArray(lock), 'Vendor lock must be a JSON object')
  assert(lock.schemaVersion === LOCK_SCHEMA_VERSION,
    `Unsupported vendor lock schema: ${lock.schemaVersion}`)
  assert(lock.repositoryUrl === CATALOG_REPOSITORY_URL, 'Vendor lock repository URL is not canonical')
  assert(lock.pluginId === pluginId, `Vendor lock plugin ID must be ${pluginId}`)
  assert(typeof lock.releaseTag === 'string', 'Vendor lock releaseTag is required')
  ensureImmutableReleaseTag(pluginId, lock.releaseTag)
  assert(lock.releaseTag === `${pluginId}--v${lock.pluginVersion}`,
    'Vendor lock tag and plugin version disagree')
  assert(/^[0-9a-f]{40}$/.test(lock.commitSha), 'Vendor lock commitSha must be an exact 40-character SHA')
  assert(/^sha256:[0-9a-f]{64}$/.test(lock.contentDigest), 'Vendor lock contentDigest must be SHA-256')
  assert(Array.isArray(lock.managedSymlinks), 'Vendor lock managedSymlinks must be an array')
  for (const link of lock.managedSymlinks) validateManagedLinkShape(link, pluginId)
  const sorted = [...lock.managedSymlinks].sort((left, right) => left.path.localeCompare(right.path, 'en'))
  assert(JSON.stringify(sorted) === JSON.stringify(lock.managedSymlinks),
    'Vendor lock managedSymlinks must be deterministic and sorted')
  assert(new Set(lock.managedSymlinks.map((link) => link.path)).size === lock.managedSymlinks.length,
    'Vendor lock contains duplicate managed symlink paths')
  assert(lock.managedSymlinks.some((link) => link.path === CLAUDE_LINK.path),
    'Vendor lock must manage .claude/skills')
  return lock
}

function readVendorLock(paths, pluginId) {
  assert(pathType(paths.lock) === 'file', `Missing vendor lock: ${paths.lock}`)
  return validateLock(readJson(paths.lock), pluginId)
}

function assertExactSymlink(repositoryRoot, link, { mustResolve = false } = {}) {
  const path = resolve(repositoryRoot, link.path)
  const type = pathType(path)
  assert(type === 'symlink', `${link.path} must be a symlink; found ${type}`)
  const actualTarget = readlinkSync(path)
  assert(actualTarget === link.target,
    `${link.path} points to ${actualTarget}; expected ${link.target}`)
  if (mustResolve) {
    try {
      realpathSync(path)
    } catch {
      fail(`${link.path} is a broken symlink (${link.target})`)
    }
  }
}

function assertLinkAvailable(repositoryRoot, link) {
  const path = resolve(repositoryRoot, link.path)
  const type = pathType(path)
  if (type === 'missing') return 'missing'
  if (type === 'symlink' && readlinkSync(path) === link.target) return 'exact'
  const detail = type === 'symlink' ? `symlink to ${readlinkSync(path)}` : type
  fail(`${link.path} is occupied by ${detail}; expected ${link.target}. No changes were made.`)
}

function ensurePathInside(repositoryRoot, path) {
  const rel = relative(repositoryRoot, path)
  assert(rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`),
    `Refusing to mutate a path outside the consumer repository: ${path}`)
}

function atomicWriteJson(path, value) {
  const temporary = `${path}.tmp-${randomUUID()}`
  writeFileSync(temporary, stableJson(value), { encoding: 'utf8', flag: 'wx' })
  try {
    renameSync(temporary, path)
  } catch (error) {
    rmSync(temporary, { force: true })
    throw error
  }
}

function makeDirectory(path, createdDirectories) {
  if (pathType(path) === 'directory') return
  mkdirSync(path)
  createdDirectories.push(path)
}

function removeEmptyCreatedDirectories(createdDirectories) {
  for (const path of [...createdDirectories].reverse()) {
    try {
      if (readdirSync(path).length === 0) rmdirSync(path)
    } catch {
      // A failed rollback must preserve anything another process added concurrently.
    }
  }
}

export function defaultSymlinkProbe(repositoryRoot, createSymlink = symlinkSync) {
  let probeRoot
  try {
    probeRoot = mkdtempSync(resolve(repositoryRoot, '.agent-workflow-symlink-probe-'))
    const target = resolve(probeRoot, 'target')
    const link = resolve(probeRoot, 'link')
    mkdirSync(target)
    createSymlink('target', link, 'dir')
    assert(realpathSync(link) === target, 'Symlink probe did not resolve to its target')
  } catch (error) {
    const remediation = process.platform === 'win32'
      ? 'Enable Windows Developer Mode or grant Create symbolic links permission, then retry.'
      : 'Grant symlink permission on the consumer filesystem, then retry.'
    fail(`Repository installation requires real directory symlinks and never falls back to copies. ${remediation} (${error.message})`)
  } finally {
    if (probeRoot) rmSync(probeRoot, { recursive: true, force: true })
  }
}

function pluginManifestsAt(vendor) {
  return {
    codex: readJson(resolve(vendor, '.codex-plugin', 'plugin.json')),
    claude: readJson(resolve(vendor, '.claude-plugin', 'plugin.json')),
  }
}

export function verifyInstalledRepository(repositoryRootInput, pluginId = PLUGIN_ID) {
  const repositoryRoot = validateGitRoot(repositoryRootInput, 'Consumer repository')
  const paths = repositoryPaths(repositoryRoot, pluginId)
  validateRepositoryAnchors(paths)
  assert(pathType(paths.skills) === 'directory', '.agents/skills must be a real directory')
  assert(pathType(paths.vendor) === 'directory', `Missing vendored plugin: ${paths.vendor}`)
  const lock = readVendorLock(paths, pluginId)
  for (const link of lock.managedSymlinks) {
    assertExactSymlink(repositoryRoot, link, { mustResolve: true })
  }
  const actualDigest = computeContentDigest(paths.vendor)
  assert(actualDigest === lock.contentDigest,
    `Vendored plugin has local modifications: ${actualDigest} does not match ${lock.contentDigest}`)

  const manifests = pluginManifestsAt(paths.vendor)
  for (const manifest of [manifests.codex, manifests.claude]) {
    assert(manifest.name === pluginId, `Vendored manifest name must be ${pluginId}`)
    assert(manifest.version === lock.pluginVersion,
      `Vendored manifest version ${manifest.version} does not match lock ${lock.pluginVersion}`)
    assert(manifest.repository === lock.repositoryUrl, 'Vendored manifest repository does not match lock')
  }
  assert(manifests.codex.skills === './skills/', 'Vendored Codex manifest must discover ./skills/')

  const skills = listSkillDirectories(resolve(paths.vendor, 'skills'))
  const expectedLinks = managedLinksForSkills(skills, pluginId)
  assert(JSON.stringify(expectedLinks) === JSON.stringify(lock.managedSymlinks),
    'Vendor lock managed-link inventory does not match the vendored skill inventory')

  return { repositoryRoot, paths, lock, manifests, skills, digest: actualDigest }
}

function stagePlugin(snapshot, paths) {
  const stage = resolve(paths.plugins, `.${snapshot.codex.name}.stage-${randomUUID()}`)
  ensurePathInside(paths.repositoryRoot, stage)
  cpSync(snapshot.pluginRoot, stage, { recursive: true, dereference: false, errorOnExist: true })
  assert(computeContentDigest(stage) === snapshot.digest, 'Staged plugin digest changed during copy')
  return stage
}

function preflightFreshInstall(repositoryRoot, paths, snapshot) {
  validateRepositoryAnchors(paths)
  const desiredLock = lockForSnapshot(snapshot)
  const lockType = pathType(paths.lock)

  if (lockType !== 'missing') {
    assert(lockType === 'file', `Vendor lock path is occupied by ${lockType}: ${paths.lock}`)
    const installed = verifyInstalledRepository(repositoryRoot, snapshot.codex.name)
    const same = installed.lock.releaseTag === desiredLock.releaseTag
      && installed.lock.commitSha === desiredLock.commitSha
      && installed.lock.contentDigest === desiredLock.contentDigest
      && JSON.stringify(installed.lock.managedSymlinks) === JSON.stringify(desiredLock.managedSymlinks)
    assert(same, `A different ${snapshot.codex.name} release is installed; use --update`)
    return { desiredLock, alreadyInstalled: true, missingLinks: [] }
  }

  const vendorType = pathType(paths.vendor)
  assert(vendorType === 'missing' || vendorType === 'directory',
    `Vendored plugin path is occupied by ${vendorType}: ${paths.vendor}`)
  if (vendorType === 'directory') {
    const digest = computeContentDigest(paths.vendor)
    assert(digest === snapshot.digest,
      `Existing unregistered vendor tree differs from ${snapshot.releaseTag}; refusing to overwrite it`)
  }

  const missingLinks = []
  for (const link of desiredLock.managedSymlinks) {
    if (assertLinkAvailable(repositoryRoot, link) === 'missing') missingLinks.push(link)
  }
  return { desiredLock, alreadyInstalled: false, missingLinks, adoptVendor: vendorType === 'directory' }
}

function applyFreshInstall(repositoryRoot, paths, snapshot, preflight) {
  const createdDirectories = []
  const createdLinks = []
  let stagedPlugin = null
  let vendorCreated = false
  let lockCreated = false

  try {
    makeDirectory(paths.agents, createdDirectories)
    makeDirectory(paths.plugins, createdDirectories)
    makeDirectory(paths.skills, createdDirectories)
    makeDirectory(paths.claude, createdDirectories)

    if (!preflight.adoptVendor) {
      stagedPlugin = stagePlugin(snapshot, paths)
      renameSync(stagedPlugin, paths.vendor)
      stagedPlugin = null
      vendorCreated = true
    }

    for (const link of preflight.missingLinks) {
      const path = resolve(repositoryRoot, link.path)
      assert(pathType(path) === 'missing', `${link.path} changed after preflight`)
      symlinkSync(link.target, path, 'dir')
      createdLinks.push(link)
    }

    atomicWriteJson(paths.lock, preflight.desiredLock)
    lockCreated = true
    verifyInstalledRepository(repositoryRoot, snapshot.codex.name)
  } catch (error) {
    if (lockCreated) rmSync(paths.lock, { force: true })
    for (const link of [...createdLinks].reverse()) {
      const path = resolve(repositoryRoot, link.path)
      if (pathType(path) === 'symlink' && readlinkSync(path) === link.target) unlinkSync(path)
    }
    if (vendorCreated) rmSync(paths.vendor, { recursive: true, force: true })
    if (stagedPlugin) rmSync(stagedPlugin, { recursive: true, force: true })
    removeEmptyCreatedDirectories(createdDirectories)
    throw error
  }
}

function preflightUpdate(repositoryRoot, paths, snapshot) {
  const installed = verifyInstalledRepository(repositoryRoot, snapshot.codex.name)
  const desiredLock = lockForSnapshot(snapshot)
  if (JSON.stringify(installed.lock) === JSON.stringify(desiredLock)) {
    return { installed, desiredLock, alreadyInstalled: true, staleLinks: [], newLinks: [] }
  }

  const oldByPath = new Map(installed.lock.managedSymlinks.map((link) => [link.path, link]))
  const newByPath = new Map(desiredLock.managedSymlinks.map((link) => [link.path, link]))
  const staleLinks = installed.lock.managedSymlinks.filter((link) => !newByPath.has(link.path))
  const addedLinks = desiredLock.managedSymlinks.filter((link) => !oldByPath.has(link.path))
  const newLinks = []

  for (const link of staleLinks) assertExactSymlink(repositoryRoot, link, { mustResolve: true })
  for (const link of addedLinks) {
    if (assertLinkAvailable(repositoryRoot, link) === 'missing') newLinks.push(link)
  }
  for (const link of desiredLock.managedSymlinks.filter((link) => oldByPath.has(link.path))) {
    assertExactSymlink(repositoryRoot, link, { mustResolve: true })
  }
  return { installed, desiredLock, alreadyInstalled: false, staleLinks, newLinks }
}

function applyUpdate(repositoryRoot, paths, snapshot, preflight) {
  const token = randomUUID()
  const vendorBackup = resolve(paths.plugins, `.${snapshot.codex.name}.backup-${token}`)
  const lockBackup = `${paths.lock}.backup-${token}`
  const createdLinks = []
  const removedLinks = []
  let stagedPlugin = null
  let vendorSwapped = false
  let lockSwapped = false
  let completed = false

  try {
    stagedPlugin = stagePlugin(snapshot, paths)
    renameSync(paths.vendor, vendorBackup)
    renameSync(stagedPlugin, paths.vendor)
    stagedPlugin = null
    vendorSwapped = true

    for (const link of preflight.staleLinks) {
      assertExactSymlink(repositoryRoot, link)
      unlinkSync(resolve(repositoryRoot, link.path))
      removedLinks.push(link)
    }
    for (const link of preflight.newLinks) {
      const path = resolve(repositoryRoot, link.path)
      assert(pathType(path) === 'missing', `${link.path} changed after preflight`)
      symlinkSync(link.target, path, 'dir')
      createdLinks.push(link)
    }

    renameSync(paths.lock, lockBackup)
    atomicWriteJson(paths.lock, preflight.desiredLock)
    lockSwapped = true
    verifyInstalledRepository(repositoryRoot, snapshot.codex.name)
    completed = true
  } catch (error) {
    if (completed) throw error
    if (lockSwapped) rmSync(paths.lock, { force: true })
    if (existsSync(lockBackup)) renameSync(lockBackup, paths.lock)
    for (const link of [...createdLinks].reverse()) {
      const path = resolve(repositoryRoot, link.path)
      if (pathType(path) === 'symlink' && readlinkSync(path) === link.target) unlinkSync(path)
    }
    for (const link of removedLinks) {
      const path = resolve(repositoryRoot, link.path)
      if (pathType(path) === 'missing') symlinkSync(link.target, path, 'dir')
    }
    if (vendorSwapped) {
      rmSync(paths.vendor, { recursive: true, force: true })
      if (existsSync(vendorBackup)) renameSync(vendorBackup, paths.vendor)
    }
    if (stagedPlugin) rmSync(stagedPlugin, { recursive: true, force: true })
    throw error
  }

  rmSync(vendorBackup, { recursive: true, force: true })
  rmSync(lockBackup, { force: true })
}

function applyUninstall(repositoryRoot, paths, installed) {
  const token = randomUUID()
  const vendorBackup = resolve(paths.plugins, `.${installed.lock.pluginId}.uninstall-${token}`)
  const lockBackup = `${paths.lock}.uninstall-${token}`
  const removedLinks = []
  let vendorMoved = false
  let lockMoved = false
  let completed = false

  try {
    renameSync(paths.vendor, vendorBackup)
    vendorMoved = true
    renameSync(paths.lock, lockBackup)
    lockMoved = true

    for (const link of installed.lock.managedSymlinks) {
      assertExactSymlink(repositoryRoot, link)
      unlinkSync(resolve(repositoryRoot, link.path))
      removedLinks.push(link)
    }
    completed = true
  } catch (error) {
    if (completed) throw error
    for (const link of removedLinks) {
      const path = resolve(repositoryRoot, link.path)
      if (pathType(path) === 'missing') symlinkSync(link.target, path, 'dir')
    }
    if (lockMoved && existsSync(lockBackup)) renameSync(lockBackup, paths.lock)
    if (vendorMoved && existsSync(vendorBackup)) renameSync(vendorBackup, paths.vendor)
    throw error
  }

  rmSync(vendorBackup, { recursive: true, force: true })
  rmSync(lockBackup, { force: true })
}

export function installRepository(options, dependencies = {}) {
  const pluginId = options.pluginId ?? options.plugin
  assert(pluginId === PLUGIN_ID, `Only ${PLUGIN_ID} is currently supported`)
  const operation = options.operation ?? 'install'
  assert(['install', 'check', 'update', 'uninstall'].includes(operation), `Unknown operation: ${operation}`)
  const apply = options.apply === true
  if (operation === 'check') assert(!apply, '--check is always read-only and cannot be combined with --apply')

  const repositoryRoot = validateGitRoot(options.repositoryRoot ?? options.repo, 'Consumer repository')
  const paths = repositoryPaths(repositoryRoot, pluginId)

  if (operation === 'check') {
    const installed = verifyInstalledRepository(repositoryRoot, pluginId)
    return {
      operation,
      applied: false,
      message: `${pluginId} ${installed.lock.pluginVersion} is healthy at ${installed.lock.commitSha}`,
      lock: installed.lock,
    }
  }

  if (operation === 'uninstall') {
    const installed = verifyInstalledRepository(repositoryRoot, pluginId)
    if (apply) applyUninstall(repositoryRoot, paths, installed)
    return {
      operation,
      applied: apply,
      message: apply
        ? `Uninstalled ${pluginId} without removing repository skill directories`
        : `Uninstall preflight passed for ${pluginId}; rerun with --apply to remove managed content`,
      lock: installed.lock,
    }
  }

  assert(typeof options.releaseTag === 'string' && options.releaseTag.length > 0,
    'Install and update require --ref <release-tag>')
  ensureImmutableReleaseTag(pluginId, options.releaseTag)

  // Catalog validation and its contract test intentionally happen before any consumer probe or write.
  const snapshot = prepareCatalogSource({
    source: options.source,
    releaseTag: options.releaseTag,
    pluginId,
  })
  try {
    const preflight = operation === 'update'
      ? preflightUpdate(repositoryRoot, paths, snapshot)
      : preflightFreshInstall(repositoryRoot, paths, snapshot)

    if (preflight.alreadyInstalled) {
      return {
        operation,
        applied: false,
        message: `${pluginId} ${snapshot.version} is already installed exactly`,
        lock: preflight.desiredLock,
      }
    }

    const linksToCreate = operation === 'update' ? preflight.newLinks : preflight.missingLinks
    if (linksToCreate.length > 0) {
      const probe = dependencies.symlinkProbe ?? defaultSymlinkProbe
      probe(repositoryRoot)
    }

    if (apply) {
      if (operation === 'update') applyUpdate(repositoryRoot, paths, snapshot, preflight)
      else applyFreshInstall(repositoryRoot, paths, snapshot, preflight)
    }

    return {
      operation,
      applied: apply,
      message: apply
        ? `${operation === 'update' ? 'Updated' : 'Installed'} ${pluginId} ${snapshot.version} from ${snapshot.commitSha}`
        : `${operation === 'update' ? 'Update' : 'Install'} preflight passed for ${pluginId} ${snapshot.version}; rerun with --apply`,
      lock: preflight.desiredLock,
    }
  } finally {
    snapshot.cleanup()
  }
}

export function parseArguments(argv) {
  const values = {}
  const switches = new Set()
  const valueFlags = new Set(['--repo', '--plugin', '--ref', '--source'])
  const switchFlags = new Set(['--apply', '--check', '--update', '--uninstall', '--help'])

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (valueFlags.has(flag)) {
      assert(values[flag] === undefined, `Duplicate option: ${flag}`)
      const value = argv[index + 1]
      assert(value && !value.startsWith('--'), `Missing value for ${flag}`)
      values[flag] = value
      index += 1
    } else if (switchFlags.has(flag)) {
      assert(!switches.has(flag), `Duplicate option: ${flag}`)
      switches.add(flag)
    } else {
      fail(`Unknown option: ${flag}\n\n${usage}`)
    }
  }

  if (switches.has('--help')) return { help: true }
  assert(values['--repo'], `--repo is required\n\n${usage}`)
  assert(values['--plugin'], `--plugin is required\n\n${usage}`)
  const operations = ['--check', '--update', '--uninstall'].filter((flag) => switches.has(flag))
  assert(operations.length <= 1, 'Choose only one of --check, --update, or --uninstall')
  const operation = switches.has('--check')
    ? 'check'
    : switches.has('--update')
      ? 'update'
      : switches.has('--uninstall')
        ? 'uninstall'
        : 'install'
  const apply = switches.has('--apply')
  if (operation === 'check') assert(!apply, '--check cannot be combined with --apply')
  if (operation === 'check' || operation === 'uninstall') {
    assert(values['--ref'] === undefined, `${operations[0]} does not accept --ref`)
    assert(values['--source'] === undefined, `${operations[0]} does not accept --source`)
  } else {
    assert(values['--ref'], `${operation} requires --ref <release-tag>`)
  }

  return {
    repositoryRoot: values['--repo'],
    pluginId: values['--plugin'],
    releaseTag: values['--ref'],
    source: values['--source'],
    operation,
    apply,
  }
}

function runCli() {
  try {
    const options = parseArguments(process.argv.slice(2))
    if (options.help) {
      console.log(usage)
      return
    }
    const result = installRepository(options)
    console.log(result.message)
    if (result.lock) {
      console.log(`${result.lock.releaseTag} ${result.lock.commitSha} ${result.lock.contentDigest}`)
    }
  } catch (error) {
    console.error(`agent-workflow repository installer: ${error.message}`)
    process.exitCode = 1
  }
}

const invokedPath = process.argv[1] ? realpathSync(process.argv[1]) : null
if (invokedPath === fileURLToPath(import.meta.url)) runCli()
