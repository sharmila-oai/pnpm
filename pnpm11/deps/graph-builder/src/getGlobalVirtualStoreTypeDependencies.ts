import * as dp from '@pnpm/deps.path'
import type { IncludedDependencies } from '@pnpm/installing.modules-yaml'
import type { LockfileObject, PackageSnapshot } from '@pnpm/lockfile.fs'
import type { DepPath, ProjectId } from '@pnpm/types'

export function getGlobalVirtualStoreTypeDependencies (
  lockfile: LockfileObject,
  opts: {
    importerIds: ProjectId[]
    include: IncludedDependencies
  }
): Map<DepPath, Record<string, DepPath>> {
  const providedTypes = getProvidedTypes(lockfile, opts)
  const typeDependenciesByDepPath = new Map<DepPath, Record<string, DepPath>>()

  for (const [depPath, pkgSnapshot] of Object.entries(lockfile.packages ?? {}) as Array<[DepPath, PackageSnapshot]>) {
    const dependencyAliases = new Set([
      ...Object.keys(pkgSnapshot.dependencies ?? {}),
      ...Object.keys(pkgSnapshot.optionalDependencies ?? {}),
      ...Object.keys(pkgSnapshot.peerDependencies ?? {}),
    ])
    const typeDependencies: Record<string, DepPath> = {}
    for (const alias of Array.from(dependencyAliases).sort()) {
      const typesAlias = toTypesPackageName(alias)
      const typesDepPath = typesAlias == null ? undefined : providedTypes[typesAlias]
      if (
        typesAlias == null ||
        typesDepPath == null ||
        typesDepPath === depPath ||
        dependencyAliases.has(typesAlias)
      ) {
        continue
      }
      typeDependencies[typesAlias] = typesDepPath
    }
    if (Object.keys(typeDependencies).length > 0) {
      typeDependenciesByDepPath.set(depPath, typeDependencies)
    }
  }

  return typeDependenciesByDepPath
}

function getProvidedTypes (
  lockfile: LockfileObject,
  opts: {
    importerIds: ProjectId[]
    include: IncludedDependencies
  }
): Record<string, DepPath> {
  const providedTypes: Record<string, DepPath> = {}
  const importerIds = [...opts.importerIds].sort((left, right) => {
    if (left === '.') return -1
    if (right === '.') return 1
    return left < right ? -1 : left > right ? 1 : 0
  })

  for (const importerId of importerIds) {
    const importer = lockfile.importers[importerId]
    const dependencies = {
      ...(opts.include.devDependencies ? importer.devDependencies : {}),
      ...(opts.include.dependencies ? importer.dependencies : {}),
      ...(opts.include.optionalDependencies ? importer.optionalDependencies : {}),
    }
    for (const alias of Object.keys(dependencies).sort()) {
      if (!alias.startsWith('@types/') || providedTypes[alias] != null) continue
      const depPath = dp.refToRelative(dependencies[alias], alias)
      if (depPath != null && lockfile.packages?.[depPath] != null) {
        providedTypes[alias] = depPath
      }
    }
  }

  return providedTypes
}

function toTypesPackageName (alias: string): string | undefined {
  if (alias.startsWith('@types/')) return undefined
  if (!alias.startsWith('@')) return `@types/${alias}`
  const separatorIndex = alias.indexOf('/')
  if (separatorIndex === -1) return undefined
  return `@types/${alias.slice(1, separatorIndex)}__${alias.slice(separatorIndex + 1)}`
}
