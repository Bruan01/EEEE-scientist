'use client'

import { Modal } from '@/components/ui/modal'
import { PremiumMessageCard } from '@/components/messages/PremiumMessageCard'
import styles from './PremiumMessageDialog.module.css'

export function PremiumMessageDialog({
  open,
  onClose,
  onDontRemind,
  onNext,
  hasNext,
  step,
  total,
  title,
  imageUrl,
  level,
  content,
  loading,
}: {
  open: boolean
  onClose: () => void
  onDontRemind: () => void
  onNext: () => void
  hasNext: boolean
  step: number
  total: number
  title: string
  imageUrl?: string
  level?: 'info' | 'warning' | 'error'
  content: string
  loading?: boolean
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      className={`border-0 rounded-[22px] w-[96vw] max-w-[72rem] max-h-[88vh] overflow-hidden ${styles.card}`}
    >
      <PremiumMessageCard
        title={title}
        imageUrl={imageUrl}
        level={level}
        content={content}
        loading={loading}
        hasNext={hasNext}
        step={step}
        total={total}
        onClose={onClose}
        onNext={onNext}
        onDontRemind={onDontRemind}
      />
    </Modal>
  )
}
