import { useEffect, useState } from 'react'

export const useTerminalSize = (): { columns: number; rows: number } => {
  const [size, setSize] = useState({
    columns: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
  })

  useEffect(() => {
    const updateSize = () => {
      setSize({
        columns: process.stdout.columns || 80,
        rows: process.stdout.rows || 24,
      })
    }

    process.stdout.on('resize', updateSize)
    return () => {
      process.stdout.off('resize', updateSize)
    }
  }, [])

  return size
}
