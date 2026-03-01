// ===== AI FINANCIAL ADVISOR CHAT =====
const Chat = {
  messages: [],
  isLoading: false,

  init() {
    this.messages = Storage.getChatHistory();
    if (this.messages.length > 0) {
      this._renderHistory();
    }
  },

  send() {
    if (this.isLoading) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    this._addMessage('user', text);
    this._callAPI(text);
  },

  sendSuggestion(btn) {
    if (this.isLoading) return;
    const text = btn.textContent;
    this._addMessage('user', text);
    this._callAPI(text);

    // Hide suggestions after first use
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) suggestionsEl.style.display = 'none';
  },

  clear() {
    this.messages = [];
    Storage.saveChatHistory([]);
    const container = document.getElementById('chat-messages');
    container.innerHTML = `
      <div class="chat-welcome">
        <p><strong>Hey Bryan!</strong> I'm your AI financial advisor. I know your business, your bills, your income, and your goals. Ask me anything.</p>
      </div>
      <div class="chat-suggestions" id="chat-suggestions">
        <button class="suggestion-btn" onclick="Chat.sendSuggestion(this)">How much can I safely spend today?</button>
        <button class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Which bills should I prioritize this week?</button>
        <button class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Am I on track for my $20K/mo goal?</button>
        <button class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Where can I cut costs?</button>
        <button class="suggestion-btn" onclick="Chat.sendSuggestion(this)">When's my next cash crunch?</button>
      </div>`;
  },

  _addMessage(role, content) {
    this.messages.push({ role, content });
    Storage.saveChatHistory(this.messages);

    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    if (role === 'assistant') {
      bubble.innerHTML = Utils.mdToHtml(content);
    } else {
      bubble.textContent = content;
    }

    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  async _callAPI() {
    this.isLoading = true;
    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    // Show typing indicator
    const container = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chat-typing';
    typing.textContent = 'Thinking';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    const financialContext = Budget.getFinancialContext();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          financialContext,
          messages: this.messages.map(m => ({
            role: m.role,
            content: m.content
          }))
        })
      });

      const data = await res.json();

      // Remove typing indicator
      const typingEl = document.getElementById('chat-typing');
      if (typingEl) typingEl.remove();

      if (data.error) {
        this._addMessage('assistant', `**Error:** ${data.error}\n\nMake sure your API key is set in Settings.`);
      } else {
        this._addMessage('assistant', data.response);
      }
    } catch (err) {
      const typingEl = document.getElementById('chat-typing');
      if (typingEl) typingEl.remove();
      this._addMessage('assistant', `**Connection error.** Make sure the server is running.\n\nError: ${err.message}`);
    }

    this.isLoading = false;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  },

  _renderHistory() {
    const container = document.getElementById('chat-messages');
    // Keep welcome but remove suggestions
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    this.messages.forEach(m => {
      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${m.role}`;
      if (m.role === 'assistant') {
        bubble.innerHTML = Utils.mdToHtml(m.content);
      } else {
        bubble.textContent = m.content;
      }
      container.appendChild(bubble);
    });
    container.scrollTop = container.scrollHeight;
  },

  askAboutInsight(prompt) {
    App.navigate('chat');

    // Wait for view to load, then populate input
    setTimeout(() => {
      const input = document.getElementById('chat-input');
      if (input) {
        input.value = prompt;
        input.focus();
      }
    }, 100);
  }
};
