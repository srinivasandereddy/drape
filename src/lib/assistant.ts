// The stylist assistant. It understands everyday requests and answers from the
// person's own closet, weather and profile. It runs entirely on the phone with
// plain rules: no AI service, nothing sent anywhere.

import { colorName } from './color'
import type { Affinity } from './feedback'
import { parseIntent } from './intent'
import { displayName, dominantHex, inCloset, type Garment } from './model'
import { explain, OCCASIONS, pieceLabel, suggestOutfits, type Outfit, type OutfitContext } from './outfit'
import { colorsInText } from './parser'
import { personalPrefs, preferredMetal, type Profile } from './profile'
import { slotOf } from './slots'
import { matchesFor, spectrumStats } from './spectrum'
import { parseStyles, styleDef, type StyleId } from './styles'
import { datesFromText, type TripDraft } from './trip'
import { describeCode, isRainy, type Weather } from './weather'

export type Reply =
  | { kind: 'text'; text: string }
  | { kind: 'outfit'; text: string; outfit: Outfit; why: string[] }
  | { kind: 'pieces'; text: string; pieces: Garment[] }
  | { kind: 'trip'; text: string; draft: TripDraft; placeQuery: string | null }

export interface AssistantData {
  garments: Garment[]
  profile: Profile
  weather: Weather | null
  affinity: Affinity | null
  now: Date
}

/** What the assistant remembers between messages in one conversation. */
export interface Memory {
  lastOutfit?: { ctx: OutfitContext; index: number }
}

export const SUGGESTIONS = [
  'Outfit for an evening party tonight',
  'Help me pack for a weekend getaway',
  'What goes with my jeans?',
  "What haven't I worn lately?",
  'What should I add to my wardrobe?',
]

const has = (t: string, words: string[]) => words.some((w) => new RegExp(`\\b${w}\\b`).test(t))

function baseCtx(d: AssistantData, extra: Partial<OutfitContext>): OutfitContext {
  return {
    occasion: 'casual',
    routine: d.profile.routine,
    weather: d.weather,
    now: d.now,
    dosha: d.profile.dosha?.primary ?? null,
    styles: d.profile.styles,
    metal: preferredMetal(d.profile),
    personal: personalPrefs(d.profile),
    affinity: d.affinity,
    ...extra,
  }
}

/** Finds the piece a message talks about, e.g. "my navy jeans" or "the rust tee". */
export function findPiece(text: string, garments: Garment[]): Garment | null {
  const t = ` ${text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')} `
  const wanted = colorsInText(text).map(colorName)
  let best: { g: Garment; score: number } | null = null
  for (const g of garments) {
    let score = 0
    const sub = g.subtype.toLowerCase()
    if (sub && (t.includes(` ${sub} `) || t.includes(` ${sub}s `) || (sub === 't-shirt' && /\b(tee|t shirt|tshirt)\b/.test(t)))) score += 3
    const hex = dominantHex(g)
    if (hex && wanted.includes(colorName(hex))) score += 2
    for (const w of g.name.toLowerCase().split(/\s+/)) if (w.length > 2 && t.includes(` ${w} `)) score += 1
    if (score > (best?.score ?? 0)) best = { g, score }
  }
  return best && best.score >= 3 ? best.g : null
}

function outfitReply(d: AssistantData, ctx: OutfitContext, index: number, lead: string): { reply: Reply; memory: Memory } {
  const ideas = suggestOutfits(d.garments, ctx)
  if (ideas.length === 0) {
    return { reply: { kind: 'text', text: 'I need at least a top and a bottom (or a dress) in your closet to build an outfit. Add a few pieces and ask again.' }, memory: {} }
  }
  const outfit = ideas[index % ideas.length]!
  const more = ideas.length > 1 ? ' Say "another" for a different idea.' : ''
  return { reply: { kind: 'outfit', text: `${lead}${more}`, outfit, why: explain(outfit, ctx) }, memory: { lastOutfit: { ctx, index } } }
}

export function respond(text: string, d: AssistantData, memory: Memory): { reply: Reply; memory: Memory } {
  // iPhone keyboards type curly apostrophes (’); treat them like straight ones.
  const t = text.toLowerCase().replace(/[’‘]/g, "'").trim()
  const words = ` ${t.replace(/[^a-z0-9\s']/g, ' ')} `

  if (!t || /^(hi|hello|hey|hola|namaste|help|what can you do|what do you do)\b[\s!?.]*(drape)?[\s!?.]*$/.test(t)) {
    return {
      reply: {
        kind: 'text',
        text: 'I can pick an outfit for any plan ("dinner tonight", "gym", "office presentation"), plan and pack a trip, find what goes with a piece, spot clothes you haven\'t worn, and suggest what to add to your wardrobe. Everything comes from your own closet.',
      },
      memory,
    }
  }

  // "Another one" repeats the last outfit request with the next idea.
  if (memory.lastOutfit && has(t, ['another', 'something else', 'next', 'different', 'more'])) {
    const { ctx, index } = memory.lastOutfit
    return outfitReply(d, ctx, index + 1, 'Here is another idea.')
  }

  // Trips and packing.
  if (has(t, ['pack', 'packing', 'trip', 'getaway', 'vacation', 'holiday', 'travelling', 'traveling']) || /\bgoing to\b.*\bfor\b/.test(t)) {
    const intent = parseIntent(text.replace(/\b(this|next)\s+weekend\b/gi, '').replace(/\bfor\s+\d+\s+(days?|nights?)\b/gi, '').trim())
    const place = intent.place ?? (/\bto\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:for|this|next|on|tomorrow)\b|$)/i.exec(text)?.[1]?.trim() ?? null)
    const dates = datesFromText(text, d.now)
    const vibeStyles = parseStyles(text)
    const activities = [
      ...new Set([
        ...(has(t, ['gym', 'hike', 'hiking', 'trek', 'run', 'workout', 'sports']) ? (['active'] as const) : []),
        ...(has(t, ['party', 'dinner', 'club', 'wedding']) ? (has(t, ['wedding']) ? (['festive'] as const) : (['evening'] as const)) : []),
        ...(has(t, ['work', 'conference', 'meeting', 'business']) ? (['work'] as const) : []),
        'casual' as const,
      ]),
    ]
    const draft: TripDraft = {
      destination: null,
      start: dates?.start ?? '',
      end: dates?.end ?? '',
      vibe: vibeStyles.map((s) => styleDef(s).label).join(', '),
      activities,
    }
    const when = dates ? '' : ' Pick the dates'
    return {
      reply: {
        kind: 'trip',
        text: place
          ? `Let's plan your trip to ${place}.${when ? `${when} and` : ''} I'll check the weather there, pick an outfit for each day and build your packing list.`
          : `Happy to help you pack. Where are you going? I'll check the weather there, pick an outfit for each day and build your packing list.`,
        draft,
        placeQuery: place ? place.replace(/\b\w/g, (c) => c.toUpperCase()) : null,
      },
      memory,
    }
  }

  // What goes with a piece.
  if (/\b(goes? with|go with|match(es)?|pair(s)? with|wear with|style (my|the|this))\b/.test(t)) {
    const piece = findPiece(text, d.garments)
    if (!piece) return { reply: { kind: 'text', text: 'Which piece do you mean? Try naming its color and type, like "my navy jeans" or "the white shirt".' }, memory }
    const matches = matchesFor(piece, d.garments).slice(0, 8)
    return {
      reply: matches.length
        ? { kind: 'pieces', text: `These go well with your ${pieceLabel(piece).toLowerCase()}:`, pieces: matches.map((m) => m.garment) }
        : { kind: 'text', text: `Nothing in your closet pairs clearly with your ${pieceLabel(piece).toLowerCase()} yet. Neutrals like white, black, navy or beige would work.` },
      memory,
    }
  }

  // Forgotten clothes.
  if (/\b(haven'?t\s+(i\s+)?(worn|wore)|didn'?t\s+wear|not\s+worn|never\s+worn|unworn|least\s+worn|rarely|forgot(ten)?|neglected)\b/.test(t)) {
    const DAY = 86_400_000
    const idle = d.garments
      .filter((g) => inCloset(g) && ['top', 'bottom', 'onepiece', 'layer', 'footwear'].includes(slotOf(g)))
      .filter((g) => !g.lastWornAt || d.now.getTime() - Date.parse(g.lastWornAt) > 21 * DAY)
      .sort((a, b) => (a.lastWornAt ?? '') < (b.lastWornAt ?? '') ? -1 : 1)
      .slice(0, 8)
    return {
      reply: idle.length
        ? { kind: 'pieces', text: `You haven't worn these in 3+ weeks (or ever). Tap one to see what it goes with:`, pieces: idle }
        : { kind: 'text', text: "You've worn everything in the last three weeks. Nicely done." },
      memory,
    }
  }

  // Weather.
  if (has(t, ['weather', 'temperature', 'rain', 'raining', 'cold', 'hot', 'umbrella']) && !parseIntent(text).occasion) {
    const w = d.weather
    return {
      reply: {
        kind: 'text',
        text: w
          ? `Right now it's ${Math.round(w.temp)}°C (feels ${Math.round(w.feelsLike)}°), ${describeCode(w.code).toLowerCase()}, between ${Math.round(w.todayMin)}° and ${Math.round(w.todayMax)}° today, ${Math.round(w.rainChance)}% chance of rain.${isRainy(w) ? ' Take an umbrella and closed shoes.' : ''}`
          : 'Add your city in your profile and I can use the weather.',
      },
      memory,
    }
  }

  // Wardrobe gaps and shopping ideas.
  if (/\b(buy|shopping|shop|add to my wardrobe|missing|gaps?|need more|what should i add)\b/.test(t)) {
    const g = d.garments
    const count = (f: (x: Garment) => boolean) => g.filter(f).length
    const ideas: string[] = []
    const neutralTop = count((x) => slotOf(x) === 'top' && ['White', 'Black', 'Grey', 'Light grey', 'Navy', 'Cream'].includes(dominantHex(x) ? colorName(dominantHex(x)!) : ''))
    if (neutralTop < 2) ideas.push('a plain white or black top: it goes with everything')
    if (count((x) => slotOf(x) === 'bottom') < 2) ideas.push('another pair of bottoms, such as dark jeans or neutral trousers')
    if (count((x) => slotOf(x) === 'layer') === 0) ideas.push('a light layer (denim jacket, cardigan or blazer) for cool evenings')
    if (count((x) => x.subtype === 'Sneakers' || x.subtype === 'Running shoes') === 0) ideas.push('clean white sneakers')
    if (d.profile.routine === 'corporate' && count((x) => x.subtype === 'Formal shoes' || x.subtype === 'Loafers') === 0) ideas.push('formal shoes or loafers for the office')
    if (d.profile.styles.some((s) => styleDef(s).group === 'activity') && count((x) => ['Sports tee', 'Running shoes', 'Joggers', 'Leggings'].includes(x.subtype)) < 2)
      ideas.push('basic activewear (a sports tee and running shoes) for your workouts')
    const stats = spectrumStats(g)
    const text = [
      ideas.length ? `Your closet would get the most new outfits from: ${ideas.slice(0, 4).join('; ')}.` : 'Your basics are covered.',
      ...stats.insights.filter((i) => !i.includes('no colors yet')).slice(0, 2),
    ].join(' ')
    return { reply: { kind: 'text', text }, memory }
  }

  // Outfit requests: any occasion, vibe or "what should I wear".
  const intent = parseIntent(text)
  const styles = parseStyles(text)
  const wish = [...new Set(colorsInText(text).map(colorName))]
  const asksOutfit = intent.occasion || styles.length || has(t, ['wear', 'outfit', 'dress', 'look', 'suggest', 'ootd', 'tonight', 'tomorrow', 'today'])
  if (asksOutfit) {
    const occasion = intent.occasion ?? (has(t, ['tonight']) ? 'evening' : 'casual')
    const ctx = baseCtx(d, {
      occasion,
      styles: styles.length ? (styles as StyleId[]) : occasion === 'active' ? ['gym'] : d.profile.styles,
      wishColors: wish,
      formalityShift: intent.formalityShift,
      preferShoes: intent.preferShoes,
    })
    const label = OCCASIONS.find((o) => o.id === occasion)!.label.toLowerCase()
    const note = words.includes(' tomorrow ') ? " (using today's weather)" : ''
    return outfitReply(d, ctx, 0, `Here's what I'd wear for ${label}${note}.`)
  }

  return {
    reply: {
      kind: 'text',
      text: `I didn't catch that. Try "outfit for dinner tonight", "pack for Goa this weekend", "what goes with my ${d.garments[0] ? displayName(d.garments[0]).toLowerCase() : 'jeans'}", or "what haven't I worn".`,
    },
    memory,
  }
}
