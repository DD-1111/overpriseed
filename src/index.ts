import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
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