'use client'

import { useState } from 'react'
import {
  Clock,
  Sun,
  Sunset,
  Calendar,
  ChevronRight,
  X
} from 'lucide-react'

interface SnoozePickerProps {
  isOpen: boolean
  onClose: () => void
  onSnooze: (until: Date) => void
  position?: { x: number; y: number }
}

export default function SnoozePicker({
  isOpen,
  onClose,
  onSnooze,
  position
}: SnoozePickerProps) {
  const [showCustom, setShowCustom] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('09:00')

  const getSnoozeDate = (option: string): Date => {
    const now = new Date()
    const date = new Date()

    switch (option) {
      case 'later_today':
        date.setHours(18, 0, 0, 0)
        if (date <= now) {
          date.setDate(date.getDate() + 1)
        }
        break
      case 'tomorrow':
        date.setDate(date.getDate() + 1)
        date.setHours(9, 0, 0, 0)
        break
      case 'this_weekend':
        const day = date.getDay()
        const daysUntilSaturday = day === 0 ? 6 : 6 - day
        date.setDate(date.getDate() + daysUntilSaturday)
        date.setHours(10, 0, 0, 0)
        break
      case 'next_week':
        const daysUntilMonday = (8 - date.getDay()) % 7 || 7
        date.setDate(date.getDate() + daysUntilMonday)
        date.setHours(9, 0, 0, 0)
        break
      case 'in_two_days':
        date.setDate(date.getDate() + 2)
        date.setHours(9, 0, 0, 0)
        break
      case 'in_one_week':
        date.setDate(date.getDate() + 7)
        date.setHours(9, 0, 0, 0)
        break
      default:
        return now
    }

    return date
  }

  const handleQuickSnooze = (option: string) => {
    const date = getSnoozeDate(option)
    onSnooze(date)
    onClose()
  }

  const handleCustomSnooze = () => {
    if (!customDate) return

    const [hours, minutes] = customTime.split(':').map(Number)
    const date = new Date(customDate)
    date.setHours(hours, minutes, 0, 0)

    onSnooze(date)
    onClose()
  }

  const formatSnoozeTime = (option: string): string => {
    const date = getSnoozeDate(option)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()
    const isTomorrow = date.toDateString() === new Date(now.getTime() + 86400000).toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (isTomorrow) {
      return `Tomorrow, ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    }
  }

  if (!isOpen) return null

  const quickOptions = [
    {
      id: 'later_today',
      label: 'Later today',
      sublabel: formatSnoozeTime('later_today'),
      icon: Sunset,
      color: 'text-orange-400'
    },
    {
      id: 'tomorrow',
      label: 'Tomorrow',
      sublabel: formatSnoozeTime('tomorrow'),
      icon: Sun,
      color: 'text-yellow-400'
    },
    {
      id: 'this_weekend',
      label: 'This weekend',
      sublabel: formatSnoozeTime('this_weekend'),
      icon: Calendar,
      color: 'text-blue-400'
    },
    {
      id: 'next_week',
      label: 'Next week',
      sublabel: formatSnoozeTime('next_week'),
      icon: Calendar,
      color: 'text-purple-400'
    },
    {
      id: 'in_one_week',
      label: 'In 1 week',
      sublabel: formatSnoozeTime('in_one_week'),
      icon: Calendar,
      color: 'text-pink-400'
    },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      {/* Picker */}
      <div
        className="fixed z-50 w-80 bg-black/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-150"
        style={position ? { top: position.y, left: position.x } : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="font-semibold text-white text-sm">Snooze until...</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>

        {!showCustom ? (
          <>
            {/* Quick Options */}
            <div className="py-2">
              {quickOptions.map((option) => {
                const Icon = option.icon
                return (
                  <button
                    key={option.id}
                    onClick={() => handleQuickSnooze(option.id)}
                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition-colors group"
                  >
                    <Icon className={`w-5 h-5 ${option.color} flex-shrink-0`} />
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium text-white">
                        {option.label}
                      </div>
                      <div className="text-xs text-gray-500">
                        {option.sublabel}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
                  </button>
                )
              })}
            </div>

            {/* Custom Option */}
            <div className="border-t border-white/10 p-2">
              <button
                onClick={() => setShowCustom(true)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 rounded-lg transition-colors group"
              >
                <Calendar className="w-5 h-5 text-gray-400 flex-shrink-0" />
                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-white">
                    Pick date & time
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-600 group-hover:text-gray-400 transition-colors" />
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Custom Date/Time Picker */}
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-2">Date</label>
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-2">Time</label>
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-amber-500/50 focus:ring-2 focus:ring-amber-500/20"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => setShowCustom(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleCustomSnooze}
                  disabled={!customDate}
                  className="flex-1 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Snooze
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
