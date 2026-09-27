// Sortable unique ids (ULID layout): 10 characters of time + 16 random characters.
// Ids made on different phones never collide in practice, and sort by creation time.

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

function cryptoRandomBytes(n: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function newId(now: number = Date.now(), randomBytes: (n: number) => Uint8Array = cryptoRandomBytes): string {
  let t = Math.floor(now)
  let time = ''
  for (let i = 0; i < 10; i++) {
    time = ALPHABET[t % 32] + time
    t = Math.floor(t / 32)
  }
  let rand = ''
  // 256 is a multiple of 32, so `b % 32` is unbiased.
  for (const b of randomBytes(16)) rand += ALPHABET[b % 32]
  return time + rand
}

export const ID_PATTERN = /^[0-9A-HJKMNP-TV-Z]{26}$/
