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

export default app