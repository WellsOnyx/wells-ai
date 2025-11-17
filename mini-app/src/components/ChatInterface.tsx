import { h } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { useStore } from '../hooks/useStore';
import { apiClient } from '../services/api';
import { ChatMessage } from '../types';

/**
 * AI Chat Interface with streaming simulation and suggestions
 */
export function ChatInterface() {
  const { messages, addMessage, user, decrementSearches, setShowUpgradeModal } = useStore();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Welcome message
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({
        id: '0',
        role: 'assistant',
        content: "Hi! I'm your Wells AI assistant. I can help you find suppliers, create RFQs, and manage deals. What are you looking for?",
        timestamp: Date.now(),
        suggestions: ['Find CNC suppliers', 'Create an RFQ', 'Show my deals'],
      });
    }
  }, []);

  const handleSend = async (text?: string) => {
    const messageText = text || input.trim();
    if (!messageText) return;

    // Check tier limits
    if (user.tier === 'free' && user.searchesRemaining <= 0) {
      setShowUpgradeModal(true);
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };
    addMessage(userMessage);
    setInput('');
    setIsTyping(true);

    // Decrement search count for free tier
    if (user.tier === 'free') {
      decrementSearches();
    }

    try {
      // Get AI response
      const response = await apiClient.sendChatMessage(messageText);
      addMessage(response);
    } catch (error) {
      console.error('Chat error:', error);
      addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    handleSend(suggestion);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message-bubble flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div className="max-w-[80%]">
              <div
                className={`rounded-2xl px-4 py-2 ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-900'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>

              {/* Suggestions */}
              {message.suggestions && message.suggestions.length > 0 && (
                <div className="mt-2 space-y-1">
                  {message.suggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className="block w-full text-left text-xs px-3 py-2 bg-white border border-gray-200 rounded-lg text-primary-600 hover:bg-gray-50 ios-button"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl px-4 py-3">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput((e.target as HTMLInputElement).value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me anything..."
            className="flex-1 px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isTyping}
            className={`p-3 rounded-full ios-button ${
              input.trim() && !isTyping
                ? 'bg-primary-500 text-white'
                : 'bg-gray-200 text-gray-400'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
