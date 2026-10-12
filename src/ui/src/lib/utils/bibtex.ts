import type { ArxivPaper } from "@/lib/types/arxiv";

function getLastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts[parts.length - 1] || "unknown";
}

/**
 * Generate BibTeX in arXiv's official format (same as "Export BibTeX Citation" on arxiv.org)
 *
 * @example Output format:
 * @misc{lastname2024arxivid,
 *       title={Paper Title},
 *       author={Author1 and Author2 and Author3},
 *       year={2024},
 *       eprint={2401.12345},
 *       archivePrefix={arXiv},
 *       primaryClass={cs.LG}
 * }
 */
export function generateBibTeX(paper: ArxivPaper): string {
  if (paper.bibtex?.trim()) {
    return paper.bibtex.trim();
  }
  const authorStr = (paper.authors || []).join(" and ");
  const year =
    paper.publishedAt && !Number.isNaN(Date.parse(paper.publishedAt))
      ? new Date(paper.publishedAt).getFullYear()
      : new Date().getFullYear();

  // Generate citation key: lastname + year + arxivId (without dots and version)
  const firstAuthor = paper.authors?.[0] ? getLastName(paper.authors[0]).toLowerCase() : "unknown";
  const baseId = paper.arxivId.replace(/v\d+$/, "").replace(".", "");
  const key = `${firstAuthor}${year}${baseId}`;

  // Get primary category (first one)
  const primaryClass = paper.categories?.[0] || "";

  // Use @misc type to match arXiv's official export format
  const lines = [
    `@misc{${key},`,
    `      title={${paper.title || ""}},`,
    `      author={${authorStr}},`,
    `      year={${year}},`,
    `      eprint={${paper.arxivId}},`,
    `      archivePrefix={arXiv},`,
  ];

  if (primaryClass) {
    lines.push(`      primaryClass={${primaryClass}},`);
  }

  // Remove trailing comma from last line
  lines[lines.length - 1] = lines[lines.length - 1].replace(/,$/, "");
  lines.push("}");

  return lines.join("\n");
}
