export const theme = {
  text: {
    primary: '#E8EEF9',
    secondary: '#8B9AB4',
    link: '#A7C4FF',
    accent: '#7FA9FF',
    mention: '#9DBBFF',
    response: '#E8EEF9',
    user: '#B9D1FF',
  },
  background: {
    primary: '#0F172A',
    diff: {
      added: '#12263C',
      removed: '#1C2338',
    },
  },
  border: {
    default: '#41516D',
    focused: '#7FA9FF',
  },
  ui: {
    comment: '#6D7F9B',
    symbol: '#6D7F9B',
    dark: '#22304B',
    gradient: ['#6D90F5', '#8BAEFF', '#B6D1FF'],
    brand: {
      strong: '#6D90F5',
      medium: '#8BAEFF',
      soft: '#B6D1FF',
      subtle: '#5B7097',
    },
    cursor: {
      background: '#8BAEFF',
      text: '#0F172A',
    },
  },
  status: {
    error: '#6E85B7',
    success: '#9FC5FF',
    warning: '#83A8F2',
  },
} as const
