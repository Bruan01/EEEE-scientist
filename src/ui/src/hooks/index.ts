/**
 * Hooks
 *
 * Re-exports all custom hooks.
 *
 * @module hooks
 */

export { useTabClose } from "./useTabClose";
export type { ConfirmResult, ConfirmDialogOptions, TabCloseResult } from "./useTabClose";

export { useTabShortcuts, TAB_SHORTCUTS } from "./useTabShortcuts";
export type { TabShortcutsConfig } from "./useTabShortcuts";

export { useOpenFile } from "./useOpenFile";
export type { OpenFileOptions, OpenFileResult } from "./useOpenFile";

export { useFileDiffOverlay } from "./useFileDiffOverlay";

export { useLLMStream } from "./useLLMStream";
