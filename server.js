const express = require('express');
const path = require('path');

let Anthropic;
try { Anthropic = require('@anthropic-ai/sdk').default || require('@anthropic-ai/sdk'); } catch(e) {}

require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '1mb' }));
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

// AI Chat proxy endpoint
app.post('/api/chat', rateLimit, async (req, res) => {
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

    // Validate messages array
    const messages = Array.isArray(req.body.messages) ? req.body.messages : [];
    const sanitizedMessages = messages
      .filter(m => m && typeof m.role === 'string' && typeof m.content === 'string')
      .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 10000) }));

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 1024,
      system: systemPrompt,
      messages: sanitizedMessages
    });

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    res.json({ response: text });
  } catch (err) {
    console.error('Anthropic API error:', err.message);
    // Don't leak internal error details to client
    const safeMsg = err.status === 401 ? 'Invalid API key. Check your .env file.'
      : err.status === 429 ? 'API rate limit reached. Please wait a moment.'
      : 'AI service temporarily unavailable. Please try again.';
    res.status(500).json({ error: safeMsg });
  }
});

function buildSystemPrompt(ctx) {
  const base = `You are Bryan's AI Financial Advisor. You know his business inside out.

## Bryan's Business
Bryan runs a B2B automation business helping service businesses capture missed calls, respond in under 60 seconds, and convert leads into booked appointments. He operates from the Philippines, serving primarily US/English-speaking markets remotely.

## Your Role
- Suggest how much Bryan can safely spend today based on his cash on hand, upcoming bills, and expected income
- Warn about upcoming cash crunches
- Advise on cost optimization
- Help prioritize which bills to pay first
- Track progress toward his $20K/mo goal
- Be direct, practical, and numbers-driven. No fluff.
- Always show amounts in PHP. Mention USD equivalent when relevant.
- When suggesting daily spend, factor in: bills due before next expected income, current cash on hand, and a safety buffer.`;

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

app.listen(PORT, () => {
  console.log(`Bryan Finance App running at http://localhost:${PORT}`);
});
