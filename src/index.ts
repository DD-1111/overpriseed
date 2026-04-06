import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { indexHtml, docsHtml } from './html'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// ============================================
// Rate Limiting Middleware
// Simple sliding window counter per IP
// ============================================
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60,     // 60 requests per minute
  cleanupInterval: 5 * 60 * 1000 // Clean old entries every 5 minutes
}

// Cleanup old entries periodically
let lastCleanup = Date.now()

function cleanupRateLimitStore() {
  const now = Date.now()
  if (now - lastCleanup > RATE_LIMIT.cleanupInterval) {
    for (const [key, value] of rateLimitStore.entries()) {
      if (value.resetAt < now) {
        rateLimitStore.delete(key)
      }
    }
    lastCleanup = now
  }
}

function getRateLimitKey(c: any): string {
  // Use CF-Connecting-IP (Cloudflare's real client IP)
  return c.req.header('cf-connecting-ip') || 
         c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || 
         'unknown'
}

app.use('/api/*', async (c, next) => {
  cleanupRateLimitStore()
  
  const key = getRateLimitKey(c)
  const now = Date.now()
  
  let record = rateLimitStore.get(key)
  
  if (!record || record.resetAt < now) {
    // New window
    record = { count: 1, resetAt: now + RATE_LIMIT.windowMs }
    rateLimitStore.set(key, record)
  } else {
    record.count++
  }
  
  // Set rate limit headers
  const remaining = Math.max(0, RATE_LIMIT.maxRequests - record.count)
  c.header('X-RateLimit-Limit', String(RATE_LIMIT.maxRequests))
  c.header('X-RateLimit-Remaining', String(remaining))
  c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)))
  
  if (record.count > RATE_LIMIT.maxRequests) {
    c.header('Retry-After', String(Math.ceil((record.resetAt - now) / 1000)))
    return c.json({
      success: false,
      error: 'Too many requests. Please slow down.',
      retry_after: Math.ceil((record.resetAt - now) / 1000)
    }, 429)
  }
  
  await next()
})

// Stricter rate limit for write operations (POST)
app.use('/api/v1/analyses', async (c, next) => {
  if (c.req.method !== 'POST') {
    return next()
  }
  
  const key = `write:${getRateLimitKey(c)}`
  const now = Date.now()
  const writeLimit = 10 // 10 writes per minute
  
  let record = rateLimitStore.get(key)
  
  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + RATE_LIMIT.windowMs }
    rateLimitStore.set(key, record)
  } else {
    record.count++
  }
  
  if (record.count > writeLimit) {
    return c.json({
      success: false,
      error: 'Too many write requests. Limit: 10 per minute.',
      retry_after: Math.ceil((record.resetAt - now) / 1000)
    }, 429)
  }
  
  await next()
})

// Serve frontend
app.get('/', (c) => {
  return c.html(indexHtml)
})

// API Documentation
app.get('/docs', (c) => {
  return c.html(docsHtml)
})

app.use('/api/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
}))

app.get('/api/health', (c) => {
  return c.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'overpriseed'
  })
})

app.get('/api/v1/deals', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(
      `SELECT * FROM deals ORDER BY created_at DESC`
    ).all()
    
    return c.json({ 
      success: true,
      data: results 
    })
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Failed to fetch deals' 
    }, 500)
  }
})

app.get('/api/v1/deals/:id', async (c) => {
  try {
    const db = c.env.DB
    const id = c.req.param('id')
    
    // Get deal with all fields
    const deal = await db.prepare(
      `SELECT * FROM deals WHERE id = ?`
    ).bind(id).first() as any
    
    if (!deal) {
      return c.json({ success: false, error: 'Deal not found' }, 404)
    }
    
    // Parse JSON fields
    if (deal.core_features) {
      try { deal.core_features = JSON.parse(deal.core_features) } catch (e) { deal.core_features = [] }
    }
    if (deal.tech_stack) {
      try { deal.tech_stack = JSON.parse(deal.tech_stack) } catch (e) { deal.tech_stack = {} }
    }
    
    // Get analyses for this deal
    const { results: analyses } = await db.prepare(
      `SELECT * FROM analyses WHERE deal_id = ? ORDER BY created_at DESC`
    ).bind(id).all()
    
    return c.json({ 
      success: true,
      data: {
        ...deal,
        analyses: analyses || []
      }
    })
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Failed to fetch deal' 
    }, 500)
  }
})

app.get('/api/v1/analyses', async (c) => {
  try {
    const db = c.env.DB
    const dealId = c.req.query('deal_id')
    
    let query = `SELECT * FROM analyses`
    if (dealId) {
      query += ` WHERE deal_id = ?`
    }
    query += ` ORDER BY created_at DESC`
    
    const stmt = dealId 
      ? db.prepare(query).bind(dealId)
      : db.prepare(query)
    
    const { results } = await stmt.all()
    
    return c.json({ 
      success: true,
      data: results 
    })
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Failed to fetch analyses' 
    }, 500)
  }
})

app.post('/api/v1/analyses', async (c) => {
  try {
    const db = c.env.DB
    const body = await c.req.json()
    
    // Validate required fields
    const { deal_id, author, content, overpriced_score, tech_complexity, ai_replaceability, moat_assessment } = body
    
    if (!deal_id || !author || !content) {
      return c.json({ 
        success: false, 
        error: 'Missing required fields: deal_id, author, content' 
      }, 400)
    }
    
    // Validate scores are in range 1-10
    const scores = [overpriced_score, tech_complexity, ai_replaceability, moat_assessment]
    for (const score of scores) {
      if (score !== undefined && (score < 1 || score > 10)) {
        return c.json({ 
          success: false, 
          error: 'Scores must be between 1 and 10' 
        }, 400)
      }
    }
    
    // Check deal exists
    const deal = await db.prepare('SELECT id FROM deals WHERE id = ?').bind(deal_id).first()
    if (!deal) {
      return c.json({ success: false, error: 'Deal not found' }, 404)
    }
    
    // Insert analysis
    const result = await db.prepare(`
      INSERT INTO analyses (deal_id, author, content, overpriced_score, tech_complexity, ai_replaceability, moat_assessment)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      deal_id,
      author,
      content,
      overpriced_score ?? null,
      tech_complexity ?? null,
      ai_replaceability ?? null,
      moat_assessment ?? null
    ).run()
    
    // Return the created analysis
    const created = await db.prepare('SELECT * FROM analyses WHERE id = ?').bind(result.meta.last_row_id).first()
    
    return c.json({ 
      success: true,
      data: created
    }, 201)
  } catch (error) {
    console.error('Failed to create analysis:', error)
    return c.json({ 
      success: false,
      error: 'Failed to create analysis' 
    }, 500)
  }
})

app.get('/api/v1/challenges', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(
      `SELECT * FROM challenges ORDER BY week_number DESC, starts_at DESC`
    ).all()
    
    return c.json({ 
      success: true,
      data: results 
    })
  } catch (error) {
    return c.json({ 
      success: false,
      error: 'Failed to fetch challenges' 
    }, 500)
  }
})

// RSS Feed: latest deals in RSS 2.0 format
app.get('/feed.xml', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(
      `SELECT * FROM deals ORDER BY created_at DESC LIMIT 50`
    ).all() as { results: Array<{
      id: number
      company: string
      round: string
      amount_usd: number
      source_url: string | null
      created_at: string
    }> }
    
    const escapeXml = (str: string) => str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;')
    
    const formatAmount = (amount: number) => {
      if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
      if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
      if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
      return `$${amount}`
    }
    
    const items = (results || []).map((deal) => `
    <item>
      <title>${escapeXml(deal.company)} raises ${formatAmount(deal.amount_usd)} (${escapeXml(deal.round)})</title>
      <link>https://overpriseed.d1.sh/#deal-${deal.id}</link>
      <guid isPermaLink="false">deal-${deal.id}</guid>
      <pubDate>${new Date(deal.created_at).toUTCString()}</pubDate>
      <description>${escapeXml(deal.company)} closed a ${escapeXml(deal.round)} round of ${formatAmount(deal.amount_usd)}.</description>
    </item>`).join('')
    
    const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Overpriseed - Latest Startup Funding Deals</title>
    <link>https://overpriseed.d1.sh</link>
    <description>Exposing overvalued startup deals. AI-first analysis of tech funding rounds.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="https://overpriseed.d1.sh/feed.xml" rel="self" type="application/rss+xml"/>${items}
  </channel>
</rss>`
    
    return c.body(rss, 200, {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600'
    })
  } catch (error) {
    console.error('Failed to generate RSS feed:', error)
    return c.text('Failed to generate feed', 500)
  }
})

// Industry distribution stats
app.get('/api/v1/stats/industries', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(`
      SELECT 
        COALESCE(industry, 'Other') as industry,
        COUNT(*) as count,
        SUM(amount_usd) as total_funding
      FROM deals
      GROUP BY COALESCE(industry, 'Other')
      ORDER BY count DESC
    `).all()
    
    return c.json({ 
      success: true,
      data: results 
    })
  } catch (error) {
    console.error('Failed to fetch industry stats:', error)
    return c.json({ 
      success: false,
      error: 'Failed to fetch industry stats' 
    }, 500)
  }
})

// ============================================
// MCP (Model Context Protocol) Endpoints
// Agent-native interface for AI assistants
// ============================================

// Rate limit for MCP endpoints
app.use('/mcp/*', async (c, next) => {
  cleanupRateLimitStore()
  
  const key = `mcp:${getRateLimitKey(c)}`
  const now = Date.now()
  const mcpLimit = 120 // Higher limit for MCP (AI agents may batch requests)
  
  let record = rateLimitStore.get(key)
  
  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + RATE_LIMIT.windowMs }
    rateLimitStore.set(key, record)
  } else {
    record.count++
  }
  
  c.header('X-RateLimit-Limit', String(mcpLimit))
  c.header('X-RateLimit-Remaining', String(Math.max(0, mcpLimit - record.count)))
  c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)))
  
  if (record.count > mcpLimit) {
    return c.json({
      error: 'Rate limit exceeded',
      retry_after: Math.ceil((record.resetAt - now) / 1000)
    }, 429)
  }
  
  await next()
})

// MCP Manifest - describes capabilities for AI agents
app.get('/mcp/manifest', (c) => {
  return c.json({
    name: "overpriseed",
    version: "2.0.0",
    description: "AI-first analysis platform for evaluating startup funding deals. Helps agents understand what startups do, estimate replication effort, and assess overvaluation risk.",
    capabilities: {
      deals: {
        list: "GET /mcp/deals - List all analyzed startup deals",
        get: "GET /mcp/deals/:id - Get detailed analysis of a specific deal",
        search: "GET /mcp/deals?q=search_term - Search deals by company name"
      },
      analysis: {
        fields: [
          "description - What the company does",
          "target_users - Who uses this product",
          "core_features - Main product features (JSON array)",
          "tech_stack - Technologies needed to build (JSON object)",
          "mvp_effort_days - Person-days to build MVP",
          "ai_replaceability - How easily AI can replicate (1-10)",
          "moat_assessment - Competitive advantages"
        ]
      }
    },
    use_cases: [
      "Evaluate if a startup's valuation is justified",
      "Estimate effort to replicate a product",
      "Identify AI-vulnerable business models",
      "Research competitive landscape"
    ],
    rate_limits: {
      api_requests_per_minute: 60,
      mcp_requests_per_minute: 120,
      write_requests_per_minute: 10,
      note: "No authentication required. Rate limits per IP."
    }
  })
})

// MCP Deals List - structured for AI consumption
app.get('/mcp/deals', async (c) => {
  try {
    const db = c.env.DB
    const query = c.req.query('q')
    const analyzed_only = c.req.query('analyzed') === 'true'
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    
    let sql = `
      SELECT 
        id, company, round, amount_usd, industry,
        description, target_users, core_features, tech_stack,
        mvp_effort_days, ai_summary, website_url, source_url,
        created_at, analyzed_at
      FROM deals
      WHERE 1=1
    `
    const params: any[] = []
    
    if (query) {
      sql += ` AND company LIKE ?`
      params.push(`%${query}%`)
    }
    
    if (analyzed_only) {
      sql += ` AND ai_summary IS NOT NULL`
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ?`
    params.push(limit)
    
    const stmt = params.length > 0 
      ? db.prepare(sql).bind(...params)
      : db.prepare(sql)
    
    const { results } = await stmt.all()
    
    // Parse JSON fields
    const deals = (results || []).map((deal: any) => ({
      ...deal,
      core_features: deal.core_features ? JSON.parse(deal.core_features) : [],
      tech_stack: deal.tech_stack ? JSON.parse(deal.tech_stack) : {}
    }))
    
    return c.json({
      _mcp: {
        schema: "overpriseed/deals/v1",
        total: deals.length,
        hint: "Use /mcp/deals/:id for full analysis including community scores"
      },
      deals
    })
  } catch (error) {
    console.error('MCP deals error:', error)
    return c.json({ error: 'Failed to fetch deals' }, 500)
  }
})

// MCP Single Deal - complete analysis for AI agents
app.get('/mcp/deals/:id', async (c) => {
  try {
    const db = c.env.DB
    const id = c.req.param('id')
    
    // Get deal with all fields
    const deal = await db.prepare(`
      SELECT 
        id, company, round, amount_usd, industry,
        description, target_users, core_features, tech_stack,
        mvp_effort_days, ai_summary, website_url, source_url,
        created_at, analyzed_at
      FROM deals WHERE id = ?
    `).bind(id).first() as any
    
    if (!deal) {
      return c.json({ error: 'Deal not found' }, 404)
    }
    
    // Get community analyses
    const { results: analyses } = await db.prepare(`
      SELECT 
        author, content, overpriced_score, tech_complexity,
        ai_replaceability, moat_assessment, created_at
      FROM analyses WHERE deal_id = ?
      ORDER BY created_at DESC
    `).bind(id).all()
    
    // Calculate aggregate scores
    const scores = (analyses || []).reduce((acc: any, a: any) => {
      if (a.overpriced_score) acc.overpriced.push(a.overpriced_score)
      if (a.tech_complexity) acc.tech_complexity.push(a.tech_complexity)
      if (a.ai_replaceability) acc.ai_replaceability.push(a.ai_replaceability)
      if (a.moat_assessment) acc.moat.push(a.moat_assessment)
      return acc
    }, { overpriced: [], tech_complexity: [], ai_replaceability: [], moat: [] })
    
    const avg = (arr: number[]) => arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 10) / 10 : null
    
    // Build replication guide
    const tech_stack = deal.tech_stack ? JSON.parse(deal.tech_stack) : {}
    const core_features = deal.core_features ? JSON.parse(deal.core_features) : []
    
    return c.json({
      _mcp: {
        schema: "overpriseed/deal/v1",
        hint: "Use this data to understand what the startup does and how to replicate it"
      },
      deal: {
        id: deal.id,
        company: deal.company,
        round: deal.round,
        amount_usd: deal.amount_usd,
        amount_formatted: formatAmount(deal.amount_usd),
        industry: deal.industry,
        website_url: deal.website_url,
        source_url: deal.source_url,
        created_at: deal.created_at
      },
      analysis: {
        description: deal.description,
        target_users: deal.target_users,
        core_features,
        ai_summary: deal.ai_summary,
        analyzed_at: deal.analyzed_at
      },
      replication_guide: {
        mvp_effort_days: deal.mvp_effort_days,
        tech_stack,
        estimated_team: deal.mvp_effort_days ? `${Math.ceil(deal.mvp_effort_days / 30)} engineers for ~1 month` : null
      },
      community_scores: {
        analysis_count: analyses?.length || 0,
        avg_overpriced: avg(scores.overpriced),
        avg_tech_complexity: avg(scores.tech_complexity),
        avg_ai_replaceability: avg(scores.ai_replaceability),
        avg_moat: avg(scores.moat)
      },
      community_analyses: analyses || []
    })
  } catch (error) {
    console.error('MCP deal error:', error)
    return c.json({ error: 'Failed to fetch deal' }, 500)
  }
})

// Helper function for amount formatting
function formatAmount(amount: number): string {
  if (!amount) return 'Undisclosed'
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(1)}M`
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`
  return `$${amount}`
}

// ============================================
// Original API Endpoints
// ============================================

// ============================================
// Challenge & Submission Endpoints
// ============================================

// Get active/current challenge
app.get('/api/v1/challenges/current', async (c) => {
  try {
    const db = c.env.DB
    
    // Get the most recent active challenge
    const challenge = await db.prepare(`
      SELECT c.*, d.company, d.round, d.amount_usd, d.industry,
             d.description, d.mvp_effort_days, d.ai_summary, d.tech_stack
      FROM challenges c
      JOIN deals d ON c.deal_id = d.id
      WHERE c.status = 'active'
      ORDER BY c.week_number DESC
      LIMIT 1
    `).first() as any
    
    if (!challenge) {
      return c.json({ success: true, data: null })
    }
    
    // Get submissions for this challenge
    const { results: submissions } = await db.prepare(`
      SELECT * FROM submissions 
      WHERE challenge_id = ?
      ORDER BY votes DESC, created_at ASC
    `).bind(challenge.id).all()
    
    // Parse tech_stack if exists
    if (challenge.tech_stack) {
      try { challenge.tech_stack = JSON.parse(challenge.tech_stack) } catch (e) { challenge.tech_stack = {} }
    }
    
    return c.json({
      success: true,
      data: {
        ...challenge,
        submissions: submissions || []
      }
    })
  } catch (error) {
    console.error('Failed to fetch current challenge:', error)
    return c.json({ success: false, error: 'Failed to fetch current challenge' }, 500)
  }
})

// Get challenge by ID with submissions
app.get('/api/v1/challenges/:id', async (c) => {
  try {
    const db = c.env.DB
    const id = c.req.param('id')
    
    const challenge = await db.prepare(`
      SELECT c.*, d.company, d.round, d.amount_usd, d.industry,
             d.description, d.mvp_effort_days, d.ai_summary, d.tech_stack
      FROM challenges c
      JOIN deals d ON c.deal_id = d.id
      WHERE c.id = ?
    `).bind(id).first() as any
    
    if (!challenge) {
      return c.json({ success: false, error: 'Challenge not found' }, 404)
    }
    
    // Get submissions
    const { results: submissions } = await db.prepare(`
      SELECT * FROM submissions 
      WHERE challenge_id = ?
      ORDER BY votes DESC, created_at ASC
    `).bind(id).all()
    
    // Parse tech_stack
    if (challenge.tech_stack) {
      try { challenge.tech_stack = JSON.parse(challenge.tech_stack) } catch (e) { challenge.tech_stack = {} }
    }
    
    return c.json({
      success: true,
      data: {
        ...challenge,
        submissions: submissions || []
      }
    })
  } catch (error) {
    console.error('Failed to fetch challenge:', error)
    return c.json({ success: false, error: 'Failed to fetch challenge' }, 500)
  }
})

// Submit an MVP to a challenge
app.post('/api/v1/submissions', async (c) => {
  try {
    const db = c.env.DB
    const body = await c.req.json()
    
    const { challenge_id, author, repo_url, demo_url, description, completion_days, team_size, tech_stack } = body
    
    // Validate required fields
    if (!challenge_id || !author || !repo_url || !description) {
      return c.json({
        success: false,
        error: 'Missing required fields: challenge_id, author, repo_url, description'
      }, 400)
    }
    
    // Validate optional numeric fields
    if (completion_days !== undefined && (completion_days < 1 || completion_days > 365)) {
      return c.json({ success: false, error: 'completion_days must be between 1 and 365' }, 400)
    }
    if (team_size !== undefined && (team_size < 1 || team_size > 100)) {
      return c.json({ success: false, error: 'team_size must be between 1 and 100' }, 400)
    }
    
    // Check challenge exists and is active
    const challenge = await db.prepare(
      'SELECT id, status FROM challenges WHERE id = ?'
    ).bind(challenge_id).first() as any
    
    if (!challenge) {
      return c.json({ success: false, error: 'Challenge not found' }, 404)
    }
    
    if (challenge.status !== 'active') {
      return c.json({ success: false, error: 'Challenge is not active' }, 400)
    }
    
    // Check if author already submitted to this challenge
    const existing = await db.prepare(
      'SELECT id FROM submissions WHERE challenge_id = ? AND author = ?'
    ).bind(challenge_id, author).first()
    
    if (existing) {
      return c.json({ success: false, error: 'You already submitted to this challenge' }, 400)
    }
    
    // Insert submission with cost tracking fields
    const result = await db.prepare(`
      INSERT INTO submissions (challenge_id, author, repo_url, demo_url, description, completion_days, team_size, tech_stack)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      challenge_id, 
      author, 
      repo_url, 
      demo_url || null, 
      description,
      completion_days || null,
      team_size || 1,
      tech_stack || null
    ).run()
    
    const created = await db.prepare('SELECT * FROM submissions WHERE id = ?')
      .bind(result.meta.last_row_id).first()
    
    return c.json({ success: true, data: created }, 201)
  } catch (error) {
    console.error('Failed to create submission:', error)
    return c.json({ success: false, error: 'Failed to create submission' }, 500)
  }
})

// Get submissions for a challenge
app.get('/api/v1/submissions', async (c) => {
  try {
    const db = c.env.DB
    const challengeId = c.req.query('challenge_id')
    
    if (!challengeId) {
      return c.json({ success: false, error: 'challenge_id is required' }, 400)
    }
    
    const { results } = await db.prepare(`
      SELECT * FROM submissions 
      WHERE challenge_id = ?
      ORDER BY votes DESC, created_at ASC
    `).bind(challengeId).all()
    
    return c.json({ success: true, data: results || [] })
  } catch (error) {
    console.error('Failed to fetch submissions:', error)
    return c.json({ success: false, error: 'Failed to fetch submissions' }, 500)
  }
})

// Vote on a submission (simple increment, no auth)
app.post('/api/v1/submissions/:id/vote', async (c) => {
  try {
    const db = c.env.DB
    const id = c.req.param('id')
    
    // Check submission exists
    const submission = await db.prepare('SELECT id FROM submissions WHERE id = ?')
      .bind(id).first()
    
    if (!submission) {
      return c.json({ success: false, error: 'Submission not found' }, 404)
    }
    
    // Increment vote count
    await db.prepare('UPDATE submissions SET votes = votes + 1 WHERE id = ?')
      .bind(id).run()
    
    const updated = await db.prepare('SELECT * FROM submissions WHERE id = ?')
      .bind(id).first()
    
    return c.json({ success: true, data: updated })
  } catch (error) {
    console.error('Failed to vote:', error)
    return c.json({ success: false, error: 'Failed to vote' }, 500)
  }
})

// ============================================
// Leaderboard Endpoint
// ============================================

// Leaderboard: deals ranked by average overpriced score
app.get('/api/v1/leaderboard', async (c) => {
  try {
    const db = c.env.DB
    const { results } = await db.prepare(`
      SELECT 
        d.id,
        d.company,
        d.round,
        d.amount_usd,
        d.source_url,
        d.created_at,
        COUNT(a.id) as analysis_count,
        ROUND(AVG(a.overpriced_score), 1) as avg_overpriced,
        ROUND(AVG(a.tech_complexity), 1) as avg_tech_complexity,
        ROUND(AVG(a.ai_replaceability), 1) as avg_ai_replaceability,
        ROUND(AVG(a.moat_assessment), 1) as avg_moat
      FROM deals d
      LEFT JOIN analyses a ON d.id = a.deal_id
      GROUP BY d.id
      HAVING analysis_count > 0
      ORDER BY avg_overpriced DESC, analysis_count DESC
      LIMIT 20
    `).all()
    
    return c.json({ 
      success: true,
      data: results 
    })
  } catch (error) {
    console.error('Failed to fetch leaderboard:', error)
    return c.json({ 
      success: false,
      error: 'Failed to fetch leaderboard' 
    }, 500)
  }
})

export default app