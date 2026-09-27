import { Footprints, Gem, Glasses, Shirt, ShoppingBag, type LucideIcon } from 'lucide-react'
import { hexToLab } from '../lib/color'
import { dominantHex, type Garment } from '../lib/model'
import { slotOf, type Slot } from '../lib/slots'
import { GarmentPhoto } from './GarmentPhoto'

const ICONS: Record<Slot, LucideIcon> = {
  top: Shirt,
  bottom: Shirt,
  onepiece: Shirt,
  layer: Shirt,
  footwear: Footprints,
  jewellery: Gem,
  bag: ShoppingBag,
  accessory: Glasses,
}

type Props = { garment: Garment; kind: 'thumb' | 'full'; className?: string; alt?: string }

/** The photo of a piece, or, for typed pieces, a tile in its color with an icon. */
export function PieceImage({ garment, kind, className, alt = '' }: Props) {
  if (garment.photo) return <GarmentPhoto id={garment.id} kind={kind} alt={alt} className={className} />
  const hex = dominantHex(garment)
  const Icon = ICONS[slotOf(garment)]
  const light = hex ? hexToLab(hex)[0] > 62 : true
  const second = garment.colors[1]?.hex
  return (
    <div
      className={`color-tile ${className ?? ''}`}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      style={{
        background: hex ? (second ? `linear-gradient(135deg, ${hex} 0 62%, ${second} 62% 100%)` : hex) : undefined,
        color: hex ? (light ? 'rgb(0 0 0 / 0.55)' : 'rgb(255 255 255 / 0.8)') : undefined,
      }}
    >
      <Icon size={kind === 'full' ? 56 : 26} strokeWidth={1.6} />
    </div>
  )
}
