import crypto from 'node:crypto'

// Use SHA-256 fixed-length digest before timingSafeEqual to prevent side-channel timing attacks
// and length leakage when comparing strings of different lengths.
export const timingSafeEqual = (a: string, b: string): boolean => {
  const hashA = crypto.createHash('sha256').update(a).digest()
  const hashB = crypto.createHash('sha256').update(b).digest()
  return crypto.timingSafeEqual(hashA, hashB) && a.length === b.length
}

