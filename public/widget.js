/**
 * Wells AI Embeddable Widget
 * Version 1.0.0
 *
 * One-line installation for any website:
 * <script src="https://wellsai.vercel.app/widget.js" data-wells-key="YOUR_KEY"></script>
 */

(function() {
  'use strict';

  // Configuration
  const WIDGET_VERSION = '1.0.0';
  const API_BASE = 'https://wellsai.vercel.app/api';

  // Get API key from script tag
  const script = document.currentScript || document.querySelector('script[data-wells-key]');
  const apiKey = script?.getAttribute('data-wells-key') || 'demo';
  const position = script?.getAttribute('data-position') || 'bottom-right';
  const theme = script?.getAttribute('data-theme') || 'light';
  const greeting = script?.getAttribute('data-greeting') || 'Hi! Need to source something?';

  // Widget state
  let isOpen = false;
  let conversationId = generateId();
  let messages = [];

  /**
   * Generate unique ID
   */
  function generateId() {
    return 'wells_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Create widget HTML
   */
  function createWidget() {
    const widgetContainer = document.createElement('div');
    widgetContainer.id = 'wells-ai-widget';
    widgetContainer.className = `wells-widget-${position} wells-theme-${theme}`;

    widgetContainer.innerHTML = `
      <style>
        #wells-ai-widget {
          position: fixed;
          z-index: 9999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }

        .wells-widget-bottom-right {
          bottom: 20px;
          right: 20px;
        }

        .wells-widget-bottom-left {
          bottom: 20px;
          left: 20px;
        }

        .wells-widget-top-right {
          top: 20px;
          right: 20px;
        }

        .wells-widget-top-left {
          top: 20px;
          left: 20px;
        }

        #wells-chat-button {
          width: 60px;
          height: 60px;
          border-radius: 30px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        #wells-chat-button:hover {
          transform: scale(1.05);
          box-shadow: 0 6px 16px rgba(0,0,0,0.2);
        }

        #wells-chat-button svg {
          width: 28px;
          height: 28px;
          fill: white;
        }

        #wells-chat-window {
          display: none;
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 380px;
          height: 600px;
          max-height: 80vh;
          background: white;
          border-radius: 16px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12);
          flex-direction: column;
          overflow: hidden;
        }

        .wells-widget-bottom-left #wells-chat-window,
        .wells-widget-top-left #wells-chat-window {
          left: 0;
          right: auto;
        }

        .wells-widget-top-right #wells-chat-window,
        .wells-widget-top-left #wells-chat-window {
          top: 80px;
          bottom: auto;
        }

        #wells-chat-window.open {
          display: flex;
        }

        .wells-chat-header {
          padding: 20px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .wells-chat-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .wells-chat-header p {
          margin: 4px 0 0 0;
          font-size: 12px;
          opacity: 0.9;
        }

        .wells-close-btn {
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          padding: 4px;
          opacity: 0.8;
          transition: opacity 0.2s;
        }

        .wells-close-btn:hover {
          opacity: 1;
        }

        .wells-chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #f7f8fa;
        }

        .wells-message {
          margin-bottom: 16px;
          display: flex;
          gap: 12px;
        }

        .wells-message.user {
          flex-direction: row-reverse;
        }

        .wells-message-avatar {
          width: 32px;
          height: 32px;
          border-radius: 16px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: 600;
          flex-shrink: 0;
        }

        .wells-message.user .wells-message-avatar {
          background: #e5e7eb;
          color: #6b7280;
        }

        .wells-message-content {
          max-width: 70%;
          padding: 12px 16px;
          border-radius: 12px;
          background: white;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          font-size: 14px;
          line-height: 1.5;
        }

        .wells-message.user .wells-message-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .wells-message-time {
          font-size: 11px;
          color: #9ca3af;
          margin-top: 4px;
        }

        .wells-typing {
          display: none;
          padding: 12px 16px;
          background: white;
          border-radius: 12px;
          width: fit-content;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .wells-typing.active {
          display: block;
        }

        .wells-typing-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9ca3af;
          margin: 0 2px;
          animation: wells-typing 1.4s infinite;
        }

        .wells-typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }

        .wells-typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }

        @keyframes wells-typing {
          0%, 60%, 100% {
            transform: translateY(0);
          }
          30% {
            transform: translateY(-10px);
          }
        }

        .wells-chat-input {
          padding: 16px;
          border-top: 1px solid #e5e7eb;
          background: white;
        }

        .wells-input-wrapper {
          display: flex;
          gap: 8px;
        }

        #wells-input {
          flex: 1;
          padding: 12px 16px;
          border: 1px solid #e5e7eb;
          border-radius: 24px;
          font-size: 14px;
          outline: none;
          transition: border-color 0.2s;
        }

        #wells-input:focus {
          border-color: #667eea;
        }

        #wells-send-btn {
          width: 44px;
          height: 44px;
          border-radius: 22px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.2s;
        }

        #wells-send-btn:hover:not(:disabled) {
          transform: scale(1.05);
        }

        #wells-send-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        #wells-send-btn svg {
          width: 20px;
          height: 20px;
          fill: white;
        }

        .wells-powered-by {
          text-align: center;
          padding: 8px;
          font-size: 11px;
          color: #9ca3af;
          background: white;
        }

        .wells-powered-by a {
          color: #667eea;
          text-decoration: none;
        }

        .wells-powered-by a:hover {
          text-decoration: underline;
        }

        @media (max-width: 480px) {
          #wells-chat-window {
            width: 100vw;
            height: 100vh;
            max-height: 100vh;
            bottom: 0;
            right: 0;
            border-radius: 0;
          }

          .wells-widget-bottom-left #wells-chat-window,
          .wells-widget-top-right #wells-chat-window,
          .wells-widget-top-left #wells-chat-window {
            left: 0;
            top: 0;
          }
        }
      </style>

      <button id="wells-chat-button" aria-label="Open Wells AI Chat">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </button>

      <div id="wells-chat-window">
        <div class="wells-chat-header">
          <div>
            <h3>Wells AI</h3>
            <p>Procurement Assistant</p>
          </div>
          <button class="wells-close-btn" aria-label="Close chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>

        <div class="wells-chat-messages" id="wells-messages">
          <div class="wells-message">
            <div class="wells-message-avatar">W</div>
            <div>
              <div class="wells-message-content">${greeting}</div>
              <div class="wells-message-time">Just now</div>
            </div>
          </div>
        </div>

        <div class="wells-typing" id="wells-typing">
          <span class="wells-typing-dot"></span>
          <span class="wells-typing-dot"></span>
          <span class="wells-typing-dot"></span>
        </div>

        <div class="wells-chat-input">
          <div class="wells-input-wrapper">
            <input
              type="text"
              id="wells-input"
              placeholder="Type your message..."
              autocomplete="off"
            />
            <button id="wells-send-btn" aria-label="Send message">
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
              </svg>
            </button>
          </div>
        </div>

        <div class="wells-powered-by">
          Powered by <a href="https://wellsai.vercel.app" target="_blank">Wells AI</a>
        </div>
      </div>
    `;

    document.body.appendChild(widgetContainer);
  }

  /**
   * Toggle chat window
   */
  function toggleChat() {
    isOpen = !isOpen;
    const chatWindow = document.getElementById('wells-chat-window');
    const chatButton = document.getElementById('wells-chat-button');

    if (isOpen) {
      chatWindow.classList.add('open');
      document.getElementById('wells-input')?.focus();
    } else {
      chatWindow.classList.remove('open');
    }
  }

  /**
   * Add message to chat
   */
  function addMessage(content, sender = 'ai') {
    const messagesContainer = document.getElementById('wells-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `wells-message ${sender}`;

    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

    messageDiv.innerHTML = `
      <div class="wells-message-avatar">${sender === 'user' ? 'Y' : 'W'}</div>
      <div>
        <div class="wells-message-content">${content}</div>
        <div class="wells-message-time">${time}</div>
      </div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    messages.push({ content, sender, timestamp: new Date() });
  }

  /**
   * Show/hide typing indicator
   */
  function setTyping(typing) {
    const typingIndicator = document.getElementById('wells-typing');
    if (typing) {
      typingIndicator.classList.add('active');
    } else {
      typingIndicator.classList.remove('active');
    }
  }

  /**
   * Send message to AI
   */
  async function sendMessage(message) {
    if (!message.trim()) return;

    // Add user message
    addMessage(message, 'user');

    // Clear input
    document.getElementById('wells-input').value = '';

    // Show typing indicator
    setTyping(true);

    try {
      const response = await fetch(`${API_BASE}/widget/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wells-Key': apiKey,
        },
        body: JSON.stringify({
          message,
          conversationId,
          context: {
            url: window.location.href,
            referrer: document.referrer,
          },
        }),
      });

      const data = await response.json();

      // Hide typing indicator
      setTyping(false);

      if (data.error) {
        addMessage('Sorry, I encountered an error. Please try again.', 'ai');
      } else {
        addMessage(data.response, 'ai');
      }
    } catch (error) {
      setTyping(false);
      addMessage('Sorry, I couldn\'t connect to the server. Please try again.', 'ai');
      console.error('Wells AI Widget Error:', error);
    }
  }

  /**
   * Initialize widget
   */
  function init() {
    // Create widget HTML
    createWidget();

    // Attach event listeners
    document.getElementById('wells-chat-button')?.addEventListener('click', toggleChat);
    document.querySelector('.wells-close-btn')?.addEventListener('click', toggleChat);

    const input = document.getElementById('wells-input');
    const sendBtn = document.getElementById('wells-send-btn');

    sendBtn?.addEventListener('click', () => {
      const message = input?.value || '';
      sendMessage(message);
    });

    input?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const message = input?.value || '';
        sendMessage(message);
      }
    });

    // Track widget load
    if (typeof window !== 'undefined' && apiKey !== 'demo') {
      fetch(`${API_BASE}/widget/track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Wells-Key': apiKey,
        },
        body: JSON.stringify({
          event: 'widget_loaded',
          url: window.location.href,
          version: WIDGET_VERSION,
        }),
      }).catch(() => {});
    }

    console.log(`Wells AI Widget v${WIDGET_VERSION} loaded successfully`);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for advanced usage
  window.WellsAI = {
    version: WIDGET_VERSION,
    open: () => {
      if (!isOpen) toggleChat();
    },
    close: () => {
      if (isOpen) toggleChat();
    },
    send: (message) => sendMessage(message),
    getMessages: () => messages,
  };

})();
