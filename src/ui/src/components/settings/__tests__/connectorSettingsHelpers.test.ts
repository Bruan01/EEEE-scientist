import { describe, expect, it } from 'vitest'

import { qqProfileDisplayLabel, qqProfileStatus, selectQqProfileTarget } from '../connectorSettingsHelpers'

describe('connectorSettingsHelpers', () => {
  it('builds a distinct QQ profile label when multiple bots share the same bot name', () => {
    expect(
      qqProfileDisplayLabel({
        profile_id: 'qq-profile-d7iuv7wx',
        bot_name: 'DeepScientist',
        app_id: '1903577099',
      })
    ).toBe('DeepScientist · 1903577099')
  })

  it('prefers the snapshot label when one is available', () => {
    expect(
      qqProfileDisplayLabel(
        {
          profile_id: 'qq-profile-d7iuv7wx',
          bot_name: 'DeepScientist',
          app_id: '1903577099',
        },
        { label: 'DeepScientist · 1903577099' }
      )
    ).toBe('DeepScientist · 1903577099')
  })

  it('prefers the bound target over the saved main chat target', () => {
    const target = selectQqProfileTarget(
      [
        {
          conversation_id: 'qq:direct:qq-profile-d7iuv7wx::chat-main',
          chat_type: 'direct',
          chat_id: 'chat-main',
        },
        {
          conversation_id: 'qq:direct:qq-profile-d7iuv7wx::chat-bound',
          chat_type: 'direct',
          chat_id: 'chat-bound',
          bound_quest_id: '023',
        },
      ],
      'chat-main'
    )

    expect(target?.conversation_id).toBe('qq:direct:qq-profile-d7iuv7wx::chat-bound')
  })

  it('reports a ready QQ profile when the OpenID is detected but no quest is bound', () => {
    expect(
      qqProfileStatus(
        {
          binding_count: 0,
          last_conversation_id: 'qq:direct:qq-1903299925::CF8D2D559AA956B48751539ADFB98865',
          main_chat_id: 'CF8D2D559AA956B48751539ADFB98865',
        },
        [],
        'CF8D2D559AA956B48751539ADFB98865'
      )
    ).toBe('ready')
  })

  it('reports a bound QQ profile when a discovered target is attached to a quest', () => {
    expect(
      qqProfileStatus(
        {
          binding_count: 1,
          last_conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
          main_chat_id: '1725C581B930B7EA3585250DCB5DA509',
        },
        [
          {
            conversation_id: 'qq:direct:qq-profile-d7iuv7wx::1725C581B930B7EA3585250DCB5DA509',
            chat_type: 'direct',
            chat_id: '1725C581B930B7EA3585250DCB5DA509',
            bound_quest_id: '023',
          },
        ],
        '1725C581B930B7EA3585250DCB5DA509'
      )
    ).toBe('bound')
  })
})
