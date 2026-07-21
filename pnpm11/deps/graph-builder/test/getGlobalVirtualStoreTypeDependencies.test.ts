import { expect, test } from '@jest/globals'
import type { LockfileObject } from '@pnpm/lockfile.fs'
import type { DepPath, ProjectId } from '@pnpm/types'

import { getGlobalVirtualStoreTypeDependencies } from '../src/getGlobalVirtualStoreTypeDependencies.js'
import { iteratePkgsForVirtualStore } from '../src/iteratePkgsForVirtualStore.js'

test('adds consumer-provided types for package dependencies and peers', () => {
  const lockfile = {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        dependencies: {
          '@types/react': '@types/react@18.3.3',
          '@types/scope__runtime': '@types/scope__runtime@1.0.0',
        },
      },
    },
    packages: {
      '@types/react@18.3.3': {
        resolution: { integrity: 'sha512-types-react' },
      },
      '@types/scope__runtime@1.0.0': {
        resolution: { integrity: 'sha512-types-runtime' },
      },
      'consumer@1.0.0': {
        peerDependencies: {
          react: '^18.0.0',
        },
        dependencies: {
          '@scope/runtime': '1.0.0',
        },
        resolution: { integrity: 'sha512-consumer' },
      },
    },
  } as unknown as LockfileObject

  expect(getGlobalVirtualStoreTypeDependencies(lockfile, {
    importerIds: ['.' as ProjectId],
    include: { dependencies: true, devDependencies: true, optionalDependencies: true },
  }).get('consumer@1.0.0' as DepPath)).toEqual({
    '@types/react': '@types/react@18.3.3',
    '@types/scope__runtime': '@types/scope__runtime@1.0.0',
  })
})

test('ignores type packages excluded from the install', () => {
  const lockfile = {
    lockfileVersion: '9.0',
    importers: {
      '.': {
        devDependencies: {
          '@types/react': '@types/react@18.3.3',
        },
      },
    },
    packages: {
      '@types/react@18.3.3': {
        resolution: { integrity: 'sha512-types-react' },
      },
      'consumer@1.0.0': {
        peerDependencies: {
          react: '^18.0.0',
        },
        resolution: { integrity: 'sha512-consumer' },
      },
    },
  } as unknown as LockfileObject

  expect(getGlobalVirtualStoreTypeDependencies(lockfile, {
    importerIds: ['.' as ProjectId],
    include: { dependencies: true, devDependencies: false, optionalDependencies: true },
  })).toEqual(new Map())
})

test('consumer-provided types are included in global virtual store hashes', () => {
  const getConsumerDir = (typesVersion: string): string => {
    const typesDepPath = `@types/react@${typesVersion}` as DepPath
    const lockfile = {
      lockfileVersion: '9.0',
      importers: {
        '.': {
          devDependencies: {
            '@types/react': typesDepPath,
          },
        },
      },
      packages: {
        [typesDepPath]: {
          resolution: { integrity: `sha512-types-react-${typesVersion}` },
        },
        'consumer@1.0.0': {
          peerDependencies: {
            react: '^18.0.0',
          },
          resolution: { integrity: 'sha512-consumer' },
        },
      },
    } as unknown as LockfileObject
    const consumer = Array.from(iteratePkgsForVirtualStore(lockfile, {
      enableGlobalVirtualStore: true,
      globalVirtualStoreDir: '/store/links',
      importerIds: ['.' as ProjectId],
      include: { dependencies: true, devDependencies: true, optionalDependencies: true },
      virtualStoreDir: '/project/node_modules/.pnpm',
      virtualStoreDirMaxLength: 120,
    })).find(({ pkgMeta }) => pkgMeta.depPath === 'consumer@1.0.0')
    return consumer!.dirInVirtualStore
  }

  expect(getConsumerDir('18.3.3')).not.toBe(getConsumerDir('18.3.4'))
})
