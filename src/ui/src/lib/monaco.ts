"use client";

import { loader } from "@monaco-editor/react";

let configured = false;

const WORKER_FILES: Record<string, string> = {
  json: "json.worker.js",
  css: "css.worker.js",
  scss: "css.worker.js",
  less: "css.worker.js",
  html: "html.worker.js",
  handlebars: "html.worker.js",
  razor: "html.worker.js",
  typescript: "ts.worker.js",
  javascript: "ts.worker.js",
};

function getWorkerFile(label: string): string {
  return WORKER_FILES[label] ?? "editor.worker.js";
}

function applyWorkerOverride() {
  if (typeof window === "undefined") return;
  const baseUrl = new URL("/ui/monaco/vs/assets/", window.location.origin).toString();
  const existing = (window as typeof window & {
    MonacoEnvironment?: Record<string, unknown>;
  }).MonacoEnvironment;

  (window as typeof window & {
    MonacoEnvironment?: Record<string, unknown>;
  }).MonacoEnvironment = {
    ...(existing ?? {}),
    getWorker: (_moduleId: string, label: string) => {
      const workerUrl = new URL(getWorkerFile(label), baseUrl).toString();
      return new Worker(workerUrl, { name: label });
    },
  };
}

export function configureMonacoLoader() {
  if (configured) return;
  if (typeof window === "undefined") return;
  const baseUrl = new URL("/ui/monaco/vs", window.location.origin).toString();
  loader.config({ paths: { vs: baseUrl } });
  applyWorkerOverride();
  void loader
    .init()
    .then(() => {
      applyWorkerOverride();
    })
    .catch((error) => {
      console.error("[monaco] Failed to initialize:", error);
    });
  configured = true;
}
