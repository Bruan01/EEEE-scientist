import type { PDFDocumentProxy } from "pdfjs-dist";
import type { EventBus, PDFViewer } from "pdfjs-dist/legacy/web/pdf_viewer.mjs";
import type { PDFViewerOptions } from "pdfjs-dist/types/web/pdf_viewer";
import React, {
  type PointerEventHandler,
  PureComponent,
  type RefObject,
} from "react";
import { type Root, createRoot } from "react-dom/client";
import { debounce } from "../lib/debounce";
import { scaledToViewport, viewportToScaled } from "../lib/coordinates";
import { getAreaAsPNG } from "../lib/get-area-as-png";
import { getBoundingRect } from "../lib/get-bounding-rect";
import { getClientRects } from "../lib/get-client-rects";
import {
  findOrCreateContainerLayer,
  getPageFromElement,
  getPagesFromRange,
  getWindow,
  isHTMLElement,
} from "../lib/pdfjs-dom";
import styles from "../style/PdfHighlighter.module.css";
import type {
  IHighlight,
  LTWH,
  LTWHP,
  Position,
  Scaled,
  ScaledPosition,
} from "../types";
import { HighlightLayer } from "./HighlightLayer";
import { MouseSelection } from "./MouseSelection";
import { TipContainer } from "./TipContainer";

export type T_ViewportHighlight<T_HT> = { position: Position } & T_HT;

interface State<T_HT> {
  ghostHighlight: {
    position: ScaledPosition;
    content?: { text?: string; image?: string };
    id?: string;
    comment?: { text: string; emoji: string };
    __dsGhost?: true;
  } | null;
  isCollapsed: boolean;
  range: Range | null;
  tip: {
    highlight: T_ViewportHighlight<T_HT>;
    callback: (highlight: T_ViewportHighlight<T_HT>) => JSX.Element;
  } | null;
  tipPosition: Position | null;
  tipChildren: JSX.Element | null;
  isAreaSelectionInProgress: boolean;
  scrolledToHighlightId: string;
  pinnedTipHighlightId: string | null;
}

interface Props<T_HT> {
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
  highlights: Array<T_HT>;
  onScrollChange: () => void;
  scrollRef: (scrollTo: (highlight: T_HT) => void) => void;
  pdfDocument: PDFDocumentProxy;
  pdfScaleValue: string;
  onPageChange?: (pageNumber: number) => void;
  onSelectionFinished: (
    position: ScaledPosition,
    content: { text?: string; image?: string },
    hideTipAndSelection: () => void,
    transformSelection: () => void,
  ) => JSX.Element | null;
  enableAreaSelection: (event: MouseEvent) => boolean;
  pdfViewerOptions?: PDFViewerOptions;
  tipPlacementMode?: "auto" | "overlay" | "right";
}

const EMPTY_ID = "empty-id";
const GHOST_HIGHLIGHT_ID = "__ds_ghost__";

export class PdfHighlighter<T_HT extends IHighlight> extends PureComponent<
  Props<T_HT>,
  State<T_HT>
> {
  static defaultProps = {
    pdfScaleValue: "auto",
  };

  state: State<T_HT> = {
    ghostHighlight: null,
    isCollapsed: true,
    range: null,
    scrolledToHighlightId: EMPTY_ID,
    isAreaSelectionInProgress: false,
    tip: null,
    tipPosition: null,
    tipChildren: null,
    pinnedTipHighlightId: null,
  };

  viewer!: PDFViewer;

  resizeObserver: ResizeObserver | null = null;
  containerNode?: HTMLDivElement | null = null;
  containerNodeRef: RefObject<HTMLDivElement>;
  highlightRoots: {
    [page: number]: { reactRoot: Root; container: Element };
  } = {};
  private highlightRootByContainer: WeakMap<Element, Root> = new WeakMap();
  unsubscribe = () => {};
  private selectionRafId: number | null = null;
  private scrollPageIntoViewPatched = false;
  private scrollMatchIntoViewPatched = false;

  constructor(props: Props<T_HT>) {
    super(props);
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.debouncedScaleValue);
    }
    this.containerNodeRef = React.createRef();
  }

  componentDidMount() {
    this.init();
  }

  onPageChanging = (event: { pageNumber?: number }) => {
    const pageNumber = event?.pageNumber;
    if (typeof pageNumber === "number") {
      this.props.onPageChange?.(pageNumber);
    }
  };

  attachRef = (eventBus: EventBus) => {
    const { resizeObserver: observer } = this;
    this.containerNode = this.containerNodeRef.current;
    this.unsubscribe();

    if (this.containerNode) {
      const { ownerDocument: doc } = this.containerNode;
      eventBus.on("textlayerrendered", this.onTextLayerRendered);
      eventBus.on("pagesinit", this.onDocumentReady);
      eventBus.on("pagechanging", this.onPageChanging);
      doc.addEventListener("selectionchange", this.onSelectionChange);
      doc.addEventListener("keydown", this.handleKeyDown);
      doc.defaultView?.addEventListener("resize", this.debouncedScaleValue);
      if (observer) observer.observe(this.containerNode);

      this.unsubscribe = () => {
        eventBus.off("pagesinit", this.onDocumentReady);
        eventBus.off("textlayerrendered", this.onTextLayerRendered);
        eventBus.off("pagechanging", this.onPageChanging);
        doc.removeEventListener("selectionchange", this.onSelectionChange);
        doc.removeEventListener("keydown", this.handleKeyDown);
        doc.defaultView?.removeEventListener(
          "resize",
          this.debouncedScaleValue,
        );
        if (observer) observer.disconnect();
      };
    }
  };

  componentDidUpdate(prevProps: Props<T_HT>) {
    if (prevProps.pdfDocument !== this.props.pdfDocument) {
      this.init();
      return;
    }
    if (prevProps.pdfScaleValue !== this.props.pdfScaleValue) {
      this.handleScaleValue();
    }
    if (prevProps.highlights !== this.props.highlights) {
      this.renderHighlightLayers();
      const pinnedId = this.state.pinnedTipHighlightId;
      if (pinnedId) {
        const pinnedCallback =
          this.state.tip && String(this.state.tip.highlight.id) === pinnedId
            ? this.state.tip.callback
            : undefined;
        this.setPinnedTipForHighlight(pinnedId, pinnedCallback);
      }
    }
  }

  private findViewportHighlightById(
    highlightId: string,
  ): T_ViewportHighlight<T_HT> | null {
    const matched = this.props.highlights.find(
      (item) => String(item.id) === String(highlightId),
    );
    if (!matched) return null;
    return {
      ...matched,
      position: this.scaledPositionToViewport(matched.position),
    };
  }

  public setPinnedTipForHighlight = (
    highlightId: string | null,
    callback?: (highlight: T_ViewportHighlight<T_HT>) => JSX.Element,
  ) => {
    if (!highlightId) {
      this.setState(
        {
          pinnedTipHighlightId: null,
          tip: null,
          tipPosition: null,
          tipChildren: null,
        },
        () => this.renderHighlightLayers(),
      );
      return;
    }

    const viewportHighlight = this.findViewportHighlightById(highlightId);
    if (!viewportHighlight) {
      this.setState(
        {
          pinnedTipHighlightId: null,
          tip: null,
          tipPosition: null,
          tipChildren: null,
        },
        () => this.renderHighlightLayers(),
      );
      return;
    }

    const resolvedCallback =
      callback ||
      (this.state.tip && String(this.state.tip.highlight.id) === String(highlightId)
        ? this.state.tip.callback
        : undefined);
    if (!resolvedCallback) return;

    this.setState(
      {
        pinnedTipHighlightId: String(highlightId),
        tip: {
          highlight: viewportHighlight,
          callback: resolvedCallback,
        },
      },
      () => {
        this.setTip(
          viewportHighlight.position,
          resolvedCallback(viewportHighlight),
        );
        this.renderHighlightLayers();
      },
    );
  };

  async init() {
    const { pdfDocument, pdfViewerOptions } = this.props;
    const pdfjs = await import("pdfjs-dist/web/pdf_viewer.mjs");

    const eventBus = new pdfjs.EventBus();
    const linkService = new pdfjs.PDFLinkService({
      eventBus,
      externalLinkTarget: 2,
    });

    if (!this.containerNodeRef.current) {
      return;
    }

    this.viewer =
      this.viewer ||
      new pdfjs.PDFViewer({
        container: this.containerNodeRef.current,
        eventBus: eventBus,
        // enhanceTextSelection: true, // deprecated. https://github.com/mozilla/pdf.js/issues/9943#issuecomment-409369485
        textLayerMode: 2,
        removePageBorders: true,
        linkService: linkService,
        ...pdfViewerOptions,
      });

    this.patchScrollPageIntoView();
    this.patchScrollMatchIntoView(pdfjs);

    linkService.setDocument(pdfDocument);
    linkService.setViewer(this.viewer);
    this.viewer.setDocument(pdfDocument);

    this.attachRef(eventBus);
  }

  private patchScrollPageIntoView() {
    if (this.scrollPageIntoViewPatched || !this.viewer) return;
    const original = this.viewer.scrollPageIntoView.bind(this.viewer);
    this.viewer.scrollPageIntoView = (params) => {
      if (!this.isViewerScrollable()) return;
      const pageNumber = params?.pageNumber;
      if (typeof pageNumber === "number") {
        const pageView = this.viewer.getPageView(pageNumber - 1);
        if (!pageView?.div || !pageView.div.offsetParent) return;
      }
      original(params);
    };
    this.scrollPageIntoViewPatched = true;
  }

  private patchScrollMatchIntoView(pdfjs: any) {
    if (this.scrollMatchIntoViewPatched) return;
    const controller = pdfjs?.PDFFindController?.prototype;
    if (!controller || typeof controller.scrollMatchIntoView !== "function") return;
    const original = controller.scrollMatchIntoView;
    controller.scrollMatchIntoView = function (params: { element?: Element | null } = {}) {
      const element = params.element as HTMLElement | null;
      if (!element || !element.isConnected || !element.offsetParent) {
        return;
      }
      return original.call(this, params);
    };
    this.scrollMatchIntoViewPatched = true;
  }

  componentWillUnmount() {
    Object.values(this.highlightRoots).forEach((entry) => {
      try {
        entry.reactRoot.unmount();
      } catch {
        // noop
      }
    });
    this.highlightRoots = {};
    this.highlightRootByContainer = new WeakMap();
    this.unsubscribe();
  }

  findOrCreateHighlightLayer(page: number) {
    if (!this.viewer) {
      return null;
    }

    const { textLayer } = this.viewer.getPageView(page - 1) || {};

    if (!textLayer) {
      return null;
    }

    return findOrCreateContainerLayer(
      textLayer.div,
      `PdfHighlighter__highlight-layer ${styles.highlightLayer}`,
      ".PdfHighlighter__highlight-layer",
    );
  }

  groupHighlightsByPage(highlights: Array<T_HT>): {
    [pageNumber: string]: Array<T_HT>;
  } {
    const { ghostHighlight } = this.state;

    const allHighlights = [...highlights, ghostHighlight].filter(
      Boolean,
    ) as T_HT[];

    const pageNumbers = new Set<number>();
    for (const highlight of allHighlights) {
      pageNumbers.add(highlight.position.pageNumber);
      for (const rect of highlight.position.rects) {
        if (rect.pageNumber) {
          pageNumbers.add(rect.pageNumber);
        }
      }
    }

    const groupedHighlights: Record<number, T_HT[]> = {};

    for (const pageNumber of pageNumbers) {
      groupedHighlights[pageNumber] = groupedHighlights[pageNumber] || [];
      for (const highlight of allHighlights) {
        const pageSpecificHighlight = {
          ...highlight,
          position: {
            pageNumber,
            boundingRect: highlight.position.boundingRect,
            rects: [],
            usePdfCoordinates: highlight.position.usePdfCoordinates,
          } as ScaledPosition,
        };
        let anyRectsOnPage = false;
        for (const rect of highlight.position.rects) {
          if (
            pageNumber === (rect.pageNumber || highlight.position.pageNumber)
          ) {
            pageSpecificHighlight.position.rects.push(rect);
            anyRectsOnPage = true;
          }
        }
        if (anyRectsOnPage || pageNumber === highlight.position.pageNumber) {
          groupedHighlights[pageNumber].push(pageSpecificHighlight);
        }
      }
    }

    return groupedHighlights;
  }

  showTip(highlight: T_ViewportHighlight<T_HT>, content: JSX.Element) {
    const {
      isCollapsed,
      ghostHighlight,
      isAreaSelectionInProgress,
      pinnedTipHighlightId,
    } = this.state;

    if (
      pinnedTipHighlightId &&
      String(highlight.id) !== String(pinnedTipHighlightId)
    ) {
      return;
    }

    const highlightInProgress = !isCollapsed || ghostHighlight;

    if (highlightInProgress || isAreaSelectionInProgress) {
      return;
    }

    this.setTip(highlight.position, content);
  }

  scaledPositionToViewport({
    pageNumber,
    boundingRect,
    rects,
    usePdfCoordinates,
  }: ScaledPosition): Position {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;

    return {
      boundingRect: scaledToViewport(boundingRect, viewport, usePdfCoordinates),
      rects: (rects || []).map((rect) =>
        scaledToViewport(rect, viewport, usePdfCoordinates),
      ),
      pageNumber,
    };
  }

  viewportPositionToScaled({
    pageNumber,
    boundingRect,
    rects,
  }: Position): ScaledPosition {
    const viewport = this.viewer.getPageView(pageNumber - 1).viewport;

    return {
      boundingRect: viewportToScaled(boundingRect, viewport),
      rects: (rects || []).map((rect) => viewportToScaled(rect, viewport)),
      pageNumber,
    };
  }

  screenshot(position: LTWH, pageNumber: number) {
    const canvas = this.viewer.getPageView(pageNumber - 1).canvas;

    return getAreaAsPNG(canvas, position);
  }

  hideTipAndSelection = () => {
    if (this.state.pinnedTipHighlightId) {
      return;
    }

    if (this.selectionRafId != null) {
      cancelAnimationFrame(this.selectionRafId);
      this.selectionRafId = null;
    }
    const container = this.containerNode;
    if (container) {
      const selection = getWindow(container).getSelection();
      selection?.removeAllRanges();
    }

    this.setState(
      {
        tipPosition: null,
        tipChildren: null,
        ghostHighlight: null,
        tip: null,
        range: null,
        isCollapsed: true,
      },
      () => this.renderHighlightLayers(),
    );
  };

  private buildGhostHighlight(
    position: ScaledPosition,
    text?: string,
  ): State<T_HT>["ghostHighlight"] {
    return {
      __dsGhost: true,
      id: GHOST_HIGHLIGHT_ID,
      position,
      content: text ? { text } : undefined,
      // Default preview style -> Note (yellow)
      comment: { text: "", emoji: "note" },
    };
  }

  private scheduleGhostHighlightUpdate(range: Range) {
    if (this.selectionRafId != null) {
      cancelAnimationFrame(this.selectionRafId);
    }
    this.selectionRafId = requestAnimationFrame(() => {
      this.selectionRafId = null;
      const { isAreaSelectionInProgress } = this.state;
      if (isAreaSelectionInProgress) return;

      const pages = getPagesFromRange(range);
      if (!pages || pages.length === 0) return;

      const rects = getClientRects(range, pages);
      if (rects.length === 0) return;

      const boundingRect = getBoundingRect(rects);
      const viewportPosition: Position = {
        boundingRect,
        rects,
        pageNumber: pages[0].number,
      };

      const scaledPosition = this.viewportPositionToScaled(viewportPosition);
      const nextGhost = this.buildGhostHighlight(
        scaledPosition,
        range.toString(),
      );

      this.setState(
        {
          ghostHighlight: nextGhost,
        },
        () => this.renderHighlightLayers(),
      );
    });
  }

  setTip(position: Position, inner: JSX.Element | null) {
    this.setState({
      tipPosition: position,
      tipChildren: inner,
    });
  }

  renderTip = () => {
    const { tipPosition, tipChildren } = this.state;
    if (!tipPosition) return null;

    const { boundingRect, pageNumber } = tipPosition;
    const page = {
      node: this.viewer.getPageView((boundingRect.pageNumber || pageNumber) - 1)
        .div,
      pageNumber: boundingRect.pageNumber || pageNumber,
    };

    const pageBoundingClientRect = page.node.getBoundingClientRect();

    const pageBoundingRect = {
      bottom: pageBoundingClientRect.bottom,
      height: pageBoundingClientRect.height,
      left: pageBoundingClientRect.left,
      right: pageBoundingClientRect.right,
      top: pageBoundingClientRect.top,
      width: pageBoundingClientRect.width,
      x: pageBoundingClientRect.x,
      y: pageBoundingClientRect.y,
      pageNumber: page.pageNumber,
    };

    const selectionLeft = page.node.offsetLeft + boundingRect.left;
    const selectionRight = selectionLeft + boundingRect.width;
    const selectionTop = boundingRect.top + page.node.offsetTop;
    const selectionBottom = selectionTop + boundingRect.height;

    return (
      <TipContainer
        scrollTop={this.viewer.container.scrollTop}
        pageBoundingRect={pageBoundingRect}
        pageOffset={{ left: page.node.offsetLeft, top: page.node.offsetTop }}
        tipPlacementMode={this.props.tipPlacementMode}
        style={{
          selectionLeft,
          selectionRight,
          selectionTop,
          selectionBottom,
        }}
      >
        {tipChildren}
      </TipContainer>
    );
  };

  onTextLayerRendered = () => {
    this.renderHighlightLayers();
  };

  isViewerScrollable = () => {
    const container = this.viewer?.container;
    if (!container) return false;
    if (!container.isConnected) return false;
    return Boolean(container.offsetParent);
  };

  scrollTo = (highlight: T_HT) => {
    const { pageNumber, boundingRect, usePdfCoordinates } = highlight.position;

    if (!this.isViewerScrollable()) {
      this.setState(
        {
          scrolledToHighlightId: highlight.id,
        },
        () => this.renderHighlightLayers(),
      );
      return;
    }

    const pageView = this.viewer.getPageView(pageNumber - 1);
    if (!pageView?.div || !pageView.div.offsetParent) {
      return;
    }

    this.viewer.container.removeEventListener("scroll", this.onScroll);

    const pageViewport = pageView.viewport;

    const scrollMargin = 10;

    this.viewer.scrollPageIntoView({
      pageNumber,
      destArray: [
        null,
        { name: "XYZ" },
        ...pageViewport.convertToPdfPoint(
          0,
          scaledToViewport(boundingRect, pageViewport, usePdfCoordinates).top -
            scrollMargin,
        ),
        0,
      ],
    });

    this.setState(
      {
        scrolledToHighlightId: highlight.id,
      },
      () => this.renderHighlightLayers(),
    );

    // wait for scrolling to finish
    setTimeout(() => {
      this.viewer.container.addEventListener("scroll", this.onScroll);
    }, 100);
  };

  scrollToPage = (pageNumber: number) => {
    if (!this.viewer) return;
    if (!this.isViewerScrollable()) return;
    this.viewer.currentPageNumber = pageNumber;
  };

  onDocumentReady = () => {
    const { scrollRef } = this.props;

    this.handleScaleValue();

    scrollRef(this.scrollTo);
    this.props.onPageChange?.(this.viewer.currentPageNumber || 1);
  };

  onSelectionChange = () => {
    const container = this.containerNode;
    if (!container) {
      return;
    }

    const selection = getWindow(container).getSelection();
    if (!selection) {
      return;
    }

    const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    if (selection.isCollapsed) {
      this.setState({ isCollapsed: true, range: null, ghostHighlight: null }, () =>
        this.renderHighlightLayers(),
      );
      return;
    }

    if (
      !range ||
      !container ||
      !container.contains(range.commonAncestorContainer)
    ) {
      return;
    }

    const nextRange = range.cloneRange();

    this.setState({
      isCollapsed: false,
      range: nextRange,
    });

    // Real-time highlight preview while dragging selection (original selection stays intact).
    this.scheduleGhostHighlightUpdate(nextRange);
    this.debouncedAfterSelection();
  };

  onScroll = () => {
    const { onScrollChange } = this.props;

    onScrollChange();

    this.setState(
      {
        scrolledToHighlightId: EMPTY_ID,
      },
      () => this.renderHighlightLayers(),
    );

    this.viewer.container.removeEventListener("scroll", this.onScroll);
  };

  onMouseDown: PointerEventHandler = (event) => {
    if (this.state.pinnedTipHighlightId) {
      return;
    }

    if (!(event.target instanceof Element) || !isHTMLElement(event.target)) {
      return;
    }

    if (event.target.closest("#PdfHighlighter__tip-container")) {
      return;
    }

    this.hideTipAndSelection();
  };

  handleKeyDown = (event: KeyboardEvent) => {
    if (this.state.pinnedTipHighlightId) {
      return;
    }

    if (event.code === "Escape") {
      this.hideTipAndSelection();
    }
  };

  afterSelection = () => {
    const { onSelectionFinished } = this.props;

    const container = this.containerNode;
    if (!container) return;

    const selection = getWindow(container).getSelection();
    const currentRange =
      selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

    const { isCollapsed } = this.state;

    if (!currentRange || isCollapsed || selection?.isCollapsed) {
      return;
    }

    const range = currentRange.cloneRange();
    const pages = getPagesFromRange(range);

    if (!pages || pages.length === 0) {
      return;
    }

    const rects = getClientRects(range, pages);

    if (rects.length === 0) {
      return;
    }

    const boundingRect = getBoundingRect(rects);

    const viewportPosition: Position = {
      boundingRect,
      rects,
      pageNumber: pages[0].number,
    };

    const content = {
      text: range.toString(),
    };
    const scaledPosition = this.viewportPositionToScaled(viewportPosition);

    this.setTip(
      viewportPosition,
      onSelectionFinished(
        scaledPosition,
        content,
        () => this.hideTipAndSelection(),
        () =>
          this.setState(
            {
              ghostHighlight: this.buildGhostHighlight(
                scaledPosition,
                content.text,
              ),
            },
            () => this.renderHighlightLayers(),
          ),
      ),
    );
  };

  debouncedAfterSelection: () => void = debounce(this.afterSelection, 320);

  toggleTextSelection(flag: boolean) {
    if (!this.viewer.viewer) {
      return;
    }
    this.viewer.viewer.classList.toggle(styles.disableSelection, flag);
  }

  handleScaleValue = () => {
    if (!this.viewer) return;
    const rawValue = this.props.pdfScaleValue;
    const relativePrefix = "page-width:";
    if (rawValue.startsWith(relativePrefix)) {
      const factor = Number.parseFloat(rawValue.slice(relativePrefix.length));
      if (!Number.isFinite(factor) || factor <= 0) {
        this.viewer.currentScaleValue = "page-width";
        return;
      }
      this.viewer.currentScaleValue = "page-width";
      const baseScale = this.viewer.currentScale;
      if (!Number.isFinite(baseScale) || baseScale <= 0) {
        return;
      }
      this.viewer.currentScaleValue = String(baseScale * factor);
      return;
    }
    this.viewer.currentScaleValue = rawValue; //"page-width";
  };

  debouncedScaleValue: () => void = debounce(this.handleScaleValue, 500);

  render() {
    const { onSelectionFinished, enableAreaSelection } = this.props;

    return (
      <div onPointerDown={this.onMouseDown}>
        <div
          ref={this.containerNodeRef}
          className={styles.container}
          style={{
            position: "absolute",
            width: "100%",
            height: "100%",
            overflow: "auto",
          }}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="pdfViewer" />
          {this.renderTip()}
          {typeof enableAreaSelection === "function" ? (
            <MouseSelection
              onDragStart={() => this.toggleTextSelection(true)}
              onDragEnd={() => this.toggleTextSelection(false)}
              onChange={(isVisible) =>
                this.setState({ isAreaSelectionInProgress: isVisible })
              }
              shouldStart={(event) =>
                enableAreaSelection(event) &&
                event.target instanceof Element &&
                isHTMLElement(event.target) &&
                Boolean(event.target.closest(".page"))
              }
              onSelection={(startTarget, boundingRect, resetSelection) => {
                const page = getPageFromElement(startTarget);

                if (!page) {
                  return;
                }

                const pageBoundingRect = {
                  ...boundingRect,
                  top: boundingRect.top - page.node.offsetTop,
                  left: boundingRect.left - page.node.offsetLeft,
                  pageNumber: page.number,
                };

                const viewportPosition = {
                  boundingRect: pageBoundingRect,
                  rects: [],
                  pageNumber: page.number,
                };

                const scaledPosition =
                  this.viewportPositionToScaled(viewportPosition);

                const image = this.screenshot(
                  pageBoundingRect,
                  pageBoundingRect.pageNumber,
                );

                this.setTip(
                  viewportPosition,
                  onSelectionFinished(
                    scaledPosition,
                    { image },
                    () => this.hideTipAndSelection(),
                    () => {
                      console.log("setting ghost highlight", scaledPosition);
                      this.setState(
                        {
                          ghostHighlight: {
                            position: scaledPosition,
                            content: { image },
                          },
                        },
                        () => {
                          resetSelection();
                          this.renderHighlightLayers();
                        },
                      );
                    },
                  ),
                );
              }}
            />
          ) : null}
        </div>
      </div>
    );
  }

  private renderHighlightLayers() {
    const { pdfDocument } = this.props;
    if (!this.viewer) {
      return;
    }

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber++) {
      const highlightRoot = this.highlightRoots[pageNumber];
      /** Need to check if container is still attached to the DOM as PDF.js can unload pages. */
      if (highlightRoot?.container.isConnected) {
        this.renderHighlightLayer(highlightRoot.reactRoot, pageNumber);
      } else {
        const highlightLayer = this.findOrCreateHighlightLayer(pageNumber);
        if (highlightLayer) {
          const reactRoot = this.getOrCreateHighlightRoot(highlightLayer);
          this.highlightRoots[pageNumber] = {
            reactRoot,
            container: highlightLayer,
          };
          this.renderHighlightLayer(reactRoot, pageNumber);
        }
      }
    }
  }

  private getOrCreateHighlightRoot(container: Element): Root {
    const existing = this.highlightRootByContainer.get(container);
    if (existing) return existing;
    const root = createRoot(container);
    this.highlightRootByContainer.set(container, root);
    return root;
  }

  private renderHighlightLayer(root: Root, pageNumber: number) {
    const { highlightTransform, highlights } = this.props;
    const { tip, scrolledToHighlightId } = this.state;
    root.render(
      <HighlightLayer
        highlightsByPage={this.groupHighlightsByPage(highlights)}
        pageNumber={pageNumber.toString()}
        scrolledToHighlightId={scrolledToHighlightId}
        highlightTransform={highlightTransform}
        tip={tip}
        scaledPositionToViewport={this.scaledPositionToViewport.bind(this)}
        hideTipAndSelection={this.hideTipAndSelection.bind(this)}
        viewer={this.viewer}
        screenshot={this.screenshot.bind(this)}
        showTip={this.showTip.bind(this)}
        setTip={(tip) => {
          if (
            this.state.pinnedTipHighlightId &&
            String(tip.highlight.id) !== String(this.state.pinnedTipHighlightId)
          ) {
            return;
          }
          this.setState({ tip });
        }}
      />,
    );
  }
}
