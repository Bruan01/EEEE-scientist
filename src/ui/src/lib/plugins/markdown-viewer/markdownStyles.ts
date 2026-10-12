export const MARKDOWN_VIEWER_STYLES = `
  .markdown-content {
    font-family: var(--font-reading, var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif));
    line-height: 1.7;
    color: var(--foreground);
  }

  .markdown-content .md-h1 {
    font-family: var(--font-title, var(--font-reading, var(--font-sans)));
    font-size: 2rem;
    font-weight: 700;
    margin: 1.5rem 0 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border);
  }

  .markdown-content .md-h2 {
    font-family: var(--font-title, var(--font-reading, var(--font-sans)));
    font-size: 1.5rem;
    font-weight: 600;
    margin: 1.25rem 0 0.75rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid var(--border);
  }

  .markdown-content .md-h3 {
    font-family: var(--font-title, var(--font-reading, var(--font-sans)));
    font-size: 1.25rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .markdown-content .md-h4,
  .markdown-content .md-h5,
  .markdown-content .md-h6 {
    font-family: var(--font-title, var(--font-reading, var(--font-sans)));
    font-size: 1rem;
    font-weight: 600;
    margin: 1rem 0 0.5rem;
  }

  .markdown-content .md-p {
    margin: 0.75rem 0;
  }

  .markdown-content .inline-code {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace);
    font-size: 0.875em;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background-color: var(--muted);
  }

  .markdown-content .code-block {
    font-family: var(--font-mono, ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace);
    font-size: 0.875rem;
    padding: 1rem;
    margin: 1rem 0;
    border-radius: 0.5rem;
    background-color: #1e1e1e;
    color: #d4d4d4;
    overflow-x: auto;
    white-space: pre;
  }

  .markdown-content .md-blockquote {
    padding: 0.5rem 1rem;
    margin: 1rem 0;
    border-left: 4px solid var(--primary);
    background-color: var(--muted);
    font-style: italic;
  }

  .markdown-content .md-ul,
  .markdown-content .md-ol {
    margin: 0.75rem 0;
    padding-left: 1.5rem;
  }

  .markdown-content .md-li,
  .markdown-content .md-li-ordered {
    margin: 0.25rem 0;
  }

  .markdown-content .md-task-list {
    list-style: none;
    padding-left: 0;
  }

  .markdown-content .task-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0.25rem 0;
  }

  .markdown-content .task-item input {
    width: 1rem;
    height: 1rem;
  }

  .markdown-content .task-item.checked {
    text-decoration: line-through;
    opacity: 0.7;
  }

  .markdown-content .md-table {
    width: 100%;
    border-collapse: collapse;
    margin: 1rem 0;
    font-size: 0.875rem;
  }

  .markdown-content .md-td {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
  }

  .markdown-content .md-th {
    font-weight: 600;
    background-color: var(--muted);
  }

  .markdown-content .md-hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2rem 0;
  }

  .markdown-content .md-link {
    color: var(--primary);
    text-decoration: none;
  }

  .markdown-content .md-link:hover {
    text-decoration: underline;
  }

  .markdown-content .md-image {
    max-width: 100%;
    height: auto;
    border-radius: 0.5rem;
    margin: 1rem 0;
  }

  .markdown-content .katex {
    font-family: 'KaTeX_Main', 'Times New Roman', serif;
  }

  .markdown-content .katex-display {
    padding: 1rem;
    margin: 1rem 0;
    background-color: var(--muted);
    border-radius: 0.5rem;
    overflow-x: auto;
  }

  .markdown-content .math-block {
    padding: 1rem;
    margin: 1rem 0;
    background-color: var(--muted);
    border-radius: 0.5rem;
    text-align: center;
    font-family: 'KaTeX_Main', 'Times New Roman', serif;
    font-size: 1.1rem;
    overflow-x: auto;
  }

  .markdown-content .math-inline {
    font-family: 'KaTeX_Main', 'Times New Roman', serif;
    padding: 0 0.25rem;
  }

  .markdown-content del {
    text-decoration: line-through;
    opacity: 0.7;
  }
`;
