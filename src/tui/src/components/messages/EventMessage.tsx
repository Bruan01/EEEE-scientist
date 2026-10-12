import React from 'react'
import { theme } from '../../semantic-colors.js'
import { InfoMessage } from './InfoMessage.js'

export const EventMessage: React.FC<{ label: string; content: string; width?: number }> = ({ label, content, width = 80 }) => {
  return <InfoMessage text={`${label} · ${content}`} icon="·" color={theme.text.secondary} width={width} />
}
