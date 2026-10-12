const CLI_SESSION_NAMESPACE = '6f07d9a4-0e31-4f69-9ad4-b6295b6e4d2e'

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '')
  const bytes = new Uint8Array(16)
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

function fnv1a(input: string, seed: number) {
  let hash = 0x811c9dc5 ^ seed
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function fallbackUuid(input: string): string {
  const h1 = fnv1a(input, 1).toString(16).padStart(8, '0')
  const h2 = fnv1a(input, 2).toString(16).padStart(8, '0')
  const h3 = fnv1a(input, 3).toString(16).padStart(8, '0')
  const h4 = fnv1a(input, 4).toString(16).padStart(8, '0')
  const raw = `${h1}${h2}${h3}${h4}`.slice(0, 32)
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-5${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`
}

async function uuidV5(name: string, namespace = CLI_SESSION_NAMESPACE): Promise<string> {
  const nsBytes = uuidToBytes(namespace)
  const nameBytes = new TextEncoder().encode(name)
  const data = new Uint8Array(nsBytes.length + nameBytes.length)
  data.set(nsBytes, 0)
  data.set(nameBytes, nsBytes.length)

  if (typeof crypto !== 'undefined' && crypto.subtle?.digest) {
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-1', data))
    const bytes = hash.slice(0, 16)
    bytes[6] = (bytes[6] & 0x0f) | 0x50
    bytes[8] = (bytes[8] & 0x3f) | 0x80
    return bytesToUuid(bytes)
  }

  return fallbackUuid(`${namespace}:${name}`)
}

export async function buildDefaultSessionId(projectId: string, serverId: string): Promise<string> {
  return uuidV5(`${projectId}:${serverId}:default`)
}

export async function buildConversationSessionId(
  projectId: string,
  serverId: string,
  conversationId: string
): Promise<string> {
  return uuidV5(`${projectId}:${serverId}:${conversationId}`)
}

export async function buildChatSessionId(
  projectId: string,
  serverId: string,
  chatSessionId: string
): Promise<string> {
  return uuidV5(`${projectId}:${serverId}:${chatSessionId}`)
}
