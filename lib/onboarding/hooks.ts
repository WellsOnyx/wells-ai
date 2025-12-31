'use client'

/**
 * Wells AI Progressive Profile Hooks
 *
 * React hooks for integrating the progressive profile system
 * into chat interfaces and onboarding flows.
 */

import { useState, useEffect, useCallback } from 'react'
import { ProgressiveProfile, Journey, calculateCompleteness } from './profile-schema'

// ============================================================================
// TYPES
// ============================================================================

interface ProfileState {
  profile: ProgressiveProfile | null
  completeness: number
  isLoading: boolean
  error: string | null
}

interface ExtractionResult {
  success: boolean
  extractedFields: string[]
  newCompleteness: number
  acknowledgment: string
  nextQuestion?: string
}

interface UseProgressiveProfileReturn {
  profile: ProgressiveProfile | null
  completeness: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  extractFromMessage: (message: string, context?: string) => Promise<ExtractionResult>
  updateField: (field: string, value: unknown) => Promise<void>
  getNextQuestion: () => Promise<string | null>
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useProgressiveProfile(): UseProgressiveProfileReturn {
  const [state, setState] = useState<ProfileState>({
    profile: null,
    completeness: 0,
    isLoading: true,
    error: null,
  })

  // Fetch profile on mount
  const fetchProfile = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }))

      const response = await fetch('/api/onboarding/profile')
      if (!response.ok) throw new Error('Failed to fetch profile')

      const data = await response.json()
      const profile = data.progressiveProfile || null
      const completeness = data.meta?.completeness || 0

      setState({
        profile,
        completeness,
        isLoading: false,
        error: null,
      })
    } catch (error) {
      console.error('[useProgressiveProfile] Error fetching profile:', error)
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load profile',
      }))
    }
  }, [])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  // Extract data from a message
  const extractFromMessage = useCallback(
    async (message: string, conversationContext?: string): Promise<ExtractionResult> => {
      try {
        const response = await fetch('/api/onboarding/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationContext }),
        })

        if (!response.ok) throw new Error('Extraction failed')

        const data = await response.json()

        // Update local state with new profile
        if (data.profile) {
          setState(prev => ({
            ...prev,
            completeness: data.profile.completeness,
          }))
        }

        return {
          success: true,
          extractedFields: data.extracted?.fields || [],
          newCompleteness: data.profile?.completeness || state.completeness,
          acknowledgment: data.feedback?.acknowledgment || '',
          nextQuestion: data.feedback?.nextQuestion,
        }
      } catch (error) {
        console.error('[useProgressiveProfile] Extraction error:', error)
        return {
          success: false,
          extractedFields: [],
          newCompleteness: state.completeness,
          acknowledgment: '',
        }
      }
    },
    [state.completeness]
  )

  // Update a specific field
  const updateField = useCallback(async (field: string, value: unknown) => {
    try {
      const updates: Record<string, unknown> = {}

      // Parse nested field paths
      const parts = field.split('.')
      if (parts.length === 1) {
        updates[field] = value
      } else {
        // Handle nested paths like 'buyer.typicalNeeds'
        const [section, ...rest] = parts
        updates[section] = { [rest.join('.')]: value }
      }

      const response = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) throw new Error('Update failed')

      const data = await response.json()
      if (data.profile) {
        setState(prev => ({
          ...prev,
          completeness: data.profile.completeness,
        }))
      }
    } catch (error) {
      console.error('[useProgressiveProfile] Update error:', error)
    }
  }, [])

  // Get next question
  const getNextQuestion = useCallback(async (): Promise<string | null> => {
    try {
      const response = await fetch('/api/onboarding/next-question')
      if (!response.ok) return null

      const data = await response.json()
      return data.question?.text || null
    } catch (error) {
      console.error('[useProgressiveProfile] Get next question error:', error)
      return null
    }
  }, [])

  return {
    profile: state.profile,
    completeness: state.completeness,
    isLoading: state.isLoading,
    error: state.error,
    refresh: fetchProfile,
    extractFromMessage,
    updateField,
    getNextQuestion,
  }
}

// ============================================================================
// EXTRACTION HOOK
// ============================================================================

interface UseExtractionOptions {
  autoExtract?: boolean
  onExtraction?: (result: ExtractionResult) => void
}

export function useProfileExtraction(options: UseExtractionOptions = {}) {
  const [isExtracting, setIsExtracting] = useState(false)
  const [lastExtraction, setLastExtraction] = useState<ExtractionResult | null>(null)

  const extract = useCallback(
    async (message: string, context?: string): Promise<ExtractionResult> => {
      setIsExtracting(true)

      try {
        const response = await fetch('/api/onboarding/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, conversationContext: context }),
        })

        if (!response.ok) throw new Error('Extraction failed')

        const data = await response.json()

        const result: ExtractionResult = {
          success: true,
          extractedFields: data.extracted?.fields || [],
          newCompleteness: data.profile?.completeness || 0,
          acknowledgment: data.feedback?.acknowledgment || '',
          nextQuestion: data.feedback?.nextQuestion,
        }

        setLastExtraction(result)
        options.onExtraction?.(result)

        return result
      } catch (error) {
        console.error('[useProfileExtraction] Error:', error)

        const failedResult: ExtractionResult = {
          success: false,
          extractedFields: [],
          newCompleteness: 0,
          acknowledgment: '',
        }

        setLastExtraction(failedResult)
        return failedResult
      } finally {
        setIsExtracting(false)
      }
    },
    [options]
  )

  return {
    extract,
    isExtracting,
    lastExtraction,
  }
}

// ============================================================================
// COMPLETENESS TRACKER
// ============================================================================

export function useCompletenessTracker() {
  const [completeness, setCompleteness] = useState(0)
  const [milestone, setMilestone] = useState<string | null>(null)

  const updateCompleteness = useCallback((newValue: number) => {
    const prevMilestone = getMilestone(completeness)
    const newMilestone = getMilestone(newValue)

    setCompleteness(newValue)

    if (newMilestone !== prevMilestone) {
      setMilestone(newMilestone)
      // Auto-clear milestone notification after 3 seconds
      setTimeout(() => setMilestone(null), 3000)
    }
  }, [completeness])

  return {
    completeness,
    milestone,
    updateCompleteness,
  }
}

function getMilestone(completeness: number): string | null {
  if (completeness >= 95) return 'complete'
  if (completeness >= 80) return 'excellent'
  if (completeness >= 60) return 'good'
  if (completeness >= 40) return 'usable'
  if (completeness >= 20) return 'started'
  return null
}

// ============================================================================
// JOURNEY SELECTOR
// ============================================================================

export function useJourneySelection() {
  const [selectedJourney, setSelectedJourney] = useState<Journey | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const selectJourney = useCallback(async (journey: Journey) => {
    setIsUpdating(true)

    try {
      const response = await fetch('/api/onboarding/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ journey }),
      })

      if (response.ok) {
        setSelectedJourney(journey)
      }
    } catch (error) {
      console.error('[useJourneySelection] Error:', error)
    } finally {
      setIsUpdating(false)
    }
  }, [])

  return {
    selectedJourney,
    selectJourney,
    isUpdating,
  }
}

// ============================================================================
// SMART QUESTION HOOK
// ============================================================================

export function useSmartQuestions() {
  const [currentQuestion, setCurrentQuestion] = useState<{
    id: string
    text: string
    field: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const fetchNextQuestion = useCallback(async (context?: string[]) => {
    setIsLoading(true)

    try {
      const url = new URL('/api/onboarding/next-question', window.location.origin)
      if (context && context.length > 0) {
        url.searchParams.set('context', context.join('|||'))
      }

      const response = await fetch(url.toString())
      if (!response.ok) return

      const data = await response.json()
      if (data.question) {
        setCurrentQuestion(data.question)
      } else {
        setCurrentQuestion(null)
      }
    } catch (error) {
      console.error('[useSmartQuestions] Error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const skipQuestion = useCallback(() => {
    setCurrentQuestion(null)
  }, [])

  return {
    currentQuestion,
    isLoading,
    fetchNextQuestion,
    skipQuestion,
  }
}
