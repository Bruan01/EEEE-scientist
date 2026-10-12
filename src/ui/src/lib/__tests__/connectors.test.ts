import { describe, expect, it } from 'vitest'

import { normalizeConnectorTargets, parseConversationId } from '../connectors'

describe('connectors', () => {
  it('parses QQ multi-profile conversation ids without truncating the openid', () => {
    expect(parseConversationId('qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509')).toEqual({
      conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
      connector: 'qq',
      chat_type: 'direct',
      chat_id: '1725C581B930B7EA3585250DCB5DA509',
      chat_id_raw: 'qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
      profile_id: 'qq-profile-d7iuv7wx',
    })
  })

  it('keeps QQ quest bindings attached to the correct profile targets after normalization', () => {
    const targets = normalizeConnectorTargets({
      name: 'qq',
      bindings: [
        {
          conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
          profile_id: 'qq-profile-d7iuv7wx',
          profile_label: 'DeepScientist · 1903577099',
          quest_id: '023',
          quest_title: 'Quest 023',
          updated_at: '2026-03-19T11:08:37+00:00',
        },
      ],
      known_targets: [
        {
          conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
          connector: 'qq',
          chat_type: 'direct',
          chat_id: '1725C581B930B7EA3585250DCB5DA509',
          chat_id_raw: 'qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
          profile_id: 'qq-profile-d7iuv7wx',
          profile_label: 'DeepScientist · 1903577099',
          label: 'direct · 1725C581B930B7EA3585250DCB5DA509',
          updated_at: '2026-03-20T16:11:24+00:00',
          source: 'outbound_delivery',
        },
      ],
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
      profile_id: 'qq-profile-d7iuv7wx',
      chat_id: '1725C581B930B7EA3585250DCB5DA509',
      bound_quest_id: '023',
      bound_quest_title: 'Quest 023',
      is_bound: true,
    })
  })

  it('does not treat QQ recent activity quest history as an active binding', () => {
    const targets = normalizeConnectorTargets({
      name: 'qq',
      profiles: [
        {
          profile_id: 'qq-1903299925',
          label: 'DeepScientist · 1903299925',
          main_chat_id: 'CF8D2D559AA956B48751539ADFB98865',
          binding_count: 0,
        },
      ],
      discovered_targets: [
        {
          conversation_id: 'qq:direct:qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
          connector: 'qq',
          chat_type: 'direct',
          chat_id: 'CF8D2D559AA956B48751539ADFB98865',
          chat_id_raw: 'qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
          profile_id: 'qq-1903299925',
          profile_label: 'DeepScientist · 1903299925',
          label: 'direct · CF8D2D559AA956B48751539ADFB98865',
          updated_at: '2026-03-20T15:23:00+00:00',
          quest_id: '023',
        },
      ],
      recent_conversations: [
        {
          conversation_id: 'qq:direct:qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
          chat_type: 'direct',
          chat_id: 'CF8D2D559AA956B48751539ADFB98865',
          chat_id_raw: 'qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
          profile_id: 'qq-1903299925',
          profile_label: 'DeepScientist · 1903299925',
          label: 'direct · CF8D2D559AA956B48751539ADFB98865',
          source: 'recent_activity',
          updated_at: '2026-03-20T15:23:01+00:00',
          quest_id: '023',
        },
      ],
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      conversation_id: 'qq:direct:qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
      profile_id: 'qq-1903299925',
      chat_id: 'CF8D2D559AA956B48751539ADFB98865',
      quest_id: '023',
      bound_quest_id: null,
      is_bound: false,
      warning: null,
    })
  })

  it('keeps Lingzhu passive targets selectable for Start Research and settings cards', () => {
    const targets = normalizeConnectorTargets({
      name: 'lingzhu',
      discovered_targets: [
        {
          conversation_id: 'lingzhu:passive:DeepScientist',
          connector: 'lingzhu',
          chat_type: 'passive',
          chat_id: 'DeepScientist',
          chat_id_raw: 'DeepScientist',
          label: 'Passive binding',
          source: 'passive_binding',
          selectable: true,
          is_passive: true,
        },
      ],
    })

    expect(targets).toHaveLength(1)
    expect(targets[0]).toMatchObject({
      conversation_id: 'lingzhu:passive:DeepScientist',
      chat_type: 'passive',
      chat_id: 'DeepScientist',
      selectable: true,
    })
  })
})
