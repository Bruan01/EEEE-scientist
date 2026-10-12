'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MarkdownPreviewLib from '@uiw/react-markdown-preview';
import '@/styles/markdown.css';
import { getDocAssetUrl } from '@/lib/docs';
import { normalizeHeadingText, resolveRelativePosixPath, slugifyHeading } from '@/lib/docs/markdown';
import { useThemeStore } from '@/lib/stores/theme';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  /**
   * The current markdown file path (relative, POSIX) including extension.
   * Used to resolve relative links/images.
   */
  baseFilePath?: string;
  /**
   * When true, rewrite relative links to /docs routes.
   */
  rewriteDocsLinks?: boolean;
  /**
   * When true, rewrite relative images to the docs asset endpoint.
   */
  rewriteDocsImages?: boolean;
}

const BLANK_IMAGE_DATA_URI = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const reviewAssetBlobCache = new Map<string, Blob>();
const reviewAssetBlobInflight = new Map<string, Promise<Blob>>();

async function loadReviewAssetBlob(url: string, token: string): Promise<Blob> {
  const cached = reviewAssetBlobCache.get(url);
  if (cached) return cached;

  const inflight = reviewAssetBlobInflight.get(url);
  if (inflight) return inflight;

  const request = fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    credentials: 'include',
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`asset_fetch_failed:${response.status}`);
      }
      const blob = await response.blob();
      reviewAssetBlobCache.set(url, blob);
      return blob;
    })
    .finally(() => {
      reviewAssetBlobInflight.delete(url);
    });

  reviewAssetBlobInflight.set(url, request);
  return request;
}

function resolveReviewMarkdownAssetUrl(src: string): string | null {
  const trimmed = src.trim();
  if (!trimmed || typeof window === 'undefined') return null;
  try {
    const parsed = new URL(trimmed, window.location.origin);
    const isSameOrigin = parsed.origin === window.location.origin;
    const isReviewMarkdownAsset =
      parsed.pathname.startsWith('/api/v1/review/workspaces/') &&
      parsed.pathname.includes('/markdown/assets/');
    if (!isSameOrigin || !isReviewMarkdownAsset) return null;
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return null;
  }
}

type MarkdownImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { node?: unknown };

function AuthenticatedReviewMarkdownImage({ src, alt, ...rest }: MarkdownImageProps) {
  const rawSrc = typeof src === 'string' ? src : '';
  const [resolvedSrc, setResolvedSrc] = useState<string>(() => {
    const reviewAssetUrl = resolveReviewMarkdownAssetUrl(rawSrc);
    return reviewAssetUrl ? BLANK_IMAGE_DATA_URI : rawSrc;
  });
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const revokeObjectUrl = () => {
      if (!objectUrlRef.current) return;
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    };

    revokeObjectUrl();
    const reviewAssetUrl = resolveReviewMarkdownAssetUrl(rawSrc);
    if (!reviewAssetUrl) {
      setResolvedSrc(rawSrc);
      return () => {
        revokeObjectUrl();
      };
    }

    const userToken =
      typeof window !== 'undefined' ? window.localStorage.getItem('ds_access_token')?.trim() : '';
    const token = userToken || '';
    if (!token) {
      setResolvedSrc(BLANK_IMAGE_DATA_URI);
      return () => {
        revokeObjectUrl();
      };
    }

    setResolvedSrc(BLANK_IMAGE_DATA_URI);
    const controller = new AbortController();
    let active = true;

    void (async () => {
      try {
        const blob = await loadReviewAssetBlob(reviewAssetUrl, token);
        if (controller.signal.aborted) return;
        if (!active) return;
        const objectUrl = URL.createObjectURL(blob);
        objectUrlRef.current = objectUrl;
        setResolvedSrc(objectUrl);
      } catch {
        if (!active || controller.signal.aborted) return;
        setResolvedSrc(BLANK_IMAGE_DATA_URI);
      }
    })();

    return () => {
      active = false;
      controller.abort();
      revokeObjectUrl();
    };
  }, [rawSrc]);

  return <img {...rest} alt={typeof alt === 'string' ? alt : ''} src={resolvedSrc || BLANK_IMAGE_DATA_URI} />;
}

export function MarkdownPreview({
  content,
  className,
  baseFilePath,
  rewriteDocsLinks = true,
  rewriteDocsImages = true,
}: MarkdownPreviewProps) {
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const headingIds = new Map<string, number>();
  const markdownComponents = useMemo(
    () => ({
      img: ({ node: _node, ...props }: MarkdownImageProps) => <AuthenticatedReviewMarkdownImage {...props} />,
    }),
    []
  );

  const getNodeText = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string') return node;
    if (node.type === 'text') return node.value || '';
    if (Array.isArray(node.children)) return node.children.map(getNodeText).join('');
    return '';
  };

  return (
    <MarkdownPreviewLib
      source={content}
      className={className}
      style={{ backgroundColor: 'transparent' }}
      components={markdownComponents}
      wrapperElement={{ 'data-color-mode': resolvedTheme }}
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      rehypeRewrite={(node: any) => {
        if (node.type !== 'element') return;

        // External links open in new tab.
        if (node.tagName === 'a') {
          const href = node.properties?.href?.toString?.() || '';
          if (href.startsWith('http')) {
            node.properties.target = '_blank';
            node.properties.rel = 'noopener noreferrer';
            return;
          }

          // Rewrite relative markdown links to internal /docs routes.
          if (
            rewriteDocsLinks &&
            href &&
            !href.startsWith('#') &&
            !href.startsWith('/docs')
          ) {
            const isMarkdown =
              href.endsWith('.md') || href.endsWith('.markdown') || href.endsWith('.txt');
            if (isMarkdown) {
              const resolved = resolveRelativePosixPath(baseFilePath || '', href);
              const slugPath = resolved.replace(/\.(md|markdown|txt)$/i, '');
              node.properties.href = `/docs/${slugPath
                .split('/')
                .map((s: string) => encodeURIComponent(s))
                .join('/')}`;
            }
          }
        }

        // Rewrite relative images to backend assets endpoint.
        if (node.tagName === 'img') {
          const src = node.properties?.src?.toString?.() || '';
          if (
            !src ||
            src.startsWith('http') ||
            src.startsWith('data:') ||
            src.startsWith('/api/')
          ) return;
          if (rewriteDocsImages) {
            const resolved = resolveRelativePosixPath(baseFilePath || '', src);
            node.properties.src = getDocAssetUrl(resolved);
          }
        }

        // Add stable IDs to headings for TOC anchor links.
        if (/^h[1-6]$/.test(node.tagName)) {
          const text = normalizeHeadingText(getNodeText(node));
          if (!text) return;
          const base = slugifyHeading(text);
          const count = (headingIds.get(base) ?? 0) + 1;
          headingIds.set(base, count);
          node.properties.id = count === 1 ? base : `${base}-${count}`;
        }
      }}
    />
  );
}
