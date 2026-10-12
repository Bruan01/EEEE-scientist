import React from 'react'
import { Text } from 'ink'
import stringWidth from 'string-width'
import { theme } from '../semantic-colors.js'

const BOLD_MARKER_LENGTH = 2
const ITALIC_MARKER_LENGTH = 1
const STRIKETHROUGH_MARKER_LENGTH = 2
const INLINE_CODE_MARKER_LENGTH = 1
const UNDERLINE_TAG_START_LENGTH = 3
const UNDERLINE_TAG_END_LENGTH = 4

interface RenderInlineProps {
  text: string
  defaultColor?: string
  overrideColor?: string
}

const RenderInlineInternal: React.FC<RenderInlineProps> = ({
  text,
  defaultColor,
  overrideColor,
}) => {
  const baseColor = overrideColor ?? defaultColor ?? theme.text.primary
  const accentColor = overrideColor ?? theme.text.accent
  const linkColor = overrideColor ?? theme.text.link
  const mentionColor = theme.text.mention

  const renderPlainWithMentions = (
    segment: string,
    color: string,
    mention: string,
    keyPrefix: string,
    leadingOnly: boolean
  ) => {
    if (!segment) return null
    if (!leadingOnly) {
      return [
        <Text key={`${keyPrefix}-t`} color={color}>
          {segment}
        </Text>,
      ]
    }
    const match = segment.match(/^@[a-zA-Z0-9_-]+/)
    if (!match) {
      return [
        <Text key={`${keyPrefix}-t`} color={color}>
          {segment}
        </Text>,
      ]
    }
    const mentionText = match[0]
    const rest = segment.slice(mentionText.length)
    const nodes: React.ReactNode[] = [
      <Text key={`${keyPrefix}-m`} color={mention}>
        {mentionText}
      </Text>,
    ]
    if (rest) {
      nodes.push(
        <Text key={`${keyPrefix}-t`} color={color}>
          {rest}
        </Text>
      )
    }
    return nodes
  }

  if (!/[*_~`<[https?:]/.test(text)) {
    return (
      <>
        {renderPlainWithMentions(text, baseColor, mentionColor, 'plain', true)}
      </>
    )
  }

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let isLeadingSegment = true
  const inlineRegex =
    /(\*\*.*?\*\*|\*.*?\*|_.*?_|~~.*?~~|\[.*?\]\(.*?\)|`+.+?`+|<u>.*?<\/u>|https?:\/\/\S+)/g
  let match

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const plain = text.slice(lastIndex, match.index)
      const rendered = renderPlainWithMentions(
        plain,
        baseColor,
        mentionColor,
        `t-${lastIndex}`,
        isLeadingSegment
      )
      if (rendered) {
        nodes.push(...rendered)
      }
    }
    isLeadingSegment = false

    const fullMatch = match[0]
    let renderedNode: React.ReactNode = null
    const key = `m-${match.index}`

    try {
      if (
        fullMatch.startsWith('**') &&
        fullMatch.endsWith('**') &&
        fullMatch.length > BOLD_MARKER_LENGTH * 2
      ) {
        renderedNode = (
          <Text key={key} bold color={baseColor}>
            {fullMatch.slice(BOLD_MARKER_LENGTH, -BOLD_MARKER_LENGTH)}
          </Text>
        )
      } else if (
        fullMatch.length > ITALIC_MARKER_LENGTH * 2 &&
        ((fullMatch.startsWith('*') && fullMatch.endsWith('*')) ||
          (fullMatch.startsWith('_') && fullMatch.endsWith('_'))) &&
        !/\w/.test(text.substring(match.index - 1, match.index)) &&
        !/\w/.test(text.substring(inlineRegex.lastIndex, inlineRegex.lastIndex + 1)) &&
        !/\S[./\\]/.test(text.substring(match.index - 2, match.index)) &&
        !/[./\\]\S/.test(text.substring(inlineRegex.lastIndex, inlineRegex.lastIndex + 2))
      ) {
        renderedNode = (
          <Text key={key} italic color={baseColor}>
            {fullMatch.slice(ITALIC_MARKER_LENGTH, -ITALIC_MARKER_LENGTH)}
          </Text>
        )
      } else if (
        fullMatch.startsWith('~~') &&
        fullMatch.endsWith('~~') &&
        fullMatch.length > STRIKETHROUGH_MARKER_LENGTH * 2
      ) {
        renderedNode = (
          <Text key={key} strikethrough color={baseColor}>
            {fullMatch.slice(STRIKETHROUGH_MARKER_LENGTH, -STRIKETHROUGH_MARKER_LENGTH)}
          </Text>
        )
      } else if (
        fullMatch.startsWith('`') &&
        fullMatch.endsWith('`') &&
        fullMatch.length > INLINE_CODE_MARKER_LENGTH
      ) {
        const codeMatch = fullMatch.match(/^(`+)(.+?)\1$/s)
        if (codeMatch && codeMatch[2]) {
          renderedNode = (
            <Text key={key} color={accentColor}>
              {codeMatch[2]}
            </Text>
          )
        }
      } else if (fullMatch.startsWith('[') && fullMatch.includes('](') && fullMatch.endsWith(')')) {
        const linkMatch = fullMatch.match(/\[(.*?)\]\((.*?)\)/)
        if (linkMatch) {
          const linkText = linkMatch[1]
          const url = linkMatch[2]
          renderedNode = (
            <Text key={key} color={baseColor}>
              {linkText}
              <Text color={linkColor}> ({url})</Text>
            </Text>
          )
        }
      } else if (
        fullMatch.startsWith('<u>') &&
        fullMatch.endsWith('</u>') &&
        fullMatch.length > UNDERLINE_TAG_START_LENGTH + UNDERLINE_TAG_END_LENGTH - 1
      ) {
        renderedNode = (
          <Text key={key} underline color={baseColor}>
            {fullMatch.slice(UNDERLINE_TAG_START_LENGTH, -UNDERLINE_TAG_END_LENGTH)}
          </Text>
        )
      } else if (fullMatch.match(/^https?:\/\//)) {
        renderedNode = (
          <Text key={key} color={linkColor}>
            {fullMatch}
          </Text>
        )
      }
    } catch (error) {
      console.warn('Inline markdown parse error:', error)
      renderedNode = null
    }

    nodes.push(
      renderedNode ?? (
        <Text key={key} color={baseColor}>
          {fullMatch}
        </Text>
      )
    )
    lastIndex = inlineRegex.lastIndex
  }

  if (lastIndex < text.length) {
    const plain = text.slice(lastIndex)
    const rendered = renderPlainWithMentions(
      plain,
      baseColor,
      mentionColor,
      `t-${lastIndex}`,
      isLeadingSegment
    )
    if (rendered) {
      nodes.push(...rendered)
    }
  }

  return <>{nodes.filter((node) => node !== null)}</>
}

export const RenderInline = React.memo(RenderInlineInternal)

export const getPlainTextLength = (text: string): number => {
  const cleanText = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/`(.*?)`/g, '$1')
    .replace(/<u>(.*?)<\/u>/g, '$1')
    .replace(/.*\[(.*?)\]\(.*\)/g, '$1')
  return stringWidth(cleanText)
}
