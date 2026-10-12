import type { ArxivPaper } from "@/lib/types/arxiv";

function clean(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeTitle(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function stripLeadingTitleHeading(markdown: string, title: string): string {
  const lines = markdown.replace(/\r\n/g, "\n").trim().split("\n");
  if (!lines.length) return "";
  const match = lines[0]?.match(/^#\s+(.+)$/);
  if (!match) return markdown.trim();
  const heading = normalizeTitle(match[1] || "");
  const normalizedTitle = normalizeTitle(title);
  if (normalizedTitle && heading !== normalizedTitle) {
    return markdown.trim();
  }
  const remainder = lines.slice(1).join("\n").trim();
  return remainder || markdown.trim();
}

export function getArxivOverviewMarkdown(
  paper: ArxivPaper | null,
  options: { stripTitle?: boolean } = {}
): string {
  const markdown = clean(paper?.overviewMarkdown);
  if (!markdown) return "";
  if (!options.stripTitle) return markdown;
  const title = clean(paper?.title) || clean(paper?.displayName) || clean(paper?.arxivId);
  return stripLeadingTitleHeading(markdown, title);
}

export function getArxivSummaryDisplayMarkdown(paper: ArxivPaper | null): string {
  const overviewMarkdown = getArxivOverviewMarkdown(paper, { stripTitle: true });
  if (overviewMarkdown) return overviewMarkdown;
  const overview = clean(paper?.overview);
  return overview;
}

export function hasArxivOverview(paper: ArxivPaper | null): boolean {
  return Boolean(getArxivSummaryDisplayMarkdown(paper));
}

export function buildArxivSummaryMarkdown(paper: ArxivPaper | null): string {
  if (!paper) {
    return "# Summary\n\nPaper metadata is not available yet.\n";
  }
  const overviewMarkdown = getArxivOverviewMarkdown(paper);
  if (overviewMarkdown) {
    return overviewMarkdown.endsWith("\n") ? overviewMarkdown : `${overviewMarkdown}\n`;
  }
  const title = paper.title || paper.displayName || paper.arxivId || "arXiv paper";
  const authors = paper.authors?.filter(Boolean).join(", ");
  const categories = paper.categories?.filter(Boolean).join(", ");
  const lines = [`# ${title}`, ""];
  if (paper.arxivId) lines.push(`- arXiv ID: ${paper.arxivId}`);
  if (paper.publishedAt) lines.push(`- Published: ${paper.publishedAt}`);
  if (authors) lines.push(`- Authors: ${authors}`);
  if (categories) lines.push(`- Categories: ${categories}`);
  if (paper.summarySource) lines.push(`- Summary source: ${paper.summarySource}`);
  if (paper.metadataSource) lines.push(`- Metadata source: ${paper.metadataSource}`);
  const overview = clean(paper.overview);
  const abstract = clean(paper.abstract);
  if (overview) {
    lines.push("", "## Summary", "", overview);
  }
  if (abstract) {
    lines.push("", overview ? "## Abstract" : "## Summary", "", abstract);
  }
  if (!overview && !abstract) {
    lines.push("", "No summary or abstract is available yet.");
  }
  return `${lines.join("\n").trim()}\n`;
}
