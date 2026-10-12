'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal, ModalFooter } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { AnimatedCheckbox } from '@/components/ui/animated-checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { submitFeedback } from '@/lib/api/feedback'
import styles from './FeedbackDialog.module.css'

type FeedbackType = 'bug' | 'feature' | 'improvement' | 'question' | 'info' | 'other'
type FeedbackPriority = 'low' | 'medium' | 'high' | 'critical'

export function FeedbackDialog({
  open,
  onClose,
  projectId,
  pagePath,
}: {
  open: boolean
  onClose: () => void
  projectId?: string | null
  pagePath: string
}) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [type, setType] = useState<FeedbackType>('question')
  const [priority, setPriority] = useState<FeedbackPriority>('medium')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [improvementSuggestion, setImprovementSuggestion] = useState('')
  const [includePageContext, setIncludePageContext] = useState(true)
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFormError(null)
  }, [open])

  const diagnostics = useMemo(() => {
    if (typeof window === 'undefined') return {}
    return {
      userAgent: window.navigator.userAgent,
      platform: window.navigator.platform,
      language: window.navigator.language,
      timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    }
  }, [])

  const handleSubmit = async () => {
    const cleanedTitle = title.trim()
    const cleanedDescription = description.trim()
    const cleanedImprovementSuggestion = improvementSuggestion.trim()
    if (!cleanedTitle) {
      setFormError('Title is required.')
      return
    }
    if (!cleanedDescription) {
      setFormError('Description is required.')
      return
    }

    setFormError(null)
    setIsSubmitting(true)
    try {
      const meta: Record<string, unknown> = {}
      if (includePageContext) {
        meta.pagePath = pagePath
        if (projectId) meta.projectId = projectId
      }
      if (includeDiagnostics) {
        meta.diagnostics = diagnostics
      }

      await submitFeedback({
        title: cleanedTitle,
        description: cleanedDescription,
        improvement_suggestion: cleanedImprovementSuggestion ? cleanedImprovementSuggestion : undefined,
        type,
        priority,
        project_id: projectId || undefined,
        page_path: pagePath,
        meta,
      })

      toast({
        title: 'Feedback submitted',
        description: 'Thanks — we will review it soon.',
        variant: 'success',
      })
      setTitle('')
      setDescription('')
      setImprovementSuggestion('')
      setType('question')
      setPriority('medium')
      setIncludePageContext(true)
      setIncludeDiagnostics(true)
      onClose()
    } catch (error: any) {
      toast({
        title: 'Failed to submit feedback',
        description: error?.message || 'Please try again later.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (isSubmitting) return
        onClose()
      }}
      title="Feedback"
      description="Share bugs, ideas, or questions — this goes directly to the team."
      size="lg"
      className={`w-[92vw] max-w-[32rem] max-h-[85vh] ${styles.card}`}
    >
      <div className="relative">
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={`block text-sm font-medium mb-1.5 ${styles.title}`}>Type</label>
              <Select value={type} onValueChange={(value) => setType(value as FeedbackType)}>
                <SelectTrigger className="h-12 px-4 rounded-soft-md bg-white/70 text-black border border-white/30 shadow-soft-inset focus:shadow-soft-inset-focus focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/90 text-black border border-white/40 shadow-soft-card backdrop-blur-xl">
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="bug">Bug</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="feature">Feature</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="improvement">Improvement</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="question">Question</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="info">Info</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className={`block text-sm font-medium mb-1.5 ${styles.title}`}>Priority</label>
              <Select value={priority} onValueChange={(value) => setPriority(value as FeedbackPriority)}>
                <SelectTrigger className="h-12 px-4 rounded-soft-md bg-white/70 text-black border border-white/30 shadow-soft-inset focus:shadow-soft-inset-focus focus:ring-0 focus:ring-offset-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-white/90 text-black border border-white/40 shadow-soft-card backdrop-blur-xl">
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="low">Low</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="medium">Medium</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="high">High</SelectItem>
                  <SelectItem className="text-black focus:text-black focus:bg-white/60" value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Input
            label="Title"
            placeholder="Short summary"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="bg-white/70 border border-white/30 text-black placeholder:text-black/60"
          />

          <Textarea
            label="Description"
            placeholder="What happened? What did you expect? Steps to reproduce?"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className="bg-white/70 border border-white/30 text-black placeholder:text-black/60 min-h-[160px]"
            hint={includePageContext ? `Page: ${pagePath}` : undefined}
            error={formError || undefined}
          />

          <Textarea
            label="Suggested improvements (optional)"
            placeholder="In your view, what changes would be reasonable and excellent?"
            value={improvementSuggestion}
            onChange={(event) => setImprovementSuggestion(event.target.value)}
            className="bg-white/70 border border-white/30 text-black placeholder:text-black/60 min-h-[120px]"
          />

          <div className="flex flex-wrap gap-6">
            <AnimatedCheckbox
              checked={includePageContext}
              onChange={setIncludePageContext}
              label="Include page context"
              size="sm"
            />
            <AnimatedCheckbox
              checked={includeDiagnostics}
              onChange={setIncludeDiagnostics}
              label="Include diagnostics"
              size="sm"
            />
          </div>

          <div className={`text-xs ${styles.muted}`}>
            Feedback is saved to your account. Admins can reply via Inbox.
          </div>
        </div>

        <ModalFooter className="-mx-6 -mb-4 mt-6 bg-white/30 border-white/20">
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
            className="bg-white/55 hover:bg-white/65 text-black border border-white/30"
          >
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={handleSubmit}
            loading={isSubmitting}
            className="bg-white/80 hover:bg-white/90 text-black border border-white/30"
          >
            Submit
          </Button>
        </ModalFooter>
      </div>
    </Modal>
  )
}
