'use client'

import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { DemoMessage, DEMO_SCRIPT, getAllMessages } from '../data/demoScript'

interface DemoState {
  currentScene: number
  currentMessageIndex: number
  messages: DemoMessage[]
  isPlaying: boolean
  isPaused: boolean
  isComplete: boolean
  showCTA: boolean
  timeStarted: number | null
  totalScenes: number
}

type DemoAction =
  | { type: 'START_DEMO' }
  | { type: 'ADD_MESSAGE'; payload: DemoMessage }
  | { type: 'NEXT_SCENE' }
  | { type: 'PAUSE_DEMO' }
  | { type: 'RESUME_DEMO' }
  | { type: 'COMPLETE_DEMO' }
  | { type: 'SHOW_CTA' }
  | { type: 'RESTART_DEMO' }

const initialState: DemoState = {
  currentScene: 0,
  currentMessageIndex: 0,
  messages: [],
  isPlaying: false,
  isPaused: false,
  isComplete: false,
  showCTA: false,
  timeStarted: null,
  totalScenes: DEMO_SCRIPT.length
}

function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'START_DEMO':
      return {
        ...state,
        isPlaying: true,
        timeStarted: Date.now()
      }

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
        currentMessageIndex: state.currentMessageIndex + 1
      }

    case 'NEXT_SCENE':
      const nextScene = state.currentScene + 1
      return {
        ...state,
        currentScene: nextScene,
        isComplete: nextScene >= state.totalScenes
      }

    case 'PAUSE_DEMO':
      return {
        ...state,
        isPaused: true,
        isPlaying: false
      }

    case 'RESUME_DEMO':
      return {
        ...state,
        isPaused: false,
        isPlaying: true
      }

    case 'COMPLETE_DEMO':
      return {
        ...state,
        isComplete: true,
        isPlaying: false
      }

    case 'SHOW_CTA':
      return {
        ...state,
        showCTA: true
      }

    case 'RESTART_DEMO':
      return {
        ...initialState,
        isPlaying: true,
        timeStarted: Date.now()
      }

    default:
      return state
  }
}

interface DemoContextType {
  state: DemoState
  dispatch: React.Dispatch<DemoAction>
  startDemo: () => void
  pauseDemo: () => void
  resumeDemo: () => void
  restartDemo: () => void
  skipToEnd: () => void
}

const DemoContext = createContext<DemoContextType | undefined>(undefined)

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(demoReducer, initialState)

  const startDemo = () => {
    dispatch({ type: 'START_DEMO' })
  }

  const pauseDemo = () => {
    dispatch({ type: 'PAUSE_DEMO' })
  }

  const resumeDemo = () => {
    dispatch({ type: 'RESUME_DEMO' })
  }

  const restartDemo = () => {
    dispatch({ type: 'RESTART_DEMO' })
  }

  const skipToEnd = () => {
    // Add all messages instantly
    const allMessages = getAllMessages()
    allMessages.forEach(msg => {
      dispatch({ type: 'ADD_MESSAGE', payload: msg })
    })
    dispatch({ type: 'COMPLETE_DEMO' })
    dispatch({ type: 'SHOW_CTA' })
  }

  // Show CTA when demo completes
  useEffect(() => {
    if (state.isComplete && !state.showCTA) {
      setTimeout(() => {
        dispatch({ type: 'SHOW_CTA' })
      }, 2000)
    }
  }, [state.isComplete, state.showCTA])

  return (
    <DemoContext.Provider
      value={{
        state,
        dispatch,
        startDemo,
        pauseDemo,
        resumeDemo,
        restartDemo,
        skipToEnd
      }}
    >
      {children}
    </DemoContext.Provider>
  )
}

export function useDemo() {
  const context = useContext(DemoContext)
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider')
  }
  return context
}
