// Reads a shop link ("https://www.myntra.com/tshirts/roadster/roadster-men-navy-cotton-t-shirt/123/buy")
// into a product name, brand and store, using only the link text itself. Shop pages
// can't be fetched from a browser without a server, and nothing is sent anywhere.

import { parseItem, type ParsedItem } from './parser'

export interface ProductLink {
  url: string
  store: string | null
  brand: string | null
  /** Best guess at the product name, e.g. "Roadster men navy cotton t-shirt". */
  title: string
  item: ParsedItem
}

const STORES: [RegExp, string][] = [
  [/(^|\.)myntra\.com$/, 'Myntra'],
  [/(^|\.)ajio\.com$/, 'AJIO'],
  [/(^|\.)amazon\.[a-z.]+$/, 'Amazon'],
  [/(^|\.)amzn\.[a-z.]+$/, 'Amazon'],
  [/(^|\.)flipkart\.com$/, 'Flipkart'],
  [/(^|\.)nykaafashion\.com$/, 'Nykaa Fashion'],
  [/(^|\.)hm\.com$/, 'H&M'],
  [/(^|\.)zara\.com$/, 'Zara'],
  [/(^|\.)uniqlo\.com$/, 'Uniqlo'],
  [/(^|\.)meesho\.com$/, 'Meesho'],
  [/(^|\.)tatacliq\.com$/, 'Tata CLiQ'],
  [/(^|\.)westside\.com$/, 'Westside'],
  [/(^|\.)lifestylestores\.com$/, 'Lifestyle'],
  [/(^|\.)maxfashion\.in$/, 'Max'],
  [/(^|\.)bewakoof\.com$/, 'Bewakoof'],
  [/(^|\.)snitch\.co\.in$/, 'Snitch'],
  [/(^|\.)thesouledstore\.com$/, 'The Souled Store'],
  [/(^|\.)levi\.[a-z.]+$/, "Levi's"],
  [/(^|\.)nike\.com$/, 'Nike'],
  [/(^|\.)adidas\.[a-z.]+$/, 'Adidas'],
  [/(^|\.)puma\.com$/, 'Puma'],
  [/(^|\.)asos\.com$/, 'ASOS'],
  [/(^|\.)shein\.[a-z.]+$/, 'SHEIN'],
  [/(^|\.)mango\.com$/, 'Mango'],
  [/(^|\.)fabindia\.com$/, 'Fabindia'],
  [/(^|\.)biba\.in$/, 'Biba'],
  [/(^|\.)libas\.in$/, 'Libas'],
  [/(^|\.)manyavar\.com$/, 'Manyavar'],
]

// Path pieces that are never part of a product name.
const JUNK = /^(buy|p|dp|gp|product|products|productpage|item|itm[\w]*|shop|en|in|en_in|en-in|us|uk|ref|s|c|m|w|men|women|kids|clothing|apparel|fashion|html?)$/i

const words = (slug: string) =>
  slug
    .replace(/\.(html?|php|aspx)$/i, '')
    .replace(/[-_+]p?\d{5,}\w*$/i, '') // trailing product numbers like -p04310456
    .replace(/[-_+.]+/g, ' ')
    .replace(/\b\d{4,}\b/g, ' ') // long numbers inside
    .replace(/\s+/g, ' ')
    .trim()

/** Finds the first web link in shared text. */
export function findUrl(text: string): string | null {
  const m = /https?:\/\/[^\s<>"']+/i.exec(text)
  if (!m) return null
  try {
    const u = new URL(m[0].replace(/[),.!?;:]+$/, ''))
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

export function readProductLink(input: string, sharedTitle = ''): ProductLink | null {
  const url = findUrl(input)
  if (!url) return null
  const u = new URL(url)
  const host = u.hostname.replace(/^www\d?\./, '')
  const store = STORES.find(([re]) => re.test(host))?.[1] ?? null

  // Candidate names: whatever text came with the share, then the most wordy piece of the path.
  const extra = (sharedTitle + ' ' + input.replace(url, ''))
    .replace(/\|.*$/, '')
    .replace(new RegExp(`\\b(buy|shop)\\b.*\\bonline\\b.*$`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim()
  const segments = u.pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const slugs = segments.map(words).filter((w) => w && !JUNK.test(w) && /[a-z]{3,}/i.test(w))
  const slug = [...slugs].sort((a, b) => b.split(' ').length - a.split(' ').length)[0] ?? ''

  // Myntra and AJIO put the brand in its own path segment; Amazon and Flipkart start the slug with it.
  let brand: string | null = null
  if (store === 'Myntra' && segments.length >= 3) brand = words(segments[1]!)
  else if (slug && (store === 'Amazon' || store === 'Flipkart' || store === 'AJIO')) brand = slug.split(' ')[0] ?? null
  else if (store && ['Zara', 'H&M', 'Uniqlo', 'Nike', 'Adidas', 'Puma', "Levi's", 'Mango', 'Fabindia', 'Biba', 'Libas', 'Manyavar', 'Snitch', 'Bewakoof'].includes(store)) brand = store
  if (brand) brand = brand.replace(/\b\w/g, (c) => c.toUpperCase())

  let title = extra.length >= 6 ? extra : slug
  // Drop a repeated brand at the start of Myntra slugs ("roadster roadster men …").
  if (brand && title.toLowerCase().startsWith(`${brand.toLowerCase()} ${brand.toLowerCase()}`)) title = title.slice(brand.length + 1)
  title = title.replace(/\b(men|mens|men's|women|womens|women's|unisex|boys|girls)\b/gi, '').replace(/\s+/g, ' ').trim()
  const nice = title ? title[0]!.toUpperCase() + title.slice(1).toLowerCase() : ''
  const item = parseItem(nice || (brand ?? store ?? 'Piece'))
  return { url, store, brand, title: nice, item }
}
