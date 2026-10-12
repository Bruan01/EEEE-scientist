const RECOVERY_STORAGE_KEY = "ds:ui:dynamic-import-recovery";

const RECOVERABLE_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /ChunkLoadError/i,
  /Loading chunk [\w-]+ failed/i,
  /dynamically imported module/i,
  /Unable to preload CSS/i,
];

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readErrorText(error: unknown): string {
  if (error instanceof DynamicImportRecoveryError) {
    return `${error.message}\n${readErrorText(error.originalError)}`;
  }
  if (error instanceof Error) {
    const causeText =
      "cause" in error ? readErrorText((error as Error & { cause?: unknown }).cause) : "";
    return `${error.name}\n${error.message}\n${causeText}`;
  }
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object") {
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error ?? "");
}

function getRecoveryStorageKey(): string | null {
  if (!isBrowser()) {
    return null;
  }
  return `${RECOVERY_STORAGE_KEY}:${window.location.pathname}`;
}

function getSessionStorage(): Storage | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export class DynamicImportRecoveryError extends Error {
  readonly source: string;
  readonly originalError: unknown;

  constructor(source: string, originalError: unknown) {
    super("DeepScientist is refreshing the page to recover the latest UI bundle.");
    this.name = "DynamicImportRecoveryError";
    this.source = source;
    this.originalError = originalError;
  }
}

export function isDynamicImportRecoveryError(
  error: unknown
): error is DynamicImportRecoveryError {
  return error instanceof DynamicImportRecoveryError;
}

export function isRecoverableDynamicImportError(error: unknown): boolean {
  const errorText = readErrorText(error);
  return RECOVERABLE_ERROR_PATTERNS.some((pattern) => pattern.test(errorText));
}

export function clearDynamicImportRecoveryAttempt(): void {
  const storage = getSessionStorage();
  const key = getRecoveryStorageKey();
  if (!storage || !key) {
    return;
  }
  storage.removeItem(key);
}

export function scheduleDynamicImportRecovery(
  error: unknown,
  source: string
): boolean {
  if (!isBrowser() || !isRecoverableDynamicImportError(error)) {
    return false;
  }
  const storage = getSessionStorage();
  const key = getRecoveryStorageKey();
  if (!storage || !key) {
    return false;
  }
  if (storage.getItem(key)) {
    return false;
  }

  try {
    storage.setItem(
      key,
      JSON.stringify({
        source,
        href: window.location.href,
        attempted_at: Date.now(),
      })
    );
  } catch {
    return false;
  }

  window.setTimeout(() => {
    window.location.reload();
  }, 30);

  return true;
}

export function wrapRecoverableImport<T>(
  importFn: () => Promise<T>,
  source: string
): () => Promise<T> {
  return async () => {
    try {
      const loaded = await importFn();
      clearDynamicImportRecoveryAttempt();
      return loaded;
    } catch (error) {
      if (scheduleDynamicImportRecovery(error, source)) {
        throw new DynamicImportRecoveryError(source, error);
      }
      throw error;
    }
  };
}

export function getDynamicImportRecoveryMessage(error?: unknown): string {
  if (isDynamicImportRecoveryError(error)) {
    return error.message;
  }
  return "DeepScientist could not load this UI module. Refresh the page to fetch the latest bundle.";
}
