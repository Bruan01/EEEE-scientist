import React, { useCallback, useEffect, useRef, useState } from "react";
import styles from "../style/TipContainer.module.css";
import type { LTWHP } from "../types";

interface Props {
  children: JSX.Element | null;
  style: {
    selectionLeft: number;
    selectionRight: number;
    selectionTop: number;
    selectionBottom: number;
  };
  scrollTop: number;
  pageBoundingRect: LTWHP;
  pageOffset: { left: number; top: number };
  tipPlacementMode?: "auto" | "overlay" | "right";
}

function clamp(value: number, left: number, right: number) {
  return Math.min(Math.max(value, left), right);
}

export function TipContainer({
  children,
  style,
  scrollTop,
  pageBoundingRect,
  pageOffset,
  tipPlacementMode = "auto",
}: Props) {
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  const nodeRef = useRef<HTMLDivElement | null>(null);

  const updatePosition = useCallback(() => {
    if (!nodeRef.current) {
      return;
    }
    const { offsetHeight, offsetWidth } = nodeRef.current;
    setHeight(offsetHeight);
    setWidth(offsetWidth);
  }, []);

  useEffect(() => {
    setTimeout(updatePosition, 0);
  }, [updatePosition]);

  useEffect(() => {
    if (!nodeRef.current || typeof ResizeObserver === "undefined") {
      return;
    }
    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(nodeRef.current);
    return () => observer.disconnect();
  }, [updatePosition]);

  const isStyleCalculationInProgress = width === 0 && height === 0;

  const gap = 12;

  const pageLeft = pageOffset.left;
  const pageTop = pageOffset.top;
  const minLeft = pageLeft + gap;
  const maxLeft = pageLeft + pageBoundingRect.width - width - gap;
  const minTop = pageTop + gap;
  const maxTop = pageTop + pageBoundingRect.height - height - gap;

  const selectionCenterX = (style.selectionLeft + style.selectionRight) / 2;

  const spaceRight =
    pageLeft + pageBoundingRect.width - style.selectionRight - gap;
  const spaceLeft = style.selectionLeft - pageLeft - gap;

  let left = clamp(selectionCenterX - width / 2, minLeft, maxLeft);
  let top = clamp(style.selectionTop, minTop, maxTop);

  const canPlaceRight = spaceRight >= width;
  const canPlaceLeft = spaceLeft >= width;
  const forceOverlay = tipPlacementMode === "overlay";
  const forceRight = tipPlacementMode === "right";
  const shouldMove = style.selectionTop - height - gap < scrollTop;

  if (forceRight) {
    left = maxLeft;
    const centeredTop =
      style.selectionTop + (style.selectionBottom - style.selectionTop) / 2 - height / 2;
    top = clamp(centeredTop, minTop, maxTop);
  } else if (!forceOverlay && canPlaceRight) {
    left = style.selectionRight + gap;
  } else if (!forceOverlay && canPlaceLeft) {
    left = style.selectionLeft - width - gap;
  } else {
    top = shouldMove
      ? style.selectionBottom + gap
      : style.selectionTop - height - gap;
    top = clamp(top, minTop, maxTop);
    left = clamp(selectionCenterX - width / 2, minLeft, maxLeft);
  }

  const handleUpdate = useCallback(() => {
    setWidth(0);
    setHeight(0);
    setTimeout(updatePosition, 0);
  }, [updatePosition]);

  const childrenWithProps = React.Children.map(children, (child) =>
    child != null
      ? React.cloneElement(child, {
          onUpdate: handleUpdate,
          popup: {
            position: shouldMove ? "below" : "above",
          },
        })
      : null,
  );

  return (
    <div
      id="PdfHighlighter__tip-container"
      className={styles.tipContainer}
      style={{
        visibility: isStyleCalculationInProgress ? "hidden" : "visible",
        top,
        left,
      }}
      ref={nodeRef}
    >
      {childrenWithProps}
    </div>
  );
}
