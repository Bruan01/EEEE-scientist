import { joinPath, splitPath } from '@/lib/plugins/cli/lib/file-utils'

// Mirrors cli/backend/app/services/quest/utils.py (slugify_branch_name + worktree_dir_for_branch).
const BRANCH_SAFE_PATTERN = /[^A-Za-z0-9._/-]/g

function slugifyBranchName(branchName: string, maxLen = 48): string {
  const normalized = (branchName ?? '').trim()
  if (!normalized) return 'branch'

  const sanitized = normalized.replace(BRANCH_SAFE_PATTERN, '_')
  const parts = sanitized.split('/').map((segment) => {
    let next = segment.replace(/_+/g, '_').replace(/^[._-]+|[._-]+$/g, '')
    if (!next) next = 'branch'
    return next
  })

  let slug = parts.join('__')
  if (!slug) slug = 'branch'
  if (slug.length > maxLen) slug = slug.slice(0, maxLen)
  return slug
}

// Minimal SHA-1 implementation (UTF-8) so we can match Python hashlib.sha1 without relying on WebCrypto.
function sha1Hex(message: string): string {
  const utf8 = new TextEncoder().encode(message)
  const ml = utf8.length * 8

  const withOne = new Uint8Array(((utf8.length + 9 + 63) >> 6) << 6)
  withOne.set(utf8)
  withOne[utf8.length] = 0x80

  const view = new DataView(withOne.buffer)
  // Append length as 64-bit big-endian.
  view.setUint32(withOne.length - 8, Math.floor(ml / 0x100000000), false)
  view.setUint32(withOne.length - 4, ml >>> 0, false)

  let h0 = 0x67452301
  let h1 = 0xefcdab89
  let h2 = 0x98badcfe
  let h3 = 0x10325476
  let h4 = 0xc3d2e1f0

  const w = new Uint32Array(80)

  const rol = (value: number, bits: number) => ((value << bits) | (value >>> (32 - bits))) >>> 0

  for (let i = 0; i < withOne.length; i += 64) {
    for (let t = 0; t < 16; t += 1) {
      w[t] = view.getUint32(i + t * 4, false)
    }
    for (let t = 16; t < 80; t += 1) {
      w[t] = rol(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1)
    }

    let a = h0
    let b = h1
    let c = h2
    let d = h3
    let e = h4

    for (let t = 0; t < 80; t += 1) {
      let f = 0
      let k = 0
      if (t < 20) {
        f = (b & c) | (~b & d)
        k = 0x5a827999
      } else if (t < 40) {
        f = b ^ c ^ d
        k = 0x6ed9eba1
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d)
        k = 0x8f1bbcdc
      } else {
        f = b ^ c ^ d
        k = 0xca62c1d6
      }
      const temp = (rol(a, 5) + f + e + k + w[t]) >>> 0
      e = d
      d = c
      c = rol(b, 30)
      b = a
      a = temp
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
  }

  const toHex = (value: number) => value.toString(16).padStart(8, '0')
  return `${toHex(h0)}${toHex(h1)}${toHex(h2)}${toHex(h3)}${toHex(h4)}`
}

export function worktreeDirForBranch(branchName: string): string {
  const slug = slugifyBranchName(branchName, 48)
  const digest = sha1Hex(String(branchName)).slice(0, 8)
  return `${slug}--${digest}`
}

export function worktreeRelPathForBranch(args: { questId: string; branchName: string }): string {
  const branch = args.branchName.trim()
  if (branch === 'main') return `Quest/${args.questId}`
  return `Quest/${args.questId}/worktrees/${worktreeDirForBranch(branch)}`
}

export function worktreeAbsolutePathForBranch(args: {
  serverRoot: string
  questId: string
  branchName: string
}): string {
  const baseSegments = splitPath(args.serverRoot || '/')
  const relPath = worktreeRelPathForBranch({ questId: args.questId, branchName: args.branchName })
  return joinPath([...baseSegments, ...relPath.split('/').filter(Boolean)])
}

