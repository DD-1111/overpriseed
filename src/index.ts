import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { indexHtml } from './html'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

// Serve frontend
app.get('/', (c) => {
  return c.html(indexHtml)
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
    
    // Get deal
    const deal = await db.prepare(
      `SELECT * FROM deals WHERE id = ?`
    ).bind(id).first()
    
    if (!deal) {
      return c.json({ success: false, error: 'Deal not found' }, 404)
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