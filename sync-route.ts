import { NextRequest, NextResponse } from 'next/server'
import { plaidClient } from '@/lib/plaid'
import { createClient } from '@/lib/supabase-server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

/**
 * WealthPath Sync Route - Phase 1
 * 1. Fetches transactions from ALL Plaid tokens
 * 2. AI categorizes each transaction
 * 3. Saves to categorized_transactions
 * 4. NEW: Auto-calculates financial_profiles from real data
 */

const CATEGORIZE_PROMPT = `You categorize bank transactions. For EACH transaction return a JSON object.

CATEGORY (cat):
- "income" - Payroll, direct deposits, refunds over $10, freelance, government benefits
- "need" - Rent, mortgage, groceries, gas, utilities, insurance, healthcare, pharmacy, phone, internet, car payment, childcare, education, loan payments, tolls
- "want" - Restaurants, coffee, fast food, entertainment, streaming (Netflix, Hulu, Prime Video, Spotify, Disney+), shopping, Amazon, subscriptions, gym, bars, clothing, hobbies, travel
- "savings" - Savings transfers, investment contributions, 401k, IRA
- "transfer" - Internal transfers, credit card payments, Zelle/Venmo/CashApp to self, ATM, "SAVE AS YOU GO"

BUDGET TYPE (btype):
- "non_discretionary" - Needs: rent, groceries, gas, insurance, utilities, healthcare, phone, internet, car payment
- "discretionary" - Wants: restaurants, coffee, entertainment, streaming, shopping, subscriptions, gym
- "savings" - Savings/investments
- null - Income and transfers only

EXPENSE TAG (tag): Payroll, Direct Deposit, Freelance, Refund, Groceries, Gas, Utilities, Rent/Mortgage, Insurance, Phone, Internet, Restaurant, Coffee, Fast Food, Delivery, Shopping, Amazon, Subscription, Entertainment, Gym, Clothing, Personal Care, Alcohol/Bar, Travel, Healthcare, Pharmacy, Car Payment, Car Repair, Childcare, Education, Loan Payment, Bank Fee, ATM/Cash, Transfer, CC Payment, Zelle, Venmo, Investment, Savings Transfer, Other

RULES:
- Negative Plaid amounts = money IN (income)
- Positive amounts = money OUT (expense)
- Streaming services = want/discretionary/Subscription
- Coffee shops = want/discretionary/Coffee
- Gas stations = need/non_discretionary/Gas
- Grocery stores = need/non_discretionary/Groceries

CONFIDENCE: high for known merchants, low ONLY if genuinely unrecognizable.
FLAG: true ONLY if genuinely cannot determine.

Return: [{"i":0,"cat":"want","sub":"Streaming","tag":"Subscription","btype":"discretionary","conf":"high","flag":false},...]
ONLY valid JSON array. No markdown.`

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profiles } = await supabase
      .from('financial_profiles')
      .select('plaid_access_token')
      .not('plaid_access_token', 'is', null)

    const tokens = (profiles || [])
      .map(p => p.plaid_access_token)
      .filter((t): t is string => !!t && !t.startsWith('access-sandbox'))

    if (tokens.length === 0) {
      return NextResponse.json({ error: 'No connected accounts.' }, { status: 400 })
    }

    const { data: exclusions } = await supabase.from('account_exclusions').select('account_plaid_id')
    const excludedIds = new Set((exclusions || []).map(e => e.account_plaid_id))

    const { data: dbAccounts } = await supabase.from('accounts').select('plaid_account_id, name, mask, type')
    const acctMap = new Map<string, { name: string; mask: string; type: string }>()
    for (const a of (dbAccounts || [])) {
      if (a.plaid_account_id) acctMap.set(a.plaid_account_id, { name: a.name, mask: a.mask || '', type: a.type })
    }

    let merchantRules = new Map<string, any>()
    try {
      const { data: rules } = await supabase.from('merchant_rules').select('*').eq('user_id', user.id)
      if (rules) { for (const r of rules) merchantRules.set(r.merchant_pattern.toLowerCase(), r) }
    } catch (e) {}

    const endDate = new Date().toISOString().split('T')[0]
    const startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    let allTransactions: any[] = []

    for (const token of tokens) {
      try {
        let offset = 0
        let total = 0
        do {
          const res = await plaidClient.transactionsGet({
            access_token: token, start_date: startDate, end_date: endDate,
            options: { count: 500, offset },
          })
          allTransactions = allTransactions.concat(res.data.transactions)
          total = res.data.total_transactions
          offset += res.data.transactions.length
        } while (offset < total && offset < 10000)
      } catch (e: any) { console.error('Token fetch error:', e.message) }
    }

    const filteredTx = allTransactions.filter(tx => !excludedIds.has(tx.account_id))
    const seen = new Set<string>()
    const uniqueTx = filteredTx.filter(tx => {
      if (seen.has(tx.transaction_id)) return false
      seen.add(tx.transaction_id)
      return true
    })

    if (uniqueTx.length === 0) {
      return NextResponse.json({ success: true, stats: { total: 0 } })
    }

    // Pre-categorize with merchant rules
    const needsAI: number[] = []
    const preCategorized = new Map<number, any>()
    uniqueTx.forEach((tx, i) => {
      const name = (tx.merchant_name || tx.name || '').toLowerCase().trim()
      let matched = false
      for (const [pattern, rule] of merchantRules) {
        if (name.includes(pattern) || pattern.includes(name)) {
          preCategorized.set(i, { i, cat: rule.category, sub: rule.subcategory || 'User Rule', tag: rule.expense_tag || null, btype: rule.budget_type || null, conf: 'high', flag: false })
          matched = true; break
        }
      }
      if (!matched) needsAI.push(i)
    })

    // AI categorize
    let allAiResults: any[] = [...preCategorized.values()]
    const aiTxs = needsAI.map(i => uniqueTx[i])
    for (let bIdx = 0; bIdx < aiTxs.length; bIdx += 150) {
      const batch = aiTxs.slice(bIdx, bIdx + 150).map((tx, bi) => ({
        i: needsAI[bIdx + bi], name: tx.merchant_name || tx.name, amount: tx.amount, date: tx.date,
      }))
      try {
        const aiRes = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 16000, system: CATEGORIZE_PROMPT,
          messages: [{ role: 'user', content: JSON.stringify(batch) }],
        })
        const text = aiRes.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('')
        allAiResults = allAiResults.concat(JSON.parse(text.replace(/```json|```/g, '').trim()))
      } catch (e) {
        allAiResults = allAiResults.concat(batch.map(tx => ({
          i: tx.i, cat: tx.amount < 0 ? 'income' : 'want', sub: 'Unknown',
          tag: tx.amount < 0 ? 'Direct Deposit' : 'Other', btype: tx.amount < 0 ? null : 'discretionary', conf: 'low', flag: true,
        })))
      }
    }

    // Build rows + save
    const aiMap = new Map<number, any>()
    for (const r of allAiResults) aiMap.set(r.i, r)

    const rows = uniqueTx.map((tx, i) => {
      const ai = aiMap.get(i)
      const acct = acctMap.get(tx.account_id)
      return {
        user_id: user.id, plaid_transaction_id: tx.transaction_id, transaction_date: tx.date,
        merchant_raw: tx.name || 'Unknown', merchant_clean: tx.merchant_name || tx.name || 'Unknown',
        amount: tx.amount, category: ai?.cat || 'want', subcategory: ai?.sub || 'Unknown',
        expense_tag: ai?.tag || null, budget_type: ai?.btype || null,
        confidence: ai?.conf || 'low', source: 'ai', needs_review: false, is_recurring: false,
        account_id: tx.account_id || null, account_name: acct ? acct.name : null,
      }
    })

    for (let i = 0; i < rows.length; i += 50) {
      await supabase.from('categorized_transactions').upsert(rows.slice(i, i + 50), {
        onConflict: 'user_id,plaid_transaction_id', ignoreDuplicates: false,
      })
    }

    // ═══════════════════════════════════════════════════════
    // PHASE 1 FIX: Auto-calculate financial_profiles
    // This makes the roadmap engine use REAL data
    // ═══════════════════════════════════════════════════════
    const now = new Date()
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    const lastOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

    const { data: monthTxs } = await supabase
      .from('categorized_transactions')
      .select('category, amount')
      .eq('user_id', user.id)
      .gte('transaction_date', firstOfMonth)
      .lte('transaction_date', lastOfMonth)

    let income = 0, needs = 0, wants = 0, savings = 0
    for (const tx of (monthTxs || [])) {
      const amt = Math.abs(tx.amount)
      switch (tx.category) {
        case 'income': income += amt; break
        case 'need': needs += amt; break
        case 'want': wants += amt; break
        case 'savings': savings += amt; break
      }
    }

    const surplus = income - needs - wants
    const needsPct = income > 0 ? Math.round((needs / income) * 100) : 0
    const wantsPct = income > 0 ? Math.round((wants / income) * 100) : 0
    const savingsPct = income > 0 ? Math.round((savings / income) * 100) : 0

    // Determine intensity level from architecture v4
    let intensityLevel = 'optimization'
    if (needs + wants > income || wantsPct > 40) {
      intensityLevel = 'fierce'
    } else if (wantsPct > 30 || needsPct > 50) {
      intensityLevel = 'focused'
    }

    // Update financial_profiles with REAL calculated data
    await supabase.from('financial_profiles').update({
      monthly_income: Math.round(income * 100) / 100,
      monthly_needs: Math.round(needs * 100) / 100,
      monthly_wants: Math.round(wants * 100) / 100,
      monthly_savings: Math.round(savings * 100) / 100,
      monthly_surplus: Math.round(surplus * 100) / 100,
      needs_pct: needsPct,
      wants_pct: wantsPct,
      savings_pct: savingsPct,
      intensity_level: intensityLevel,
      last_synced_at: new Date().toISOString(),
    }).eq('user_id', user.id)

    return NextResponse.json({
      success: true,
      stats: {
        total: rows.length, income: Math.round(income), needs: Math.round(needs),
        wants: Math.round(wants), savings: Math.round(savings), surplus: Math.round(surplus),
        needsPct, wantsPct, savingsPct, intensityLevel,
        needsReview: rows.filter(r => r.needs_review).length,
      },
    })
  } catch (error: any) {
    console.error('Sync error:', error)
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 })
  }
}
