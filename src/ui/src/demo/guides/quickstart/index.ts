import canvasEn from './canvas.en.md?raw'
import canvasZh from './canvas.zh.md?raw'
import chatEn from './chat.en.md?raw'
import chatZh from './chat.zh.md?raw'
import detailsEn from './details.en.md?raw'
import detailsZh from './details.zh.md?raw'
import explorerEn from './explorer.en.md?raw'
import explorerZh from './explorer.zh.md?raw'
import memoryEn from './memory.en.md?raw'
import memoryZh from './memory.zh.md?raw'
import studioEn from './studio.en.md?raw'
import studioZh from './studio.zh.md?raw'

export const quickstartGuides = {
  explorer: {
    en: explorerEn,
    zh: explorerZh,
  },
  canvas: {
    en: canvasEn,
    zh: canvasZh,
  },
  details: {
    en: detailsEn,
    zh: detailsZh,
  },
  memory: {
    en: memoryEn,
    zh: memoryZh,
  },
  studio: {
    en: studioEn,
    zh: studioZh,
  },
  chat: {
    en: chatEn,
    zh: chatZh,
  },
} as const
