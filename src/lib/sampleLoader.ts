import { addGarments } from './closet'
import { parseList } from './parser'
import type { GenderKind } from './profile'
import { sampleSections } from './sample'

/** Adds the sample wardrobe to the signed-in person's closet. */
export async function loadSampleWardrobe(gender: GenderKind | null): Promise<number> {
  const drafts = sampleSections(gender).flatMap((s) => parseList(s.items, s.hint).filter((i) => i.recognised).map((i) => i.draft))
  const added = await addGarments(drafts, 'sample')
  return added.length
}
