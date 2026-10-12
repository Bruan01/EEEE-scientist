/**
 * Plugin Lifecycle Manager
 *
 * Manages plugin instance states and lifecycle transitions.
 *
 * @module lib/plugin/lifecycle
 */

import type { PluginInstanceState, PluginInstance, PluginContext } from "@/lib/types/plugin";

// ============================================================
// Types
// ============================================================

/**
 * State change callback type
 */
export type StateChangeCallback = (
  instanceId: string,
  oldState: PluginInstanceState,
  newState: PluginInstanceState,
  error?: Error
) => void;

/**
 * Plugin lifecycle event type
 */
export type LifecycleEvent =
  | "beforeLoad"
  | "afterLoad"
  | "beforeActivate"
  | "afterActivate"
  | "beforeDeactivate"
  | "afterDeactivate"
  | "beforeUnload"
  | "afterUnload"
  | "error";

/**
 * Lifecycle event callback type
 */
export type LifecycleEventCallback = (
  instanceId: string,
  event: LifecycleEvent,
  data?: unknown
) => void;

// ============================================================
// Valid State Transitions
// ============================================================

/**
 * Valid state transitions map
 *
 * Defines which states can transition to which other states.
 */
const VALID_TRANSITIONS: Record<PluginInstanceState, PluginInstanceState[]> = {
  unloaded: ["loading"],
  loading: ["initializing", "error", "unloaded"],
  initializing: ["active", "error", "unloaded"],
  active: ["destroying", "error"],
  error: ["unloaded", "destroying", "loading"], // Allow retry from error
  destroying: ["unloaded"],
};

// ============================================================
// Plugin Lifecycle Manager
// ============================================================

/**
 * Plugin Lifecycle Manager
 *
 * Manages plugin instance states and validates state transitions.
 * Provides event-based notifications for state changes.
 *
 * @example
 * ```typescript
 * const lifecycleManager = new PluginLifecycleManager();
 *
 * // Subscribe to state changes
 * const unsubscribe = lifecycleManager.onStateChange((instanceId, oldState, newState) => {
 *   console.log(`Plugin ${instanceId} changed from ${oldState} to ${newState}`);
 * });
 *
 * // Update state
 * lifecycleManager.setState('plugin:instance', 'loading');
 * lifecycleManager.setState('plugin:instance', 'active');
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export class PluginLifecycleManager {
  /**
   * Plugin instance states
   * key: instanceId (pluginId:resourceId)
   * value: current state
   */
  private states = new Map<string, PluginInstanceState>();

  /**
   * State error messages
   */
  private errors = new Map<string, Error>();

  /**
   * State change listeners
   */
  private stateChangeListeners = new Set<StateChangeCallback>();

  /**
   * Lifecycle event listeners
   */
  private lifecycleEventListeners = new Set<LifecycleEventCallback>();

  /**
   * Get the current state of a plugin instance
   *
   * @param instanceId - Plugin instance ID
   * @returns Current state or 'unloaded' if not found
   */
  getState(instanceId: string): PluginInstanceState {
    return this.states.get(instanceId) || "unloaded";
  }

  /**
   * Get the error associated with a plugin instance
   *
   * @param instanceId - Plugin instance ID
   * @returns Error or undefined
   */
  getError(instanceId: string): Error | undefined {
    return this.errors.get(instanceId);
  }

  /**
   * Set the state of a plugin instance
   *
   * @param instanceId - Plugin instance ID
   * @param newState - New state to set
   * @param error - Optional error (for error state)
   * @returns true if state was changed, false if transition was invalid
   */
  setState(
    instanceId: string,
    newState: PluginInstanceState,
    error?: Error
  ): boolean {
    const oldState = this.getState(instanceId);

    // Same state, no change needed
    if (oldState === newState) {
      return true;
    }

    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(
        `[PluginLifecycleManager] Invalid state transition for ${instanceId}: ${oldState} -> ${newState}`
      );
      return false;
    }

    // Update state
    if (newState === "unloaded") {
      // Clean up when unloading
      this.states.delete(instanceId);
      this.errors.delete(instanceId);
    } else {
      this.states.set(instanceId, newState);
    }

    // Store error if provided
    if (error) {
      this.errors.set(instanceId, error);
    } else if (newState !== "error") {
      // Clear error if transitioning to non-error state
      this.errors.delete(instanceId);
    }

    // Notify listeners
    this.notifyStateChange(instanceId, oldState, newState, error);

    return true;
  }

  /**
   * Set error state for a plugin instance
   *
   * @param instanceId - Plugin instance ID
   * @param error - Error that occurred
   */
  setError(instanceId: string, error: Error): void {
    this.setState(instanceId, "error", error);
    this.emitLifecycleEvent(instanceId, "error", error);
  }

  /**
   * Check if a state transition is valid
   *
   * @param from - Current state
   * @param to - Target state
   * @returns true if transition is valid
   */
  isValidTransition(
    from: PluginInstanceState,
    to: PluginInstanceState
  ): boolean {
    const validTargets = VALID_TRANSITIONS[from];
    return validTargets?.includes(to) ?? false;
  }

  /**
   * Subscribe to state changes
   *
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeListeners.add(callback);
    return () => {
      this.stateChangeListeners.delete(callback);
    };
  }

  /**
   * Subscribe to lifecycle events
   *
   * @param callback - Callback function
   * @returns Unsubscribe function
   */
  onLifecycleEvent(callback: LifecycleEventCallback): () => void {
    this.lifecycleEventListeners.add(callback);
    return () => {
      this.lifecycleEventListeners.delete(callback);
    };
  }

  /**
   * Emit a lifecycle event
   *
   * @param instanceId - Plugin instance ID
   * @param event - Lifecycle event
   * @param data - Optional event data
   */
  emitLifecycleEvent(
    instanceId: string,
    event: LifecycleEvent,
    data?: unknown
  ): void {
    this.lifecycleEventListeners.forEach((callback) => {
      try {
        callback(instanceId, event, data);
      } catch (error) {
        console.error(
          `[PluginLifecycleManager] Error in lifecycle event callback:`,
          error
        );
      }
    });
  }

  /**
   * Remove state tracking for a plugin instance
   *
   * @param instanceId - Plugin instance ID
   */
  removeState(instanceId: string): void {
    this.states.delete(instanceId);
    this.errors.delete(instanceId);
  }

  /**
   * Get all instances in a specific state
   *
   * @param state - State to filter by
   * @returns Array of instance IDs
   */
  getInstancesByState(state: PluginInstanceState): string[] {
    const result: string[] = [];
    this.states.forEach((instanceState, instanceId) => {
      if (instanceState === state) {
        result.push(instanceId);
      }
    });
    return result;
  }

  /**
   * Get all active instances
   */
  getActiveInstances(): string[] {
    return this.getInstancesByState("active");
  }

  /**
   * Get all instances with errors
   */
  getErrorInstances(): string[] {
    return this.getInstancesByState("error");
  }

  /**
   * Check if a plugin instance is active
   */
  isActive(instanceId: string): boolean {
    return this.getState(instanceId) === "active";
  }

  /**
   * Check if a plugin instance is loading
   */
  isLoading(instanceId: string): boolean {
    const state = this.getState(instanceId);
    return state === "loading" || state === "initializing";
  }

  /**
   * Check if a plugin instance has an error
   */
  hasError(instanceId: string): boolean {
    return this.getState(instanceId) === "error";
  }

  /**
   * Clear all states (for cleanup)
   */
  clear(): void {
    this.states.clear();
    this.errors.clear();
  }

  /**
   * Notify state change listeners
   */
  private notifyStateChange(
    instanceId: string,
    oldState: PluginInstanceState,
    newState: PluginInstanceState,
    error?: Error
  ): void {
    this.stateChangeListeners.forEach((callback) => {
      try {
        callback(instanceId, oldState, newState, error);
      } catch (err) {
        console.error(
          `[PluginLifecycleManager] Error in state change callback:`,
          err
        );
      }
    });
  }
}

/**
 * Global plugin lifecycle manager singleton
 */
export const pluginLifecycleManager = new PluginLifecycleManager();

// ============================================================
// Helper Functions
// ============================================================

/**
 * Generate instance ID from plugin ID and context
 */
export function generateInstanceId(
  pluginId: string,
  context: PluginContext
): string {
  return `${pluginId}:${context.resourceId || "default"}`;
}

/**
 * Parse instance ID to get plugin ID and resource ID
 */
export function parseInstanceId(instanceId: string): {
  pluginId: string;
  resourceId: string;
} {
  const [pluginId, ...rest] = instanceId.split(":");
  return {
    pluginId,
    resourceId: rest.join(":") || "default",
  };
}
