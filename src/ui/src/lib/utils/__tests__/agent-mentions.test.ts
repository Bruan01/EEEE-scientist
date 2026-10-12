import { resolveAgentMention } from '@/lib/utils/agent-mentions'

describe('resolveAgentMention', () => {
  it('matches labels with non-ASCII separators', () => {
    const label = '@Researcher\u00b7Mira'
    const agents = [{ id: 'researcher-mira', label }]

    const result = resolveAgentMention(`${label} hello`, agents, { enabled: true })

    expect(result.matched).toBe(true)
    expect(result.agent.id).toBe('researcher-mira')
    expect(result.agentMessage).toBe('hello')
    expect(result.displayMessage).toBe(`${label} hello`)
  })

  it('matches leading mention without a space using longest prefix', () => {
    const agents = [
      { id: 'pi', label: '@Pi' },
      { id: 'pi-sage', label: '@Pi-Sage' },
    ]

    const result = resolveAgentMention('@Pi-SageHello world', agents, { enabled: true })

    expect(result.matched).toBe(true)
    expect(result.agent.id).toBe('pi-sage')
    expect(result.agentMessage).toBe('Hello world')
  })

  it('prefers exact label match when boundary exists', () => {
    const agents = [
      { id: 'alpha', label: '@Alpha' },
      { id: 'alpha-plus', label: '@Alpha-Plus' },
    ]

    const result = resolveAgentMention('@Alpha hello', agents, { enabled: true })

    expect(result.matched).toBe(true)
    expect(result.agent.id).toBe('alpha')
    expect(result.agentMessage).toBe('hello')
  })
})
