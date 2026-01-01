'use client';

/**
 * NegotiationChat Component
 *
 * This component implements the AI-to-AI negotiation UI where:
 * - Users only see their conversation with their Wells AI
 * - No visibility into the other party's direct messages
 * - AI summarizes what the other party's AI communicated
 * - Users instruct their AI, not message the other party
 *
 * PHILOSOPHY:
 * - Humans define what they want (goals, limits, preferences)
 * - AIs figure out how to get it (tactics, timing, language)
 * - Humans approve major decisions
 * - AIs handle the back-and-forth
 * - No human feelings get hurt because no humans interact directly
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  User,
  Send,
  Shield,
  AlertCircle,
  CheckCircle,
  Clock,
  TrendingDown,
  Loader2,
  Lock,
  MessageCircle,
  Eye,
  EyeOff,
  Info,
  Zap,
  Target,
  DollarSign,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

// ============================================================================
// TYPES
// ============================================================================

export interface NegotiationChatProps {
  sessionId: string;
  partyType: 'buyer' | 'seller';
  orgName: string;
  counterpartyName: string;
  initialOffer?: {
    totalPrice: number;
    unitPrice: number;
    quantity: number;
    leadTimeDays: number;
  };
  onSendInstruction?: (instruction: string) => Promise<void>;
  onApproveAction?: (action: string) => Promise<void>;
}

interface ChatMessage {
  id: string;
  type: 'user_instruction' | 'ai_response' | 'ai_update' | 'system' | 'decision_needed';
  content: string;
  timestamp: string;
  metadata?: {
    aiInterpretation?: string;
    suggestedResponses?: string[];
    keyPoints?: string[];
    requiresDecision?: boolean;
    decisionOptions?: string[];
    currentOffer?: {
      totalPrice: number;
      unitPrice: number;
      leadTimeDays: number;
    };
    savings?: {
      amount: number;
      percentage: number;
    };
  };
}

interface NegotiationState {
  status: 'active' | 'paused' | 'awaiting_decision' | 'completed' | 'rejected';
  currentRound: number;
  maxRounds: number;
  currentOffer?: {
    totalPrice: number;
    unitPrice: number;
    leadTimeDays: number;
  };
  targetPrice?: number;
  savings?: {
    amount: number;
    percentage: number;
  };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function NegotiationChat({
  sessionId,
  partyType,
  orgName,
  counterpartyName,
  initialOffer,
  onSendInstruction,
  onApproveAction,
}: NegotiationChatProps) {
  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [negotiationState, setNegotiationState] = useState<NegotiationState>({
    status: 'active',
    currentRound: 1,
    maxRounds: 5,
    currentOffer: initialOffer,
  });
  const [showAIExplanation, setShowAIExplanation] = useState(false);
  const [showConstraints, setShowConstraints] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initial AI greeting
  useEffect(() => {
    const initialMessage: ChatMessage = {
      id: 'init-1',
      type: 'ai_response',
      content: `I'm Wells AI, negotiating with ${counterpartyName} on your behalf. I'll handle all communication with their AI representative.`,
      timestamp: new Date().toISOString(),
      metadata: {
        keyPoints: [
          'You will never interact directly with the other party',
          'Tell me your goals and limits - I\'ll handle the tactics',
          'I\'ll ask for your approval on major decisions',
        ],
        suggestedResponses: [
          'What\'s the current offer?',
          'My budget is $X',
          'Push for a better price',
        ],
      },
    };

    setMessages([initialMessage]);
  }, [counterpartyName]);

  // Handle sending instruction
  const handleSendInstruction = useCallback(async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      type: 'user_instruction',
      content: inputValue,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Call the API to process the instruction
      if (onSendInstruction) {
        await onSendInstruction(inputValue);
      }

      // Simulate AI response (in real implementation, this comes from the API)
      const aiResponse: ChatMessage = {
        id: `ai-${Date.now()}`,
        type: 'ai_response',
        content: `I understand. I'll ${inputValue.toLowerCase().includes('accept') ? 'communicate your acceptance' : 'work on getting you better terms'}.`,
        timestamp: new Date().toISOString(),
        metadata: {
          aiInterpretation: `Processing your instruction: "${inputValue}"`,
          suggestedResponses: [
            'What did they say?',
            'Set my max at $X',
            'Accept if they can do $X',
          ],
        },
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        type: 'system',
        content: 'There was an error processing your instruction. Please try again.',
        timestamp: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, onSendInstruction]);

  // Handle decision approval
  const handleDecision = useCallback(async (decision: string) => {
    if (onApproveAction) {
      setIsLoading(true);
      try {
        await onApproveAction(decision);
      } finally {
        setIsLoading(false);
      }
    }
  }, [onApproveAction]);

  // Handle keyboard submit
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInstruction();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-gray-900" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Wells AI</h3>
              <p className="text-xs text-gray-400">Negotiating with {counterpartyName}</p>
            </div>
          </div>

          {/* AI Protection Badge */}
          <button
            onClick={() => setShowAIExplanation(!showAIExplanation)}
            aria-expanded={showAIExplanation}
            aria-label="Learn about AI protection"
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-xs transition-all duration-200 hover:bg-blue-500/20 hover:border-blue-500/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <Shield className="w-3 h-3" aria-hidden="true" />
            AI Protected
            <Info className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>

        {/* AI Explanation Panel */}
        {showAIExplanation && (
          <div className="mt-4 p-4 bg-blue-500/10 rounded-xl border border-blue-500/20">
            <h4 className="font-medium text-blue-400 mb-2 flex items-center gap-2">
              <Lock className="w-4 h-4" />
              How AI-to-AI Negotiation Works
            </h4>
            <ul className="text-sm text-gray-300 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>You talk to <strong>your</strong> Wells AI, not the other party</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>Your AI negotiates with their AI on your behalf</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>All communication is professional and emotion-free</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                <span>You approve major decisions, AI handles the details</span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Negotiation Status Bar */}
      <div className="flex-shrink-0 px-4 py-3 bg-gray-800/50 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <Clock className="w-4 h-4 text-gray-400" />
              <span className="text-gray-400">Round</span>
              <span className="text-white font-medium">
                {negotiationState.currentRound}/{negotiationState.maxRounds}
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded text-xs font-medium ${
              negotiationState.status === 'active' ? 'bg-green-500/20 text-green-400' :
              negotiationState.status === 'paused' ? 'bg-amber-500/20 text-amber-400' :
              negotiationState.status === 'awaiting_decision' ? 'bg-blue-500/20 text-blue-400' :
              negotiationState.status === 'completed' ? 'bg-cyan-500/20 text-cyan-400' :
              'bg-red-500/20 text-red-400'
            }`}>
              {negotiationState.status === 'active' ? 'Negotiating' :
               negotiationState.status === 'paused' ? 'Paused' :
               negotiationState.status === 'awaiting_decision' ? 'Needs Your Decision' :
               negotiationState.status === 'completed' ? 'Completed' :
               'Rejected'}
            </div>
          </div>

          {negotiationState.savings && negotiationState.savings.amount > 0 && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <TrendingDown className="w-4 h-4" />
              <span>Saved ${negotiationState.savings.amount.toFixed(2)} ({negotiationState.savings.percentage.toFixed(1)}%)</span>
            </div>
          )}
        </div>

        {/* Current Offer Summary */}
        {negotiationState.currentOffer && (
          <button
            onClick={() => setShowConstraints(!showConstraints)}
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-gold-400" />
                <span className="text-gray-400">Current Offer:</span>
                <span className="text-white font-medium">${negotiationState.currentOffer.totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-400">
                <Target className="w-4 h-4" />
                <span>{negotiationState.currentOffer.leadTimeDays} days</span>
              </div>
            </div>
            {showConstraints ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>
        )}

        {showConstraints && negotiationState.currentOffer && (
          <div className="mt-2 p-3 bg-gray-700/30 rounded-lg text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-gray-400">Unit Price:</span>
                <span className="text-white ml-2">${negotiationState.currentOffer.unitPrice.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-400">Lead Time:</span>
                <span className="text-white ml-2">{negotiationState.currentOffer.leadTimeDays} days</span>
              </div>
              {negotiationState.targetPrice && (
                <div>
                  <span className="text-gray-400">Your Target:</span>
                  <span className="text-green-400 ml-2">${negotiationState.targetPrice.toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            partyType={partyType}
            onDecision={handleDecision}
          />
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Wells AI is processing...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 p-4 border-t border-gray-800 bg-gray-900/50">
        {/* Reminder that user is talking to their AI */}
        <div className="flex items-center gap-2 mb-3 text-xs text-gray-500">
          <MessageCircle className="w-3 h-3" aria-hidden="true" />
          <span>You&apos;re instructing your AI - not messaging {counterpartyName} directly</span>
        </div>

        <div className="flex gap-3">
          <label htmlFor="negotiation-input" className="sr-only">Tell your AI what you want</label>
          <textarea
            id="negotiation-input"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={`Tell your AI what you want (e.g., "Push back on price" or "My max is $5000")`}
            className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white placeholder-gray-500 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            rows={2}
            disabled={isLoading || negotiationState.status === 'completed'}
            aria-label="Negotiation instruction input"
          />
          <button
            onClick={handleSendInstruction}
            disabled={!inputValue.trim() || isLoading || negotiationState.status === 'completed'}
            aria-label="Send instruction to AI"
            className="px-6 py-3 bg-gradient-to-r from-gold-400 to-gold-600 text-black rounded-xl font-medium transition-all duration-200 hover:from-gold-300 hover:to-gold-500 hover:shadow-lg hover:shadow-gold-500/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none active:scale-[0.98] flex items-center gap-2"
          >
            <Send className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2 mt-3" role="group" aria-label="Quick action suggestions">
          {['Push back on price', 'Accept current offer', 'What\'s the status?', 'Set my max budget'].map((action) => (
            <button
              key={action}
              onClick={() => setInputValue(action)}
              className="px-3 py-1.5 text-xs bg-gray-800 border border-gray-700 rounded-full text-gray-400 transition-all duration-200 hover:text-white hover:border-gray-600 hover:bg-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE COMPONENT
// ============================================================================

interface MessageBubbleProps {
  message: ChatMessage;
  partyType: 'buyer' | 'seller';
  onDecision?: (decision: string) => void;
}

function MessageBubble({ message, partyType, onDecision }: MessageBubbleProps) {
  const isUser = message.type === 'user_instruction';
  const isAI = message.type === 'ai_response' || message.type === 'ai_update';
  const isSystem = message.type === 'system';
  const needsDecision = message.type === 'decision_needed';

  if (isSystem) {
    return (
      <div className="flex justify-center">
        <div className="px-4 py-2 bg-gray-800/50 rounded-lg text-gray-400 text-sm text-center max-w-md">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] ${isUser ? 'order-2' : 'order-1'}`}>
        <div className="flex items-center gap-2 mb-1">
          {isAI && (
            <>
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gold-400 to-gold-600 flex items-center justify-center">
                <Bot className="w-3 h-3 text-black" />
              </div>
              <span className="text-xs text-gray-400">Wells AI</span>
            </>
          )}
          {isUser && (
            <>
              <span className="text-xs text-gray-400">You</span>
              <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center">
                <User className="w-3 h-3 text-gray-400" />
              </div>
            </>
          )}
        </div>

        <div
          className={`px-4 py-3 rounded-2xl ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-sm'
              : needsDecision
              ? 'bg-amber-500/20 border border-amber-500/30 rounded-tl-sm'
              : 'bg-gray-800 text-gray-200 rounded-tl-sm'
          }`}
        >
          <p className="text-sm">{message.content}</p>

          {/* AI's interpretation of user's instruction */}
          {isAI && message.metadata?.aiInterpretation && (
            <div className="mt-2 pt-2 border-t border-gray-700/50 text-xs text-gray-400 italic">
              <Eye className="w-3 h-3 inline mr-1" />
              {message.metadata.aiInterpretation}
            </div>
          )}

          {/* Key Points */}
          {message.metadata?.keyPoints && message.metadata.keyPoints.length > 0 && (
            <div className="mt-3 space-y-1">
              {message.metadata.keyPoints.map((point, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-gray-400">
                  <Zap className="w-3 h-3 text-gold-400 flex-shrink-0 mt-0.5" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          )}

          {/* Decision Options */}
          {needsDecision && message.metadata?.decisionOptions && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-amber-400 font-medium">Your decision is needed:</p>
              <div className="flex flex-wrap gap-2">
                {message.metadata.decisionOptions.map((option) => (
                  <button
                    key={option}
                    onClick={() => onDecision?.(option)}
                    className="px-3 py-1.5 bg-amber-500/20 border border-amber-500/50 rounded-lg text-amber-200 text-xs hover:bg-amber-500/30 transition-colors"
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Current Offer Display */}
          {message.metadata?.currentOffer && (
            <div className="mt-3 p-2 bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-400 mb-1">Current offer from other party:</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-white font-medium">${message.metadata.currentOffer.totalPrice.toFixed(2)}</span>
                <span className="text-gray-400">{message.metadata.currentOffer.leadTimeDays} days</span>
              </div>
            </div>
          )}

          {/* Savings Badge */}
          {message.metadata?.savings && message.metadata.savings.amount > 0 && (
            <div className="mt-2 inline-flex items-center gap-1 px-2 py-1 bg-green-500/20 rounded text-green-400 text-xs">
              <TrendingDown className="w-3 h-3" />
              Saved ${message.metadata.savings.amount.toFixed(2)} ({message.metadata.savings.percentage.toFixed(1)}%)
            </div>
          )}
        </div>

        {/* Suggested Responses */}
        {isAI && message.metadata?.suggestedResponses && message.metadata.suggestedResponses.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {message.metadata.suggestedResponses.map((response) => (
              <button
                key={response}
                className="px-2 py-1 text-xs bg-gray-800/50 border border-gray-700 rounded-full text-gray-400 hover:text-white hover:border-gray-600 transition-colors"
              >
                {response}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {new Date(message.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// EXPORTS
// ============================================================================

export { NegotiationChat };
