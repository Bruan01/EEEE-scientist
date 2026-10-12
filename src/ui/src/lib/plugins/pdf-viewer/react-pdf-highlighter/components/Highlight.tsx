import { cn } from "@/lib/utils";
import styles from "../style/Highlight.module.css";
import type { LTWHP } from "../types.js";

interface Props {
  position: {
    boundingRect: LTWHP;
    rects: Array<LTWHP>;
  };
  onClick?: () => void;
  onMouseOver?: () => void;
  onMouseOut?: () => void;
  comment: {
    emoji: string;
    text: string;
  };
  color?: string;
  isScrolledTo: boolean;
  hidden?: boolean;
  emphasized?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
  showOverlayHint?: boolean;
  overlayHintText?: string;
  overlayHintTitle?: string;
  overlayHintBorderColor?: string;
  overlayHintTextColor?: string;
  overlayHintBackgroundColor?: string;
  overlayHintOffsetY?: number;
  overlayHintTopPx?: number;
  overlayHintLeftPx?: number;
  overlayHintWidthPx?: number;
  overlayHintPageHeightPx?: number;
  onOverlayHintClick?: () => void;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = Number.parseInt(m[1], 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}

function rgba(hex: string, alpha: number): string {
  const rgb = hexToRgb(hex);
  const a = clamp01(alpha);
  if (!rgb) return `rgba(241, 233, 208, ${a})`;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${a})`;
}

export function Highlight({
  position,
  onClick,
  onMouseOver,
  onMouseOut,
  comment,
  color,
  isScrolledTo,
  hidden = false,
  emphasized = false,
  onHoverStart,
  onHoverEnd,
  showOverlayHint = false,
  overlayHintText = "View details",
  overlayHintTitle,
  overlayHintBorderColor,
  overlayHintTextColor,
  overlayHintBackgroundColor,
  overlayHintOffsetY = 0,
  overlayHintTopPx,
  overlayHintLeftPx,
  overlayHintWidthPx,
  overlayHintPageHeightPx,
  onOverlayHintClick,
}: Props) {
  if (hidden) return null;

  const { rects } = position;
  const normalizedHintText = String(overlayHintText || "").trim() || "Annotation";
  const [primaryLine, secondaryLine] = normalizedHintText
    .split("\n")
    .filter(Boolean);
  const kind = comment?.emoji === "question" || comment?.emoji === "task" ? comment.emoji : "note";
  const kindClass =
    kind === "question"
      ? styles.partQuestion
      : kind === "task"
        ? styles.partTask
        : styles.partNote;
  const alpha = kind === "question" ? 0.1 : kind === "task" ? 0.08 : 0.14;

  const firstRect = rects[0];
  const hintTop = firstRect
    ? Math.max(0, Number(firstRect.top || 0) + Number(firstRect.height || 0) * 0.5 - 9)
    : 0;
  const HINT_HEIGHT_ESTIMATE = 88;
  const hasLayoutTop = typeof overlayHintTopPx === "number" && Number.isFinite(overlayHintTopPx);
  const rawHintTop = hasLayoutTop
    ? Math.max(0, overlayHintTopPx)
    : Math.max(0, hintTop + overlayHintOffsetY);
  const boundedHintTop =
    hasLayoutTop || !(typeof overlayHintPageHeightPx === "number" && Number.isFinite(overlayHintPageHeightPx))
      ? rawHintTop
      : Math.max(0, Math.min(rawHintTop, overlayHintPageHeightPx - HINT_HEIGHT_ESTIMATE));

  return (
    <div
      className={`Highlight ${styles.highlight} ${isScrolledTo ? styles.scrolledTo : ""}`}
    >
      <div className={`Highlight__parts ${styles.parts}`}>
        {rects.map((rect, index) => (
          <div
            onMouseOver={() => {
              onMouseOver?.();
              onHoverStart?.();
            }}
            onMouseOut={() => {
              onMouseOut?.();
              onHoverEnd?.();
            }}
            onClick={onClick}
            // biome-ignore lint/suspicious/noArrayIndexKey: We can use position hash at some point in future
            key={index}
            data-ds-highlight-target="true"
            style={{
              ...rect,
              backgroundColor: rgba(color || "#F1E9D0", alpha),
            }}
            className={cn(
              "Highlight__part",
              styles.part,
              kindClass,
              emphasized ? styles.partFocused : null,
            )}
          />
        ))}
      </div>
      {showOverlayHint && firstRect ? (
        <button
          type="button"
          data-ds-overlay-hint="true"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            if (onOverlayHintClick) {
              onOverlayHintClick();
              return;
            }
            onClick?.();
          }}
          onMouseEnter={() => onHoverStart?.()}
          onMouseLeave={() => onHoverEnd?.()}
          className={cn(styles.hintChip, emphasized ? styles.hintChipFocused : null)}
          style={{
            top: boundedHintTop,
            ...(typeof overlayHintLeftPx === "number" && Number.isFinite(overlayHintLeftPx)
              ? { left: overlayHintLeftPx }
              : {}),
            ...(typeof overlayHintWidthPx === "number" && Number.isFinite(overlayHintWidthPx)
              ? { width: overlayHintWidthPx, maxWidth: overlayHintWidthPx }
              : {}),
            ...(overlayHintBorderColor ? { borderColor: overlayHintBorderColor } : {}),
            ...(overlayHintTextColor ? { color: overlayHintTextColor } : {}),
            ...(overlayHintBackgroundColor ? { background: overlayHintBackgroundColor } : {}),
          }}
          aria-label={overlayHintTitle || normalizedHintText}
        >
          <div className={styles.hintPrimaryLine}>{primaryLine || normalizedHintText}</div>
          {secondaryLine ? <div className={styles.hintSecondaryLine}>{secondaryLine}</div> : null}
        </button>
      ) : null}
    </div>
  );
}
