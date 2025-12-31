'use client'

/**
 * CampaignCard - Campaign summary card component
 *
 * Displays campaign info, status, and key metrics.
 */

import Link from 'next/link'
import {
  Mail,
  MessageSquare,
  Linkedin,
  Users,
  Clock,
  CheckCircle2,
  Edit,
  Pause,
  Play,
  Zap,
  XCircle,
  Calendar,
  ChevronRight,
  BarChart3,
} from 'lucide-react'

interface Campaign {
  id: string
  name: string
  description?: string
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'paused' | 'cancelled'
  channel: 'email' | 'sms' | 'linkedin'
  totalRecipients: number
  sentCount: number
  deliveredCount: number
  openedCount: number
  clickedCount: number
  repliedCount: number
  scheduledAt?: string
  completedAt?: string
  createdAt: string
}

interface CampaignCardProps {
  campaign: Campaign
  variant?: 'default' | 'compact'
  showStats?: boolean
  onClick?: () => void
  className?: string
}

export default function CampaignCard({
  campaign,
  variant = 'default',
  showStats = true,
  onClick,
  className = '',
}: CampaignCardProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      case 'scheduled': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'sending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'sent': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'paused': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'cancelled': return 'bg-red-500/10 text-red-400 border-red-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'draft': return <Edit className="w-3 h-3" />
      case 'scheduled': return <Clock className="w-3 h-3" />
      case 'sending': return <Zap className="w-3 h-3" />
      case 'sent': return <CheckCircle2 className="w-3 h-3" />
      case 'paused': return <Pause className="w-3 h-3" />
      case 'cancelled': return <XCircle className="w-3 h-3" />
      default: return null
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'email': return <Mail className="w-5 h-5 text-blue-400" />
      case 'sms': return <MessageSquare className="w-5 h-5 text-green-400" />
      case 'linkedin': return <Linkedin className="w-5 h-5 text-cyan-400" />
      default: return <Mail className="w-5 h-5 text-gray-400" />
    }
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  const calculateRate = (numerator: number, denominator: number) => {
    if (denominator === 0) return '0%'
    return `${Math.round((numerator / denominator) * 100)}%`
  }

  const CardWrapper = onClick ? 'button' : 'div'
  const cardProps = onClick ? { onClick } : {}

  if (variant === 'compact') {
    return (
      <CardWrapper
        {...cardProps}
        className={`w-full bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 hover:border-[var(--border-hover)] transition-all text-left group ${className}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[var(--surface)] rounded-lg">
              {getChannelIcon(campaign.channel)}
            </div>
            <div>
              <h3 className="font-medium">{campaign.name}</h3>
              <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                <Users className="w-3 h-3" />
                {campaign.totalRecipients} recipients
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(campaign.status)}`}>
              {getStatusIcon(campaign.status)}
              {campaign.status}
            </span>
            <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </CardWrapper>
    )
  }

  return (
    <Link
      href={`/crm/campaigns/${campaign.id}`}
      className={`block bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-6 hover:border-[var(--border-hover)] transition-all group ${className}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-[var(--surface)] rounded-xl">
            {getChannelIcon(campaign.channel)}
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">{campaign.name}</h3>
              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs border ${getStatusColor(campaign.status)}`}>
                {getStatusIcon(campaign.status)}
                {campaign.status}
              </span>
            </div>
            {campaign.description && (
              <p className="text-sm text-[var(--text-secondary)] mt-1">
                {campaign.description}
              </p>
            )}
            <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-tertiary)]">
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {campaign.totalRecipients} recipients
              </span>
              {campaign.scheduledAt && campaign.status === 'scheduled' && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {formatDate(campaign.scheduledAt)}
                </span>
              )}
              {campaign.completedAt && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  {formatDate(campaign.completedAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-[var(--text-tertiary)] group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
      </div>

      {/* Stats */}
      {showStats && (campaign.status === 'sent' || campaign.status === 'sending') && campaign.sentCount > 0 && (
        <div className="grid grid-cols-5 gap-4 pt-4 border-t border-[var(--border)]">
          <div className="text-center">
            <div className="text-lg font-semibold">{campaign.sentCount}</div>
            <div className="text-xs text-[var(--text-tertiary)]">Sent</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-green-400">
              {calculateRate(campaign.deliveredCount, campaign.sentCount)}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Delivered</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-blue-400">
              {calculateRate(campaign.openedCount, campaign.deliveredCount)}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Opened</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-amber-400">
              {calculateRate(campaign.clickedCount, campaign.openedCount)}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Clicked</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-purple-400">
              {campaign.repliedCount}
            </div>
            <div className="text-xs text-[var(--text-tertiary)]">Replied</div>
          </div>
        </div>
      )}

      {/* Progress bar for sending campaigns */}
      {campaign.status === 'sending' && (
        <div className="mt-4 pt-4 border-t border-[var(--border)]">
          <div className="flex justify-between text-sm text-[var(--text-secondary)] mb-2">
            <span>Sending progress</span>
            <span>{calculateRate(campaign.sentCount, campaign.totalRecipients)}</span>
          </div>
          <div className="h-2 bg-[var(--surface)] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all"
              style={{ width: `${(campaign.sentCount / campaign.totalRecipients) * 100}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
