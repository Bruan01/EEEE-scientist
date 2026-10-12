import type { PDFViewer } from "pdfjs-dist/web/pdf_viewer.mjs";
import { viewportToScaled } from "../lib/coordinates";
import type {
  IHighlight,
  LTWH,
  LTWHP,
  Position,
  Scaled,
  ScaledPosition,
} from "../types";
import type { T_ViewportHighlight } from "./PdfHighlighter";

const HINT_CARD_GAP_PX = 10;
const HINT_SIDE_PADDING_PX = 12;
const HINT_TOP_BOTTOM_PADDING_PX = 8;
const HINT_PRIMARY_LINE_HEIGHT_PX = 14;
const HINT_SECONDARY_LINE_HEIGHT_PX = 17;
const HINT_MIN_CARD_HEIGHT_PX = 62;
const HINT_HORIZONTAL_PADDING_PX = 22;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizePreviewText(value: string): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/\uFFFD/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveAnchorTop(
  highlight: T_ViewportHighlight<IHighlight>,
  cardHeightPx: number,
): number {
  const rect =
    highlight.position?.rects?.[0] || highlight.position?.boundingRect || null;
  if (!rect) return 0;
  const top = Number(rect.top || 0);
  const height = Number(rect.height || 0);
  if (!Number.isFinite(top)) return 0;
  if (!Number.isFinite(height)) return Math.max(0, top);
  return Math.max(0, top + height * 0.5 - cardHeightPx * 0.5);
}

function compactWords(value: string, maxWords: number): string {
  const normalized = normalizePreviewText(value);
  if (!normalized) return "";
  const tokens = normalized
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length <= maxWords) return tokens.join(" ");
  return `${tokens.slice(0, maxWords).join(" ")} …`;
}

function estimateHintSecondaryText(highlight: T_ViewportHighlight<IHighlight>): string {
  const maybeSummary = (highlight as unknown as { previewSummary?: unknown }).previewSummary;
  if (typeof maybeSummary === "string" && maybeSummary.trim()) {
    return normalizePreviewText(maybeSummary);
  }
  const commentText = typeof highlight.comment?.text === "string" ? highlight.comment.text : "";
  return compactWords(commentText, 8);
}

function estimateHintCardHeightPx(
  highlight: T_ViewportHighlight<IHighlight>,
  hintWidthPx: number,
): number {
  const secondaryText = estimateHintSecondaryText(highlight);
  const hasSecondary = secondaryText.length > 0;
  const contentWidth = Math.max(120, hintWidthPx - HINT_HORIZONTAL_PADDING_PX);
  const avgCharWidthPx = 6.1;
  const charsPerLine = Math.max(14, Math.floor(contentWidth / avgCharWidthPx));
  const secondaryLineCount = hasSecondary
    ? Math.max(1, Math.ceil(secondaryText.length / charsPerLine))
    : 0;
  const paddingVertical = 14;
  const interLineGap = hasSecondary ? 4 : 0;
  const estimatedHeight =
    paddingVertical +
    HINT_PRIMARY_LINE_HEIGHT_PX +
    interLineGap +
    secondaryLineCount * HINT_SECONDARY_LINE_HEIGHT_PX;
  return Math.max(HINT_MIN_CARD_HEIGHT_PX, Math.ceil(estimatedHeight));
}

function computeOverlayHintLayout<T_HT extends IHighlight>(
  viewportHighlights: Array<T_ViewportHighlight<T_HT>>,
  pageWidth: number,
  pageHeight: number,
) {
  const safePageWidth = Number.isFinite(pageWidth) && pageWidth > 0 ? pageWidth : 0;
  const safePageHeight = Number.isFinite(pageHeight) && pageHeight > 0 ? pageHeight : 0;

  const maxHintWidth = Math.max(
    140,
    safePageWidth - HINT_SIDE_PADDING_PX * 2,
  );
  const preferredHintWidth = clamp(safePageWidth * 0.34, 190, 320);
  const hintWidthPx = Math.min(maxHintWidth, preferredHintWidth);
  const hintLeftPx = Math.max(
    HINT_SIDE_PADDING_PX,
    safePageWidth - hintWidthPx - HINT_SIDE_PADDING_PX,
  );

  const anchorRows = viewportHighlights
    .filter((highlight) => !highlight.content?.image)
    .filter(
      (highlight) =>
        !(highlight as unknown as { __dsGhost?: boolean }).__dsGhost,
    )
    .map((highlight) => {
      const normalizedHighlight = highlight as unknown as T_ViewportHighlight<IHighlight>;
      const cardHeightPx = estimateHintCardHeightPx(normalizedHighlight, hintWidthPx);
      return {
        id: String(highlight.id),
        cardHeightPx,
        anchorTop: resolveAnchorTop(normalizedHighlight, cardHeightPx),
      };
    })
    .sort((left, right) => {
      if (left.anchorTop === right.anchorTop) {
        return left.id.localeCompare(right.id);
      }
      return left.anchorTop - right.anchorTop;
    });

  const hintTopById: Record<string, number> = {};
  if (anchorRows.length === 0) {
    return { hintTopById, hintLeftPx, hintWidthPx };
  }

  const minTop = HINT_TOP_BOTTOM_PADDING_PX;
  const maxBottom = Math.max(minTop, safePageHeight - HINT_TOP_BOTTOM_PADDING_PX);
  const availableHeight = Math.max(0, maxBottom - minTop);
  const totalCardHeight = anchorRows.reduce((sum, row) => sum + row.cardHeightPx, 0);
  let gapPx = HINT_CARD_GAP_PX;
  if (anchorRows.length > 1) {
    const fittedGap = Math.floor(
      (availableHeight - totalCardHeight) / (anchorRows.length - 1),
    );
    if (Number.isFinite(fittedGap)) {
      gapPx = Math.max(0, Math.min(HINT_CARD_GAP_PX, fittedGap));
    }
  } else {
    gapPx = 0;
  }

  const suffixHeights: number[] = new Array(anchorRows.length).fill(0);
  for (let index = anchorRows.length - 1; index >= 0; index -= 1) {
    const next = index + 1 < anchorRows.length ? suffixHeights[index + 1] : 0;
    suffixHeights[index] = anchorRows[index].cardHeightPx + next;
  }

  const placedRows: Array<{ id: string; top: number; cardHeightPx: number }> = [];
  let cursorTop = minTop;

  for (let index = 0; index < anchorRows.length; index += 1) {
    const row = anchorRows[index];
    const remainingRows = anchorRows.length - index - 1;
    const remainingHeight =
      suffixHeights[index] + Math.max(0, remainingRows) * Math.max(0, gapPx);
    const maxTopForRow = Math.max(
      minTop,
      maxBottom - remainingHeight,
    );
    const desiredTop = clamp(row.anchorTop, minTop, maxTopForRow);
    const top = Math.max(desiredTop, cursorTop);
    placedRows.push({ id: row.id, top, cardHeightPx: row.cardHeightPx });
    cursorTop = top + row.cardHeightPx + gapPx;
  }

  const lastRow = placedRows[placedRows.length - 1];
  const lastBottom = lastRow ? lastRow.top + lastRow.cardHeightPx : minTop;
  if (lastBottom > maxBottom) {
    const overflow = lastBottom - maxBottom;
    for (let index = 0; index < placedRows.length; index += 1) {
      placedRows[index].top = Math.max(minTop, placedRows[index].top - overflow);
    }
  }

  for (let index = 1; index < placedRows.length; index += 1) {
    const prev = placedRows[index - 1];
    const current = placedRows[index];
    const minCurrentTop = prev.top + prev.cardHeightPx + gapPx;
    if (current.top < minCurrentTop) {
      current.top = minCurrentTop;
    }
  }

  for (const row of placedRows) {
    const maxTopForRow = Math.max(minTop, maxBottom - row.cardHeightPx);
    hintTopById[row.id] = Math.round(clamp(row.top, minTop, maxTopForRow));
  }

  return { hintTopById, hintLeftPx, hintWidthPx };
}

interface HighlightLayerProps<T_HT> {
  highlightsByPage: { [pageNumber: string]: Array<T_HT> };
  pageNumber: string;
  scrolledToHighlightId: string;
  highlightTransform: (
    highlight: T_ViewportHighlight<T_HT>,
    index: number,
    setTip: (
      highlight: T_ViewportHighlight<T_HT>,
      callback: (highlight: T_ViewportHighlight<T_HT>) => JSX.Element,
    ) => void,
    hideTip: () => void,
    viewportToScaled: (rect: LTWHP) => Scaled,
    screenshot: (position: LTWH) => string,
    isScrolledTo: boolean,
    pageMetrics: {
      width: number;
      height: number;
      pageNumber: number;
      overlayHintTopById?: Record<string, number>;
      overlayHintLeftPx?: number;
      overlayHintWidthPx?: number;
    },
  ) => JSX.Element;
  tip: {
    highlight: T_ViewportHighlight<T_HT>;
    callback: (highlight: T_ViewportHighlight<T_HT>) => JSX.Element;
  } | null;
  scaledPositionToViewport: (scaledPosition: ScaledPosition) => Position;
  hideTipAndSelection: () => void;
  viewer: PDFViewer;
  screenshot: (position: LTWH, pageNumber: number) => string;
  showTip: (highlight: T_ViewportHighlight<T_HT>, content: JSX.Element) => void;
  setTip: (state: {
    highlight: T_ViewportHighlight<T_HT>;
    callback: (highlight: T_ViewportHighlight<T_HT>) => JSX.Element;
  }) => void;
}

export function HighlightLayer<T_HT extends IHighlight>({
  highlightsByPage,
  scaledPositionToViewport,
  pageNumber,
  scrolledToHighlightId,
  highlightTransform,
  tip,
  hideTipAndSelection,
  viewer,
  screenshot,
  showTip,
  setTip,
}: HighlightLayerProps<T_HT>) {
  const currentHighlights = highlightsByPage[String(pageNumber)] || [];
  const pageNumberInt = Number.parseInt(pageNumber, 10);
  const pageView = viewer.getPageView(pageNumberInt - 1);
  const pageWidth =
    pageView?.div?.offsetWidth ||
    pageView?.div?.getBoundingClientRect().width ||
    pageView?.viewport?.width ||
    0;
  const pageHeight =
    pageView?.div?.offsetHeight ||
    pageView?.div?.getBoundingClientRect().height ||
    pageView?.viewport?.height ||
    0;
  const viewportHighlights = currentHighlights.map((highlight) => ({
    ...highlight,
    position: scaledPositionToViewport(highlight.position),
  }));
  const overlayHintLayout = computeOverlayHintLayout(
    viewportHighlights,
    pageWidth,
    pageHeight,
  );

  return (
    <div>
      {viewportHighlights.map((viewportHighlight, index) => {
        const highlight = viewportHighlight;

        if (tip && tip.highlight.id === String(highlight.id)) {
          showTip(viewportHighlight, tip.callback(viewportHighlight));
        }

        const isScrolledTo = Boolean(scrolledToHighlightId === highlight.id);

        return highlightTransform(
          viewportHighlight,
          index,
          (highlight, callback) => {
            setTip({ highlight, callback });
            showTip(highlight, callback(highlight));
          },
          hideTipAndSelection,
          (rect) => {
            const viewport = viewer.getPageView(
              (rect.pageNumber || Number.parseInt(pageNumber)) - 1,
            ).viewport;

            return viewportToScaled(rect, viewport);
          },
          (boundingRect) =>
            screenshot(boundingRect, Number.parseInt(pageNumber)),
          isScrolledTo,
          {
            width: pageWidth,
            height: pageHeight,
            pageNumber: pageNumberInt,
            overlayHintTopById: overlayHintLayout.hintTopById,
            overlayHintLeftPx: overlayHintLayout.hintLeftPx,
            overlayHintWidthPx: overlayHintLayout.hintWidthPx,
          },
        );
      })}
    </div>
  );
}
