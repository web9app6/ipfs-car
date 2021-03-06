import last from 'it-last'
import pipe from 'it-pipe'

import { CarWriter } from '@ipld/car'
import { importer } from 'ipfs-unixfs-importer'
import normalizeAddInput from 'ipfs-core-utils/src/files/normalise-input/index.js'
import type { ImportCandidateStream } from 'ipfs-core-types/src/utils'
import type { MultihashHasher } from 'multiformats/hashes/interface'
export type { ImportCandidateStream }

import { Blockstore } from '../blockstore/index'
import { MemoryBlockStore } from '../blockstore/memory'
import { unixfsImporterOptionsDefault } from './constants'

export type PackProperties = {
  input: ImportCandidateStream,
  blockstore?: Blockstore,
  maxChunkSize?: number,
  maxChildrenPerNode?: number,
  wrapWithDirectory?: boolean,
  hasher?: MultihashHasher
}

export async function pack ({ input, blockstore: userBlockstore, hasher, maxChunkSize, maxChildrenPerNode, wrapWithDirectory }: PackProperties) {
  if (!input || (Array.isArray(input) && !input.length)) {
    throw new Error('missing input file(s)')
  }

  const blockstore = userBlockstore ? userBlockstore : new MemoryBlockStore()

  // Consume the source
  const rootEntry = await last(pipe(
    normalizeAddInput(input),
    (source: any) => importer(source, blockstore, {
      ...unixfsImporterOptionsDefault,
      hasher: hasher || unixfsImporterOptionsDefault.hasher,
      maxChunkSize: maxChunkSize || unixfsImporterOptionsDefault.maxChunkSize,
      maxChildrenPerNode: maxChildrenPerNode || unixfsImporterOptionsDefault.maxChildrenPerNode,
      wrapWithDirectory: wrapWithDirectory === false ? false : unixfsImporterOptionsDefault.wrapWithDirectory
    })
  ))

  if (!rootEntry || !rootEntry.cid) {
    throw new Error('given input could not be parsed correctly')
  }

  const root = rootEntry.cid

  const { writer, out } = await CarWriter.create([root])

  for await (const block of blockstore.blocks()) {
    writer.put(block)
  }

  writer.close()

  if (!userBlockstore) {
    await blockstore.close()
  }

  return { root, out }
}
