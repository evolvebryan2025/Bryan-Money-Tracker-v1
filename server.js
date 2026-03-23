const express = require('express');
const path = require('path');
const crypto = require('crypto');

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk'); } catch(e) {}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ===== AUTH CONFIGURATION =====
const AUTHORIZED_EMAIL = 'bryansumaitofficial@gmail.com';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const TOKEN_SECRET = process.env.TOKEN_SECRET || 'bf-finance-' + AUTHORIZED_EMAIL;

// Login attempt tracking for brute-force protection: Map<ip, timestamp[]>
const loginAttempts = new Map();

// Clean up old login attempts every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts) {
    const recent = attempts.filter(t => now - t < 60000);
    if (recent.length === 0) loginAttempts.delete(ip);
    else loginAttempts.set(ip, recent);
  }
}, 300000);

// Stateless token helpers (HMAC-signed, works across Vercel instances)
function createToken(email, expires) {
  const payload = `${email}:${expires}`;
  const sig = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString();
    const parts = decoded.split(':');
    if (parts.length < 3) return null;

    const sig = parts.pop();
    const expires = Number(parts.pop());
    const email = parts.join(':'); // handles emails with colons (unlikely but safe)

    if (isNaN(expires) || expires <= Date.now()) return null;

    const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET)
      .update(`${email}:${expires}`).digest('hex');

    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;

    return { email, expires };
  } catch {
    return null;
  }
}

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Increased limit to support image uploads
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Simple rate limiter: max 20 requests per minute per IP
const rateMap = new Map();
function rateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60000;
  const maxReqs = 20;

  if (!rateMap.has(ip)) rateMap.set(ip, []);
  const hits = rateMap.get(ip).filter(t => now - t < windowMs);
  hits.push(now);
  rateMap.set(ip, hits);

  if (hits.length > maxReqs) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }
  next();
}

// Clean up rate map every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of rateMap) {
    const recent = hits.filter(t => now - t < 60000);
    if (recent.length === 0) rateMap.delete(ip);
    else rateMap.set(ip, recent);
  }
}, 300000);

// ===== LOGIN RATE LIMITER (5 attempts per IP per minute) =====
function loginRateLimit(req, res, next) {
  const ip = req.ip;
  const now = Date.now();
  const windowMs = 60000;
  const maxAttempts = 5;

  const attempts = (loginAttempts.get(ip) || []).filter(t => now - t < windowMs);
  if (attempts.length >= maxAttempts) {
    return res.status(429).json({ error: 'Too many login attempts. Please wait 60 seconds.' });
  }

  // Record this attempt (immutable: create new array)
  loginAttempts.set(ip, [...attempts, now]);
  next();
}

// ===== AUTH MIDDLEWARE =====
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice(7);
  const session = verifyToken(token);

  if (!session) {
    return res.status(401).json({ error: 'Invalid or expired session. Please log in again.' });
  }

  req.sessionUser = session.email;
  next();
}

// ===== AUTH ENDPOINTS =====

// POST /api/login
app.post('/api/login', loginRateLimit, (req, res) => {
  const { email } = req.body || {};

  if (!email) {
    return res.status(400).json({ error: 'Email is required.' });
  }

  if (typeof email !== 'string') {
    return res.status(400).json({ error: 'Invalid input.' });
  }

  // Normalize and compare email (case-insensitive)
  const normalizedEmail = email.trim().toLowerCase();
  const expectedEmail = AUTHORIZED_EMAIL.toLowerCase();

  // Constant-time comparison to prevent timing attacks
  const maxLen = Math.max(normalizedEmail.length, expectedEmail.length);
  const emailMatch = normalizedEmail.length === expectedEmail.length &&
    crypto.timingSafeEqual(
      Buffer.from(normalizedEmail.padEnd(maxLen, '\0')),
      Buffer.from(expectedEmail.padEnd(maxLen, '\0'))
    );

  if (!emailMatch) {
    return res.status(401).json({ error: 'Unauthorized email address.' });
  }

  // Generate stateless signed token
  const expires = Date.now() + SESSION_DURATION_MS;
  const token = createToken(normalizedEmail, expires);

  return res.json({
    token,
    email: normalizedEmail,
    expires
  });
});

// GET /api/validate-session
app.get('/api/validate-session', (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.json({ valid: false });
  }

  const token = authHeader.slice(7);
  const session = verifyToken(token);

  if (!session) {
    return res.json({ valid: false });
  }

  return res.json({ valid: true, email: session.email });
});

// Tool definitions for data manipulation
const TOOLS = [
  {
    name: 'add_bill',
    description: 'Add a new bill to the system. Use this when the user wants to add a bill they need to pay.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the bill (e.g., "Electric Bill", "Internet")' },
        amount: { type: 'number', description: 'Amount in PHP' },
        dueDate: { type: 'string', description: 'Due date in YYYY-MM-DD format' },
        category: { type: 'string', description: 'Category: utilities, subscriptions, rent, insurance, loan, tax, or other' },
        recurring: { type: 'boolean', description: 'Whether this bill repeats monthly' }
      },
      required: ['name', 'amount', 'dueDate', 'category']
    }
  },
  {
    name: 'update_bill',
    description: 'Update an existing bill. Use this when the user wants to change bill details.',
    input_schema: {
      type: 'object',
      properties: {
        billId: { type: 'string', description: 'ID of the bill to update' },
        updates: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            amount: { type: 'number' },
            dueDate: { type: 'string' },
            category: { type: 'string' },
            status: { type: 'string', enum: ['unpaid', 'paid', 'overdue'] }
          }
        }
      },
      required: ['billId', 'updates']
    }
  },
  {
    name: 'mark_bill_paid',
    description: 'Mark a bill as paid. Use when user confirms they have paid a bill.',
    input_schema: {
      type: 'object',
      properties: {
        billId: { type: 'string', description: 'ID of the bill to mark as paid' }
      },
      required: ['billId']
    }
  },
  {
    name: 'delete_bill',
    description: 'Delete a bill from the system. Use with caution.',
    input_schema: {
      type: 'object',
      properties: {
        billId: { type: 'string', description: 'ID of the bill to delete' }
      },
      required: ['billId']
    }
  },
  {
    name: 'add_income',
    description: 'Add an income source. Use when user mentions receiving money or a new client.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of income source (e.g., "Client ABC Payment", "Freelance Project")' },
        amount: { type: 'number', description: 'Amount in PHP' },
        nextDate: { type: 'string', description: 'Expected date in YYYY-MM-DD format' },
        recurring: { type: 'boolean', description: 'Whether this income repeats monthly' }
      },
      required: ['name', 'amount', 'nextDate']
    }
  },
  {
    name: 'add_expense',
    description: 'Add a one-time expense. Use when user mentions spending money on something.',
    input_schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'What was purchased (e.g., "Lunch", "Gas", "Office Supplies")' },
        amount: { type: 'number', description: 'Amount spent in PHP' },
        category: { type: 'string', enum: ['food', 'transport', 'tools', 'personal', 'other'], description: 'Expense category' },
        bankId: { type: 'string', description: 'Bank account used (gcash, bpi, maya, etc.) - optional' },
        date: { type: 'string', description: 'Date of expense in YYYY-MM-DD format (defaults to today)' }
      },
      required: ['name', 'amount', 'category']
    }
  },
  {
    name: 'update_bank_balance',
    description: 'Update a bank account balance. Use when user mentions their current balance.',
    input_schema: {
      type: 'object',
      properties: {
        bankId: { type: 'string', description: 'Bank ID (gcash, bpi, maya, etc.)' },
        balance: { type: 'number', description: 'New balance in PHP' }
      },
      required: ['bankId', 'balance']
    }
  },
  {
    name: 'get_bills',
    description: 'Get list of all bills. Use when you need to see current bills before updating them.',
    input_schema: {
      type: 'object',
      properties: {},
      required: []
    }
  }
];

// AI Chat proxy endpoint with tool support
app.post('/api/chat', requireAuth, rateLimit, async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey || apiKey === 'your-api-key-here') {
    return res.status(400).json({ error: 'API key not configured. Set ANTHROPIC_API_KEY in your .env file.' });
  }

  if (!Anthropic) {
    return res.status(500).json({ error: 'Anthropic SDK not installed. Run: npm install' });
  }

  try {
    const client = new Anthropic({ apiKey });
    const systemPrompt = buildSystemPrompt(req.body.financialContext);

    // Validate and prepare messages (support text and images)
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const sanitizedMessages = messages
      .filter(m => m && typeof m.role === 'string')
      .map(m => {
        if (m.role === 'assistant' || m.role === 'user') {
          // Support both simple text and multi-content messages
          if (typeof m.content === 'string') {
            return { role: m.role, content: m.content.slice(0, 10000) };
          } else if (Array.isArray(m.content)) {
            // Multi-content message (text + images)
            return { role: m.role, content: m.content };
          }
        }
        return null;
      })
      .filter(Boolean);

    // Make API call with tool support
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages: sanitizedMessages,
      tools: TOOLS
    });

    // Handle tool use
    if (response.stop_reason === 'tool_use') {
      const toolUse = response.content.find(block => block.type === 'tool_use');

      if (toolUse) {
        const toolResult = executeToolCall(toolUse.name, toolUse.input, req.body.currentData);

        return res.json({
          response: null,
          toolUse: {
            id: toolUse.id,
            name: toolUse.name,
            input: toolUse.input,
            result: toolResult
          },
          assistantMessage: response.content
        });
      }
    }

    // Regular text response
    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    res.json({ response: text });
  } catch (err) {
    console.error('Anthropic API error:', err.status, err.message, err.error || '');
    const safeMsg = err.status === 401 ? 'Invalid API key. Check your environment variables.'
      : err.status === 429 ? 'API rate limit reached. Please wait a moment.'
      : err.status === 404 ? 'Model not found. Check server configuration.'
      : `AI service error (${err.status || 'unknown'}). Please try again.`;
    res.status(500).json({ error: safeMsg });
  }
});

// Execute tool calls
function executeToolCall(toolName, input, currentData) {
  // currentData contains the current state of bills, income, expenses, banks from frontend
  const { bills = [], incomes = [], expenses = [], banks = [] } = currentData || {};

  switch (toolName) {
    case 'add_bill':
      return {
        success: true,
        action: 'add_bill',
        data: {
          name: input.name,
          amount: input.amount,
          dueDate: input.dueDate,
          category: input.category,
          recurring: input.recurring || false,
          status: 'unpaid'
        },
        message: `Bill "${input.name}" for ₱${input.amount.toLocaleString()} due on ${input.dueDate} has been added.`
      };

    case 'update_bill':
      const billToUpdate = bills.find(b => b.id === input.billId);
      if (!billToUpdate) {
        return { success: false, error: 'Bill not found' };
      }
      return {
        success: true,
        action: 'update_bill',
        billId: input.billId,
        updates: input.updates,
        message: `Bill "${billToUpdate.name}" has been updated.`
      };

    case 'mark_bill_paid':
      const billToPay = bills.find(b => b.id === input.billId);
      if (!billToPay) {
        return { success: false, error: 'Bill not found' };
      }
      return {
        success: true,
        action: 'mark_bill_paid',
        billId: input.billId,
        message: `Bill "${billToPay.name}" marked as paid.`
      };

    case 'delete_bill':
      const billToDelete = bills.find(b => b.id === input.billId);
      if (!billToDelete) {
        return { success: false, error: 'Bill not found' };
      }
      return {
        success: true,
        action: 'delete_bill',
        billId: input.billId,
        message: `Bill "${billToDelete.name}" has been deleted.`
      };

    case 'add_income':
      return {
        success: true,
        action: 'add_income',
        data: {
          name: input.name,
          amount: input.amount,
          nextDate: input.nextDate,
          recurring: input.recurring || false,
          status: 'expected'
        },
        message: `Income "${input.name}" for ₱${input.amount.toLocaleString()} expected on ${input.nextDate} has been added.`
      };

    case 'add_expense':
      return {
        success: true,
        action: 'add_expense',
        data: {
          name: input.name,
          amount: input.amount,
          category: input.category,
          bankId: input.bankId || '',
          date: input.date || new Date().toISOString().split('T')[0],
          note: ''
        },
        message: `Expense "${input.name}" for ₱${input.amount.toLocaleString()} has been added.`
      };

    case 'update_bank_balance':
      const bank = banks.find(b => b.id === input.bankId);
      const bankName = bank ? bank.name : input.bankId;
      return {
        success: true,
        action: 'update_bank_balance',
        bankId: input.bankId,
        balance: input.balance,
        message: `${bankName} balance updated to ₱${input.balance.toLocaleString()}.`
      };

    case 'get_bills':
      return {
        success: true,
        action: 'get_bills',
        data: bills,
        message: `Found ${bills.length} bills.`
      };

    default:
      return { success: false, error: 'Unknown tool' };
  }
}

function buildSystemPrompt(ctx) {
  const base = `You are Bryan's AI Financial Advisor with the ability to manage his financial data.

## Your Capabilities
You can:
- Add, update, and delete bills
- Add income sources
- Track expenses
- Update bank balances
- Analyze financial data from screenshots and images
- Answer financial questions

When users upload screenshots or images containing financial information (bills, receipts, invoices), analyze them carefully and extract:
- Bill name
- Amount
- Due date
- Category

Then use your tools to add the data to the system.

## Bryan's Business
Bryan runs a B2B automation business helping service businesses capture missed calls, respond in under 60 seconds, and convert leads into booked appointments. He operates from the Philippines, serving primarily US/English-speaking markets remotely.

## Your Role
- Help Bryan manage his finances by adding/updating data when requested
- Suggest how much Bryan can safely spend today
- Warn about upcoming cash crunches
- Advise on cost optimization
- Help prioritize which bills to pay first
- Track progress toward his $20K/mo goal
- Be direct, practical, and numbers-driven. No fluff.
- Always show amounts in PHP. Mention USD equivalent when relevant.
- When suggesting daily spend, factor in: bills due before next expected income, current cash on hand, and a safety buffer.

## Important
- ALWAYS use your tools to modify data when the user asks you to add/update/delete something
- Ask for confirmation before deleting data
- When analyzing images, be thorough and accurate with extracting financial data`;

  if (!ctx) return base;

  return base + `

## Current Financial Snapshot
- Total Monthly Bills: ₱${ctx.totalBills?.toLocaleString() || '0'}
- Total Expected Income: ₱${ctx.totalIncome?.toLocaleString() || '0'}
- Money on Hand: ₱${ctx.moneyOnHand?.toLocaleString() || '0'}
- Days Left in Month: ${ctx.daysLeft || '?'}
- Suggested Daily Budget: ₱${ctx.dailyBudget?.toLocaleString() || '0'}
- Upcoming Bills (next 7 days): ${ctx.upcomingBills || 'None'}
- Next Expected Income: ${ctx.nextIncome || 'Unknown'}
- Overdue Bills: ${ctx.overdueBills || 'None'}`;
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Only listen when running locally (not on Vercel)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Bryan Finance App running at http://localhost:${PORT}`);
  });
}

// Export for Vercel serverless
module.exports = app;
