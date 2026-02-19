import { Router } from 'express'
import crypto from 'crypto'
import pool from '../config/database.js'
import env from '../config/env.js'
import auth from '../middleware/auth.js'

const router = Router()

const PLANS = {
  monthly: { amount: 4990000, label: '$49.900/mes', days: 31 },
  yearly: { amount: 49000000, label: '$490.000/año', days: 366 },
}

function computeIsPro(negocio) {
  const now = new Date()
  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) return true
  if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) return true
  return false
}

// GET /api/wompi/config — public key + plan info
router.get('/config', auth, async (req, res) => {
  res.json({
    publicKey: env.wompiPublicKey,
    plans: {
      monthly: { amount: PLANS.monthly.amount, label: PLANS.monthly.label },
      yearly: { amount: PLANS.yearly.amount, label: PLANS.yearly.label },
    },
    currency: 'COP',
  })
})

// POST /api/wompi/create-payment-reference — generate reference + integrity hash
router.post('/create-payment-reference', auth, async (req, res) => {
  const { period } = req.body
  if (!period || !PLANS[period]) {
    return res.status(400).json({ error: 'Invalid period. Use "monthly" or "yearly".' })
  }

  const negocioId = req.user?.negocio_id
  if (!negocioId) return res.status(401).json({ error: 'No negocio' })

  const plan = PLANS[period]
  const reference = `MONACO_${negocioId}_${period}_${Date.now()}`
  const currency = 'COP'

  // Integrity hash: SHA256(reference + amount + currency + integrity_secret)
  const integrityString = `${reference}${plan.amount}${currency}${env.wompiIntegritySecret}`
  const integrityHash = crypto.createHash('sha256').update(integrityString).digest('hex')

  res.json({
    reference,
    amount: plan.amount,
    currency,
    integrityHash,
    publicKey: env.wompiPublicKey,
  })
})

// GET /api/wompi/status — computed plan status
router.get('/status', auth, async (req, res) => {
  const negocioId = req.user?.negocio_id
  if (!negocioId) return res.status(401).json({ error: 'No negocio' })

  const { rows } = await pool.query(
    'SELECT plan, trial_ends_at, subscription_expires_at, subscription_period FROM negocios WHERE id = $1',
    [negocioId]
  )
  const negocio = rows[0]
  if (!negocio) return res.status(404).json({ error: 'Negocio not found' })

  const now = new Date()
  let status = 'free'
  let isPro = false
  let daysLeftInTrial = null

  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) {
    isPro = true
    status = 'active'
  } else if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) {
    isPro = true
    status = 'trial'
    daysLeftInTrial = Math.ceil((new Date(negocio.trial_ends_at) - now) / 86400000)
  }

  const cancelled = negocio.plan === 'cancelled'

  const result = {
    plan: isPro ? 'pro' : 'free',
    status: cancelled && isPro ? 'cancelled' : status,
    cancelled,
    trialEndsAt: negocio.trial_ends_at,
    subscriptionExpiresAt: negocio.subscription_expires_at,
    subscriptionPeriod: negocio.subscription_period,
    daysLeftInTrial,
  }

  // Include limits if free
  if (!isPro) {
    const [lavadaCount, clienteCount] = await Promise.all([
      pool.query(
        `SELECT COUNT(*) FROM lavadas WHERE negocio_id = $1 AND fecha >= date_trunc('month', now())`,
        [negocioId]
      ),
      pool.query('SELECT COUNT(*) FROM clientes WHERE negocio_id = $1', [negocioId]),
    ])
    result.limits = {
      lavadas: { used: parseInt(lavadaCount.rows[0].count), max: 50 },
      clientes: { used: parseInt(clienteCount.rows[0].count), max: 30 },
    }
  }

  res.json(result)
})

// POST /api/wompi/start-trial — start/restart 14-day trial
router.post('/start-trial', auth, async (req, res) => {
  const negocioId = req.user?.negocio_id
  if (!negocioId) return res.status(401).json({ error: 'No negocio' })

  const { rows } = await pool.query(
    'SELECT trial_ends_at, subscription_expires_at FROM negocios WHERE id = $1',
    [negocioId]
  )
  const negocio = rows[0]
  if (!negocio) return res.status(404).json({ error: 'Negocio not found' })

  const now = new Date()

  // Can't start trial if subscription is active
  if (negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now) {
    return res.status(400).json({ error: 'Already has active subscription' })
  }

  // Can't start trial if trial is still active
  if (negocio.trial_ends_at && new Date(negocio.trial_ends_at) > now) {
    return res.status(400).json({ error: 'Trial is still active' })
  }

  await pool.query(
    "UPDATE negocios SET plan = 'pro', trial_ends_at = now() + INTERVAL '14 days' WHERE id = $1",
    [negocioId]
  )

  res.json({ success: true, trialEndsAt: new Date(Date.now() + 14 * 86400000) })
})

// POST /api/wompi/cancel — cancel subscription (keeps PRO until expiration)
router.post('/cancel', auth, async (req, res) => {
  try {
    const negocioId = req.user?.negocio_id
    if (!negocioId) return res.status(401).json({ error: 'No negocio' })

    const { rows } = await pool.query(
      'SELECT plan, trial_ends_at, subscription_expires_at FROM negocios WHERE id = $1',
      [negocioId]
    )
    const negocio = rows[0]
    if (!negocio) return res.status(404).json({ error: 'Negocio no encontrado' })

    const isPro = computeIsPro(negocio)
    if (!isPro) {
      return res.status(400).json({ error: 'No tienes una suscripción activa' })
    }

    // Mark as cancelled — set plan to 'free' but keep expiration dates
    // User stays PRO until the dates expire naturally
    await pool.query(
      "UPDATE negocios SET plan = 'cancelled' WHERE id = $1",
      [negocioId]
    )

    res.json({ success: true })
  } catch (err) {
    console.error('Cancel subscription error:', err)
    res.status(500).json({ error: 'Error al cancelar' })
  }
})

// Wompi sandbox/production base URL
const WOMPI_API = env.wompiPublicKey.startsWith('pub_test_')
  ? 'https://sandbox.wompi.co/v1'
  : 'https://production.wompi.co/v1'

// Helper: poll transaction status until it resolves or times out
async function pollTransactionStatus(transactionId, maxAttempts = 10, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delayMs))
    const res = await fetch(`${WOMPI_API}/transactions/${transactionId}`)
    const data = await res.json()
    const status = data.data?.status
    if (status && status !== 'PENDING') return data
  }
  return null // still pending after all attempts
}

// POST /api/wompi/pay — tokenize card + create transaction (with auth)
router.post('/pay', auth, async (req, res) => {
  try {
    const { period, card } = req.body
    if (!period || !PLANS[period]) {
      return res.status(400).json({ error: 'Período inválido' })
    }
    if (!card?.number || !card?.cvc || !card?.exp_month || !card?.exp_year || !card?.card_holder) {
      return res.status(400).json({ error: 'Datos de tarjeta incompletos' })
    }

    const negocioId = req.user?.negocio_id
    if (!negocioId) return res.status(401).json({ error: 'No negocio' })

    const plan = PLANS[period]
    const reference = `MONACO_${negocioId}_${period}_${Date.now()}`
    const currency = 'COP'

    // 1. Tokenize card with Wompi (public key)
    const tokenRes = await fetch(`${WOMPI_API}/tokens/cards`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.wompiPublicKey}`,
      },
      body: JSON.stringify({
        number: card.number,
        cvc: card.cvc,
        exp_month: card.exp_month,
        exp_year: card.exp_year,
        card_holder: card.card_holder,
      }),
    })
    const tokenData = await tokenRes.json()

    if (!tokenData.data?.id) {
      return res.json({ success: false, error: 'Error al tokenizar la tarjeta. Verifica los datos.' })
    }

    // 2. Get acceptance token
    const merchantRes = await fetch(`${WOMPI_API}/merchants/${env.wompiPublicKey}`)
    const merchantData = await merchantRes.json()
    const acceptanceToken = merchantData.data?.presigned_acceptance?.acceptance_token

    // 3. Compute integrity hash
    const integrityString = `${reference}${plan.amount}${currency}${env.wompiIntegritySecret}`
    const integrityHash = crypto.createHash('sha256').update(integrityString).digest('hex')

    // 4. Create transaction with Wompi (private key)
    const txRes = await fetch(`${WOMPI_API}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.wompiPrivateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: plan.amount,
        currency,
        customer_email: req.user.email,
        reference,
        signature: integrityHash,
        acceptance_token: acceptanceToken,
        payment_method: {
          type: 'CARD',
          token: tokenData.data.id,
          installments: 1,
        },
      }),
    })
    const txData = await txRes.json()

    const transactionId = txData.data?.id
    let finalStatus = txData.data?.status

    // 5. If PENDING, poll until resolved (Wompi processes async)
    if (finalStatus === 'PENDING' && transactionId) {
      const polledData = await pollTransactionStatus(transactionId)
      if (polledData?.data?.status) {
        finalStatus = polledData.data.status
      }
    }

    if (finalStatus === 'APPROVED') {
      // Payment approved — activate subscription
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + plan.days)

      await pool.query(
        `UPDATE negocios SET plan = 'pro', subscription_expires_at = $2, subscription_period = $3 WHERE id = $1`,
        [negocioId, expiresAt, period]
      )

      await pool.query(
        `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi, periodo_desde, periodo_hasta)
         VALUES ($1, $2, $3, $4, $5, 'APPROVED', $6, $7, CURRENT_DATE, $8)
         ON CONFLICT (wompi_transaction_id) DO UPDATE SET estado = 'APPROVED', periodo_desde = CURRENT_DATE, periodo_hasta = $8`,
        [negocioId, transactionId, reference, plan.amount, currency, period, JSON.stringify(txData.data), expiresAt]
      )

      return res.json({ success: true, status: 'APPROVED' })
    }

    if (finalStatus === 'DECLINED' || finalStatus === 'ERROR' || finalStatus === 'VOIDED') {
      const declineReason = txData.data?.status_message || 'Pago rechazado por el banco'
      return res.json({ success: false, error: declineReason })
    }

    // Still PENDING after polling — record and notify
    if (transactionId) {
      await pool.query(
        `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi)
         VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
         ON CONFLICT (wompi_transaction_id) DO NOTHING`,
        [negocioId, transactionId, reference, plan.amount, currency, period, JSON.stringify(txData.data)]
      )
    }
    return res.json({ success: false, error: 'El pago está siendo procesado. Esto puede tomar unos segundos. Intenta recargar la página en un momento.' })
  } catch (err) {
    console.error('Wompi pay error:', err)
    res.json({ success: false, error: 'Error al procesar el pago' })
  }
})

// POST /api/wompi/webhook — Wompi event webhook (NO auth)
router.post('/webhook', async (req, res) => {
  try {
    const event = req.body

    if (!event?.data?.transaction) {
      return res.status(200).json({ received: true })
    }

    const tx = event.data.transaction
    const timestamp = event.timestamp
    const signature = event.signature?.checksum

    // Verify signature
    if (env.wompiEventsSecret && signature) {
      const signString = `${tx.id}${tx.status}${tx.amount_in_cents}${tx.currency}${timestamp}${env.wompiEventsSecret}`
      const expectedSig = crypto.createHash('sha256').update(signString).digest('hex')
      if (signature !== expectedSig) {
        console.warn('Wompi webhook signature mismatch')
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    // Parse reference: MONACO_{negocioId}_{period}_{timestamp}
    const reference = tx.reference || ''
    const refMatch = reference.match(/^MONACO_([0-9a-f-]{36})_(monthly|yearly)_(\d+)$/)
    if (!refMatch) {
      return res.status(200).json({ received: true, ignored: true })
    }

    const negocioId = refMatch[1]
    const period = refMatch[2]

    // Record payment
    await pool.query(
      `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (wompi_transaction_id) DO UPDATE SET estado = $6, datos_wompi = $8, updated_at = now()`,
      [negocioId, tx.id, reference, tx.amount_in_cents, tx.currency, tx.status, period, JSON.stringify(tx)]
    )

    // If approved, activate subscription
    if (tx.status === 'APPROVED') {
      const plan = PLANS[period]
      if (!plan) {
        console.warn('Unknown period in Wompi reference:', period)
        return res.status(200).json({ received: true })
      }

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + plan.days)

      await pool.query(
        `UPDATE negocios SET plan = 'pro', subscription_expires_at = $2, subscription_period = $3 WHERE id = $1`,
        [negocioId, expiresAt, period]
      )

      // Update payment record with period dates
      await pool.query(
        `UPDATE pagos_suscripcion SET periodo_desde = CURRENT_DATE, periodo_hasta = $2 WHERE wompi_transaction_id = $1`,
        [tx.id, expiresAt]
      )
    }

    res.status(200).json({ received: true })
  } catch (err) {
    console.error('Wompi webhook error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router
