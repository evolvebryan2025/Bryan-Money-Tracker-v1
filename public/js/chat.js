// ===== AI FINANCIAL ADVISOR CHAT WITH FILE UPLOAD =====
const Chat = {
  messages: [],
  isLoading: false,
  uploadedFiles: [],

  init() {
    this.messages = Storage.getChatHistory();
    if (this.messages.length > 0) {
      this._renderHistory();
    }

    // Enable paste support for images (Ctrl+V / Cmd+V)
    document.addEventListener('paste', (e) => {
      // Only handle paste when chat view is active
      if (App.currentView !== 'chat') return;

      const items = Array.from(e.clipboardData?.items || []);
      const imageItems = items.filter(item => item.type.startsWith('image/'));

      if (imageItems.length > 0) {
        e.preventDefault();
        imageItems.forEach(item => {
          const blob = item.getAsFile();
          if (!blob) return;

          const reader = new FileReader();
          reader.onload = (ev) => {
            this.uploadedFiles.push({
              type: 'image',
              data: ev.target.result,
              name: `pasted-image-${Date.now()}.png`,
              mimeType: blob.type
            });
            this._updateFilePreview();
            Toast.show('Image pasted! Add a message or click Send.', 'success');
          };
          reader.readAsDataURL(blob);
        });
      }
    });

    // Enable drag-and-drop for images
    const chatContainer = document.querySelector('.chat-container');
    if (chatContainer) {
      chatContainer.addEventListener('dragover', (e) => {
        e.preventDefault();
        chatContainer.classList.add('drag-over');
      });
      chatContainer.addEventListener('dragleave', () => {
        chatContainer.classList.remove('drag-over');
      });
      chatContainer.addEventListener('drop', (e) => {
        e.preventDefault();
        chatContainer.classList.remove('drag-over');
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              this.uploadedFiles.push({
                type: 'image',
                data: ev.target.result,
                name: file.name,
                mimeType: file.type
              });
              this._updateFilePreview();
            };
            reader.readAsDataURL(file);
          }
        });
        if (files.some(f => f.type.startsWith('image/'))) {
          Toast.show('Image added! Add a message or click Send.', 'success');
        }
      });
    }
  },

  send() {
    if (this.isLoading) return;
    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    // Check if we have uploaded files
    const hasFiles = this.uploadedFiles.length > 0;

    if (!text && !hasFiles) return;

    input.value = '';

    // Add message with files if present
    if (hasFiles) {
      this._addMessage('user', text || 'See attached images', this.uploadedFiles);
      this._callAPI(text || 'Analyze these images and extract any financial data', this.uploadedFiles);
      this.uploadedFiles = [];
      this._updateFilePreview();
    } else {
      this._addMessage('user', text);
      this._callAPI(text);
    }
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

  handleFileSelect(input) {
    const files = Array.from(input.files);

    files.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.uploadedFiles.push({
            type: 'image',
            data: e.target.result,
            name: file.name,
            mimeType: file.type
          });
          this._updateFilePreview();
        };
        reader.readAsDataURL(file);
      } else {
        Toast.show('Only image files are supported for now.', 'warning');
      }
    });

    // Clear input
    input.value = '';
  },

  removeFile(index) {
    this.uploadedFiles = this.uploadedFiles.filter((_, i) => i !== index);
    this._updateFilePreview();
  },

  _updateFilePreview() {
    const preview = document.getElementById('file-preview');

    if (this.uploadedFiles.length === 0) {
      preview.innerHTML = '';
      preview.style.display = 'none';
      return;
    }

    preview.style.display = 'flex';
    preview.innerHTML = this.uploadedFiles.map((file, index) => `
      <div class="file-preview-item">
        <img src="${file.data}" alt="${Utils.esc(file.name)}">
        <button type="button" class="file-remove-btn" onclick="Chat.removeFile(${index})" aria-label="Remove file">&times;</button>
        <span class="file-name">${Utils.esc(file.name)}</span>
      </div>
    `).join('');
  },

  clear() {
    this.messages = [];
    this.uploadedFiles = [];
    Storage.saveChatHistory([]);
    this._updateFilePreview();

    const container = document.getElementById('chat-messages');
    container.innerHTML = `
      <div class="chat-welcome">
        <p><strong>Hey Bryan!</strong> I'm your AI financial advisor. I can help you manage your finances.</p>
        <p class="chat-feature-highlight">📸 <strong>New:</strong> Upload screenshots of bills, receipts, or invoices - I'll extract the data and add it to your tracker!</p>
      </div>
      <div class="chat-suggestions" id="chat-suggestions">
        <button type="button" class="suggestion-btn" onclick="Chat.sendSuggestion(this)">How much can I safely spend today?</button>
        <button type="button" class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Which bills should I prioritize this week?</button>
        <button type="button" class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Am I on track for my $20K/mo goal?</button>
        <button type="button" class="suggestion-btn" onclick="Chat.sendSuggestion(this)">Where can I cut costs?</button>
        <button type="button" class="suggestion-btn" onclick="Chat.sendSuggestion(this)">When's my next cash crunch?</button>
      </div>`;
  },

  _addMessage(role, content, files = []) {
    const messageObj = { role, content };

    // Store files with message if present
    if (files.length > 0) {
      messageObj.files = files.map(f => ({
        type: f.type,
        data: f.data,
        name: f.name
      }));
    }

    this.messages.push(messageObj);
    // Limit chat history to prevent memory bloat
    if (this.messages.length > 100) {
      this.messages = this.messages.slice(-100);
    }
    Storage.saveChatHistory(this.messages);

    const container = document.getElementById('chat-messages');
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${role}`;

    let html = '';

    // Display attached images
    if (files && files.length > 0) {
      html += '<div class="chat-images">';
      files.forEach(file => {
        if (file.type === 'image') {
          html += `<img src="${file.data}" alt="${Utils.esc(file.name)}" class="chat-image">`;
        }
      });
      html += '</div>';
    }

    // Display text content
    if (role === 'assistant') {
      html += Utils.mdToHtml(content);
    } else {
      html += `<div class="chat-text">${Utils.esc(content)}</div>`;
    }

    bubble.innerHTML = html;
    container.appendChild(bubble);
    container.scrollTop = container.scrollHeight;
  },

  async _callAPI(userMessage, files = []) {
    this.isLoading = true;
    const sendBtn = document.getElementById('chat-send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = '...';

    // Show typing indicator
    const container = document.getElementById('chat-messages');
    const typing = document.createElement('div');
    typing.className = 'chat-typing';
    typing.id = 'chat-typing';
    typing.textContent = 'Analyzing';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    const financialContext = Budget.getFinancialContext();

    // Prepare messages with image support
    const apiMessages = this.messages.map(m => {
      if (m.files && m.files.length > 0) {
        // Multi-content message with images
        const content = [];

        // Add images first
        m.files.forEach(file => {
          if (file.type === 'image') {
            // Extract base64 data and media type
            const matches = file.data.match(/^data:(.+);base64,(.+)$/);
            if (matches) {
              content.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: matches[1],
                  data: matches[2]
                }
              });
            }
          }
        });

        // Add text content
        if (m.content) {
          content.push({
            type: 'text',
            text: m.content
          });
        }

        return { role: m.role, content };
      } else {
        return { role: m.role, content: m.content };
      }
    });

    // Get current data for tool execution
    const currentData = {
      bills: Storage.getBills(),
      incomes: Storage.getIncomes(),
      expenses: Storage.getExpenses ? Storage.getExpenses() : [],
      banks: Storage.getBanks()
    };

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getSessionToken()}`
        },
        body: JSON.stringify({
          financialContext,
          messages: apiMessages,
          currentData
        })
      });

      if (!res.ok) {
        throw new Error(`Server error (${res.status}). Make sure the server is running.`);
      }

      const data = await res.json();

      // Remove typing indicator
      const typingEl = document.getElementById('chat-typing');
      if (typingEl) typingEl.remove();

      if (data.error) {
        this._addMessage('assistant', `**Error:** ${data.error}\n\nMake sure your API key is set in Settings.`);
      } else if (data.toolUse) {
        // AI wants to use a tool - execute it and show result
        const result = await this._executeToolUse(data.toolUse);

        // Add assistant message showing the tool was used
        const toolMessage = `${result.message}\n\n✅ ${result.action} completed successfully.`;
        this._addMessage('assistant', toolMessage);

        // Add the assistant's tool use to messages for continuation
        this.messages.push({
          role: 'assistant',
          content: data.assistantMessage
        });

        // Add tool result to messages
        this.messages.push({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: data.toolUse.id,
              content: JSON.stringify(result)
            }
          ]
        });

        // Continue conversation to get AI's final response
        await this._continueAfterTool();
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

  async _executeToolUse(toolUse) {
    const { name, input, result } = toolUse;

    // Apply the tool action to storage
    switch (result.action) {
      case 'add_bill':
        Storage.addBill(result.data);
        Bills.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'update_bill':
        Storage.updateBill(result.billId, result.updates);
        Bills.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'mark_bill_paid':
        Storage.updateBill(result.billId, { status: 'paid' });
        Bills.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'delete_bill':
        Storage.deleteBill(result.billId);
        Bills.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'add_income':
        Storage.addIncome(result.data);
        Income.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'add_expense':
        Storage.addExpense(result.data);
        if (typeof Expenses.render === 'function') Expenses.render();
        Dashboard.render();
        Insights.invalidateCache();
        break;

      case 'update_bank_balance':
        Storage.updateBank(result.bankId, result.balance);
        Banks.render();
        Dashboard.render();
        break;
    }

    return result;
  },

  async _continueAfterTool() {
    try {
      const financialContext = Budget.getFinancialContext();
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Auth.getSessionToken()}`
        },
        body: JSON.stringify({
          financialContext,
          messages: this.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          currentData: {
            bills: Storage.getBills(),
            incomes: Storage.getIncomes(),
            expenses: Storage.getExpenses ? Storage.getExpenses() : [],
            banks: Storage.getBanks()
          }
        })
      });

      if (!res.ok) return;

      const data = await res.json();
      if (data.response && !data.toolUse) {
        this._addMessage('assistant', data.response);
      }
    } catch (err) {
      // Silent fail - the tool execution message is sufficient
      console.log('[Chat] Continue after tool skipped:', err.message);
    }
  },

  _renderHistory() {
    const container = document.getElementById('chat-messages');
    // Keep welcome but remove suggestions
    const suggestionsEl = document.getElementById('chat-suggestions');
    if (suggestionsEl) suggestionsEl.style.display = 'none';

    this.messages.forEach(m => {
      // Skip internal tool-result messages (array content with tool_result type)
      if (Array.isArray(m.content) && m.content.some(b => b.type === 'tool_result')) return;
      // Skip assistant messages with non-renderable content (tool_use blocks)
      if (m.role === 'assistant' && Array.isArray(m.content) && m.content.every(b => b.type === 'tool_use')) return;

      const bubble = document.createElement('div');
      bubble.className = `chat-bubble ${m.role}`;

      let html = '';

      // Display attached images
      if (m.files && m.files.length > 0) {
        html += '<div class="chat-images">';
        m.files.forEach(file => {
          if (file.type === 'image') {
            html += `<img src="${file.data}" alt="${Utils.esc(file.name)}" class="chat-image">`;
          }
        });
        html += '</div>';
      }

      // Display text
      if (m.role === 'assistant') {
        html += Utils.mdToHtml(m.content);
      } else {
        if (typeof m.content === 'string') {
          html += `<div class="chat-text">${Utils.esc(m.content)}</div>`;
        }
      }

      // Only add bubble if it has content
      if (html.trim()) {
        bubble.innerHTML = html;
        container.appendChild(bubble);
      }
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
