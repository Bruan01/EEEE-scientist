import { beforeEach, describe, expect, it } from 'vitest'

import type { AdminRepair } from '@/lib/types/admin'
import { useAdminOpsStore } from '@/lib/stores/admin-ops'

function resetStore() {
  useAdminOpsStore.setState({
    dockOpen: false,
    activeRepair: null,
    context: {
      sourcePage: '/settings',
      scope: 'system',
      targets: {},
      selectedPaths: [],
    },
  })
}

describe('admin-ops store', () => {
  beforeEach(() => {
    resetStore()
  })

  it('provides the runtime shape expected by settings surfaces', () => {
    const state = useAdminOpsStore.getState()

    expect(typeof state.closeDock).toBe('function')
    expect(typeof state.startFreshSession).toBe('function')
    expect(typeof state.resetContext).toBe('function')
    expect(typeof state.clearContext).toBe('function')
    expect(typeof state.setContext).toBe('function')
    expect(typeof state.openRepair).toBe('function')
    expect(typeof state.clearActiveRepair).toBe('function')
    expect(state.context).toEqual({
      sourcePage: '/settings',
      scope: 'system',
      targets: {},
      selectedPaths: [],
    })
  })

  it('updates context and repair state without throwing', () => {
    const repair = {
      repair_id: 'repair-1',
      status: 'open',
      scope: 'quest',
      repair_policy: 'diagnose_only',
      user_request: 'Investigate the failing quest view',
      ops_quest_id: 'Q-1',
    } as AdminRepair

    useAdminOpsStore.getState().startFreshSession('/settings/quests')
    useAdminOpsStore.getState().setContext({
      sourcePage: '/settings/quests/Q-1',
      scope: 'quest',
      targets: { quest_ids: ['Q-1'] },
      selectedPaths: ['plan.md'],
    })
    useAdminOpsStore.getState().openRepair(repair)

    expect(useAdminOpsStore.getState().dockOpen).toBe(true)
    expect(useAdminOpsStore.getState().activeRepair?.repair_id).toBe('repair-1')
    expect(useAdminOpsStore.getState().context).toEqual({
      sourcePage: '/settings/quests/Q-1',
      scope: 'quest',
      targets: { quest_ids: ['Q-1'] },
      selectedPaths: ['plan.md'],
    })

    useAdminOpsStore.getState().clearActiveRepair()
    useAdminOpsStore.getState().clearContext('/settings/logs')
    useAdminOpsStore.getState().closeDock()

    expect(useAdminOpsStore.getState().activeRepair).toBeNull()
    expect(useAdminOpsStore.getState().dockOpen).toBe(false)
    expect(useAdminOpsStore.getState().context).toEqual({
      sourcePage: '/settings/logs',
      scope: 'system',
      targets: {},
      selectedPaths: [],
    })
  })
})
