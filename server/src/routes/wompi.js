import { Router } from 'express'
import crypto from 'crypto'
import pool from '../config/database.js'
import env from '../config/env.js'
import auth from '../middleware/auth.js'
import logger from '../config/logger.js'

const router = Router()

// Wompi sandbox/production base URL
const WOMPI_API = env.wompiPublicKey.startsWith('pub_test_')
  ? 'https://sandbox.wompi.co/v1'
  : 'https://production.wompi.co/v1'

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

// GET /api/wompi/pse-banks — list PSE financial institutions (no auth)
router.get('/pse-banks', async (_req, res) => {
  try {
    const banksRes = await fetch(`${WOMPI_API}/pse/financial_institutions`, {
      headers: { Authorization: `Bearer ${env.wompiPublicKey}` },
    })
    if (!banksRes.ok) {
      return res.status(502).json({ error: 'Error al obtener bancos PSE' })
    }
    const banksData = await banksRes.json()
    res.json(banksData.data || [])
  } catch (err) {
    logger.error('PSE banks error:', err)
    res.status(500).json({ error: 'Error al obtener bancos PSE' })
  }
})

// GET /api/wompi/check-transaction/:id — poll transaction status (with auth)
router.get('/check-transaction/:id', auth, async (req, res) => {
  try {
    const negocioId = req.user?.negocio_id
    if (!negocioId) return res.status(401).json({ error: 'No negocio' })

    const { rows } = await pool.query(
      'SELECT estado FROM pagos_suscripcion WHERE wompi_transaction_id = $1 AND negocio_id = $2',
      [req.params.id, negocioId]
    )
    if (!rows[0]) {
      // Transaction not found for this negocio — still pending or doesn't exist
      return res.json({ status: 'PENDING' })
    }
    res.json({ status: rows[0].estado })
  } catch (err) {
    logger.error('Check transaction error:', err)
    res.status(500).json({ error: 'Error al verificar transacción' })
  }
})

// POST /api/wompi/create-payment-reference — generate reference + integrity hash
router.post('/create-payment-reference', auth, async (req, res) => {
  try {
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
  } catch (err) {
    logger.error('Create payment reference error:', err)
    res.status(500).json({ error: 'Error al crear referencia de pago' })
  }
})

// GET /api/wompi/status — computed plan status
router.get('/status', auth, async (req, res) => {
  try {
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
  } catch (err) {
    logger.error('Wompi status error:', err)
    res.status(500).json({ error: 'Error al obtener estado de suscripción' })
  }
})

// POST /api/wompi/start-trial — start/restart 14-day trial
router.post('/start-trial', auth, async (req, res) => {
  try {
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
  } catch (err) {
    logger.error('Start trial error:', err)
    res.status(500).json({ error: 'Error al iniciar período de prueba' })
  }
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
    logger.error('Cancel subscription error:', err)
    res.status(500).json({ error: 'Error al cancelar' })
  }
})

// Helper: poll transaction status until it resolves or times out
async function pollTransactionStatus(transactionId, maxAttempts = 10, delayMs = 2000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delayMs))
    const res = await fetch(`${WOMPI_API}/transactions/${transactionId}`)
    if (!res.ok) continue
    const data = await res.json()
    const status = data.data?.status
    if (status && status !== 'PENDING') return data
  }
  return null // still pending after all attempts
}

// POST /api/wompi/pay — create transaction: CARD (tokenize+pay), PSE (redirect), NEQUI (push)
router.post('/pay', auth, async (req, res) => {
  try {
    const { period, method = 'CARD', card, pse, nequi } = req.body
    if (!period || !PLANS[period]) {
      return res.status(400).json({ error: 'Período inválido' })
    }

    // Validate per method
    if (method === 'CARD') {
      if (!card?.number || !card?.cvc || !card?.exp_month || !card?.exp_year || !card?.card_holder) {
        return res.status(400).json({ error: 'Datos de tarjeta incompletos' })
      }
    } else if (method === 'PSE') {
      if (!pse?.financial_institution_code || ![0, 1].includes(Number(pse?.user_type)) || !pse?.user_legal_id_type || !pse?.user_legal_id) {
        return res.status(400).json({ error: 'Datos de PSE incompletos' })
      }
    } else if (method === 'NEQUI') {
      if (!nequi?.phone_number || !/^\d{10}$/.test(nequi.phone_number)) {
        return res.status(400).json({ error: 'Número de Nequi inválido (10 dígitos)' })
      }
    } else {
      return res.status(400).json({ error: 'Método de pago inválido' })
    }

    const negocioId = req.user?.negocio_id
    if (!negocioId) return res.status(401).json({ error: 'No negocio' })

    const plan = PLANS[period]
    const reference = `MONACO_${negocioId}_${period}_${Date.now()}`
    const currency = 'COP'

    // 1. Get acceptance token
    const merchantRes = await fetch(`${WOMPI_API}/merchants/${env.wompiPublicKey}`)
    if (!merchantRes.ok) {
      return res.json({ success: false, error: 'Error al obtener configuración del comercio' })
    }
    const merchantData = await merchantRes.json()
    const acceptanceToken = merchantData.data?.presigned_acceptance?.acceptance_token
    if (!acceptanceToken) {
      return res.json({ success: false, error: 'No se pudo obtener el token de aceptación del comercio' })
    }

    // 2. Compute integrity hash
    const integrityString = `${reference}${plan.amount}${currency}${env.wompiIntegritySecret}`
    const integrityHash = crypto.createHash('sha256').update(integrityString).digest('hex')

    // 3. Build payment_method per type
    let paymentMethod
    const txBodyExtra = {}

    if (method === 'CARD') {
      // Tokenize card
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
      if (!tokenRes.ok) {
        return res.json({ success: false, error: 'Error al comunicarse con el procesador de pagos (tokenización)' })
      }
      const tokenData = await tokenRes.json()
      if (!tokenData.data?.id) {
        return res.json({ success: false, error: 'Error al tokenizar la tarjeta. Verifica los datos.' })
      }
      paymentMethod = { type: 'CARD', token: tokenData.data.id, installments: 1 }

    } else if (method === 'PSE') {
      paymentMethod = {
        type: 'PSE',
        user_type: pse.user_type, // 0 = natural, 1 = jurídica
        user_legal_id_type: pse.user_legal_id_type,
        user_legal_id: pse.user_legal_id,
        financial_institution_code: pse.financial_institution_code,
        payment_description: `Monaco PRO ${period}`,
      }
      // PSE requires redirect_url — use configured frontend URL (never trust headers)
      txBodyExtra.redirect_url = `${env.frontendUrl}/cuenta?tab=plan&pse_return=1`

    } else if (method === 'NEQUI') {
      paymentMethod = {
        type: 'NEQUI',
        phone_number: nequi.phone_number,
      }
    }

    // 4. Create transaction with Wompi
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
        payment_method: paymentMethod,
        ...txBodyExtra,
      }),
    })
    if (!txRes.ok) {
      return res.json({ success: false, error: 'Error al crear la transacción con el procesador de pagos' })
    }
    const txData = await txRes.json()

    const transactionId = txData.data?.id
    let finalStatus = txData.data?.status

    // 5. For PSE and NEQUI: do NOT poll — return PENDING immediately
    if (method === 'PSE' || method === 'NEQUI') {
      if (transactionId) {
        await pool.query(
          `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi)
           VALUES ($1, $2, $3, $4, $5, 'PENDING', $6, $7)
           ON CONFLICT (wompi_transaction_id) DO NOTHING`,
          [negocioId, transactionId, reference, plan.amount, currency, period, JSON.stringify(txData.data)]
        )
      }

      const result = { success: true, status: 'PENDING', method, transactionId }
      if (method === 'PSE') {
        // Wompi returns the bank redirect URL in the payment_method
        result.redirectUrl = txData.data?.payment_method?.extra?.async_payment_url
      }
      return res.json(result)
    }

    // 6. CARD flow: poll if PENDING
    if (finalStatus === 'PENDING' && transactionId) {
      const polledData = await pollTransactionStatus(transactionId)
      if (polledData?.data?.status) {
        finalStatus = polledData.data.status
      }
    }

    if (finalStatus === 'APPROVED') {
      // Extend from MAX(subscription_expires_at, now()) so user doesn't lose remaining days
      const { rows: negRows } = await pool.query(
        'SELECT subscription_expires_at FROM negocios WHERE id = $1',
        [negocioId]
      )
      const now = new Date()
      const currentExpiry = negRows[0]?.subscription_expires_at
      const baseDate = currentExpiry && new Date(currentExpiry) > now
        ? new Date(currentExpiry)
        : now
      const expiresAt = new Date(baseDate)
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
    logger.error('Wompi pay error:', err)
    res.json({ success: false, error: 'Error al procesar el pago' })
  }
})

// POST /api/wompi/public-pay — public checkout (NO auth, pay first)
router.post('/public-pay', async (req, res) => {
  try {
    const { email, period, card } = req.body
    if (!email || !period || !PLANS[period]) {
      return res.status(400).json({ success: false, error: 'Datos incompletos' })
    }
    if (!card?.number || !card?.cvc || !card?.exp_month || !card?.exp_year || !card?.card_holder) {
      return res.status(400).json({ success: false, error: 'Datos de tarjeta incompletos' })
    }

    const plan = PLANS[period]
    const currency = 'COP'

    // 1. Insert checkout_payments row to get UUID
    const { rows: checkoutRows } = await pool.query(
      `INSERT INTO checkout_payments (customer_email, periodo, wompi_reference, monto)
       VALUES ($1, $2, 'PENDING', $3) RETURNING id`,
      [email.toLowerCase(), period, plan.amount]
    )
    const checkoutId = checkoutRows[0].id
    const reference = `CHECKOUT_${checkoutId}_${period}_${Date.now()}`

    // Update reference now that we have the UUID
    await pool.query(
      'UPDATE checkout_payments SET wompi_reference = $1 WHERE id = $2',
      [reference, checkoutId]
    )

    // 2. Tokenize card
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
    if (!tokenRes.ok) {
      return res.json({ success: false, error: 'Error al comunicarse con el procesador de pagos (tokenización)' })
    }
    const tokenData = await tokenRes.json()
    if (!tokenData.data?.id) {
      return res.json({ success: false, error: 'Error al tokenizar la tarjeta. Verifica los datos.' })
    }

    // 3. Get acceptance token
    const merchantRes = await fetch(`${WOMPI_API}/merchants/${env.wompiPublicKey}`)
    if (!merchantRes.ok) {
      return res.json({ success: false, error: 'Error al obtener configuración del comercio' })
    }
    const merchantData = await merchantRes.json()
    const acceptanceToken = merchantData.data?.presigned_acceptance?.acceptance_token
    if (!acceptanceToken) {
      return res.json({ success: false, error: 'No se pudo obtener el token de aceptación del comercio' })
    }

    // 4. Compute integrity hash
    const integrityString = `${reference}${plan.amount}${currency}${env.wompiIntegritySecret}`
    const integrityHash = crypto.createHash('sha256').update(integrityString).digest('hex')

    // 5. Create transaction
    const txRes = await fetch(`${WOMPI_API}/transactions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.wompiPrivateKey}`,
      },
      body: JSON.stringify({
        amount_in_cents: plan.amount,
        currency,
        customer_email: email.toLowerCase(),
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
    if (!txRes.ok) {
      return res.json({ success: false, error: 'Error al crear la transacción con el procesador de pagos' })
    }
    const txData = await txRes.json()

    const transactionId = txData.data?.id
    let finalStatus = txData.data?.status

    // 6. If PENDING, poll until resolved
    if (finalStatus === 'PENDING' && transactionId) {
      const polledData = await pollTransactionStatus(transactionId)
      if (polledData?.data?.status) {
        finalStatus = polledData.data.status
      }
    }

    // 7. Update checkout_payments with result
    await pool.query(
      `UPDATE checkout_payments SET wompi_transaction_id = $1, estado = $2, datos_wompi = $3 WHERE id = $4`,
      [transactionId, finalStatus || 'PENDING', JSON.stringify(txData.data), checkoutId]
    )

    if (finalStatus === 'APPROVED') {
      return res.json({ success: true, checkoutId })
    }

    if (finalStatus === 'DECLINED' || finalStatus === 'ERROR' || finalStatus === 'VOIDED') {
      const declineReason = txData.data?.status_message || 'Pago rechazado por el banco'
      return res.json({ success: false, error: declineReason })
    }

    // Still PENDING after polling
    return res.json({ success: false, error: 'Tu pago está siendo procesado. Esto puede tardar unos segundos. Intenta de nuevo en un momento.' })
  } catch (err) {
    logger.error('Wompi public-pay error:', err)
    res.json({ success: false, error: 'Error al procesar el pago' })
  }
})

// POST /api/wompi/claim-checkout — claim an approved checkout (WITH auth)
router.post('/claim-checkout', auth, async (req, res) => {
  try {
    const { checkoutId } = req.body
    if (!checkoutId) {
      return res.status(400).json({ success: false, error: 'checkoutId es requerido' })
    }

    const negocioId = req.user?.negocio_id
    if (!negocioId) {
      return res.status(401).json({ success: false, error: 'No tienes un negocio asociado' })
    }

    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Lock and fetch the checkout
      const { rows: checkoutRows } = await client.query(
        `SELECT * FROM checkout_payments WHERE id = $1 FOR UPDATE`,
        [checkoutId]
      )
      const checkout = checkoutRows[0]

      if (!checkout) {
        await client.query('ROLLBACK')
        return res.status(404).json({ success: false, error: 'Checkout no encontrado' })
      }
      if (checkout.estado !== 'APPROVED') {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, error: 'Este pago no fue aprobado' })
      }
      if (checkout.claimed_at) {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, error: 'Este pago ya fue utilizado' })
      }

      // Calculate subscription period
      const period = checkout.periodo
      const plan = PLANS[period]
      if (!plan) {
        await client.query('ROLLBACK')
        return res.status(400).json({ success: false, error: 'Período inválido en el checkout' })
      }

      // Get current negocio to check existing subscription
      const { rows: negocioRows } = await client.query(
        'SELECT subscription_expires_at FROM negocios WHERE id = $1 FOR UPDATE',
        [negocioId]
      )
      const negocio = negocioRows[0]
      if (!negocio) {
        await client.query('ROLLBACK')
        return res.status(404).json({ success: false, error: 'Negocio no encontrado' })
      }

      // Extend from MAX(subscription_expires_at, now())
      const now = new Date()
      const baseDate = negocio.subscription_expires_at && new Date(negocio.subscription_expires_at) > now
        ? new Date(negocio.subscription_expires_at)
        : now
      const expiresAt = new Date(baseDate)
      expiresAt.setDate(expiresAt.getDate() + plan.days)

      // Activate subscription
      await client.query(
        `UPDATE negocios SET plan = 'pro', subscription_expires_at = $2, subscription_period = $3 WHERE id = $1`,
        [negocioId, expiresAt, period]
      )

      // Record in pagos_suscripcion
      await client.query(
        `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi, periodo_desde, periodo_hasta)
         VALUES ($1, $2, $3, $4, 'COP', 'APPROVED', $5, $6, CURRENT_DATE, $7)
         ON CONFLICT (wompi_transaction_id) DO UPDATE SET estado = 'APPROVED', negocio_id = $1, periodo_desde = CURRENT_DATE, periodo_hasta = $7`,
        [negocioId, checkout.wompi_transaction_id, checkout.wompi_reference, checkout.monto, period, checkout.datos_wompi, expiresAt]
      )

      // Mark checkout as claimed
      await client.query(
        'UPDATE checkout_payments SET claimed_at = now(), negocio_id = $1 WHERE id = $2',
        [negocioId, checkoutId]
      )

      await client.query('COMMIT')
      res.json({ success: true })
    } catch (e) {
      await client.query('ROLLBACK')
      throw e
    } finally {
      client.release()
    }
  } catch (err) {
    logger.error('Wompi claim-checkout error:', err)
    res.status(500).json({ success: false, error: 'Error al reclamar el pago' })
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

    // Verify signature — always required
    if (!env.wompiEventsSecret || !signature) {
      return res.status(401).json({ error: 'Missing webhook signature or events secret' })
    }
    const signString = `${tx.id}${tx.status}${tx.amount_in_cents}${tx.currency}${timestamp}${env.wompiEventsSecret}`
    const expectedSig = crypto.createHash('sha256').update(signString).digest('hex')
    if (signature !== expectedSig) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    // Parse reference: MONACO_{negocioId}_{period}_{timestamp} or CHECKOUT_{checkoutId}_{period}_{timestamp}
    const reference = tx.reference || ''
    const monacoMatch = reference.match(/^MONACO_([0-9a-f-]{36})_(monthly|yearly)_(\d+)$/)
    const checkoutMatch = reference.match(/^CHECKOUT_([0-9a-f-]{36})_(monthly|yearly)_(\d+)$/)

    if (!monacoMatch && !checkoutMatch) {
      return res.status(200).json({ received: true, ignored: true })
    }

    // Handle CHECKOUT_ references — update checkout_payments, do NOT activate subscription
    if (checkoutMatch) {
      const checkoutId = checkoutMatch[1]
      await pool.query(
        `UPDATE checkout_payments SET estado = $1, datos_wompi = $2 WHERE id = $3`,
        [tx.status, JSON.stringify(tx), checkoutId]
      )
      return res.status(200).json({ received: true })
    }

    // Handle MONACO_ references (existing flow)
    const negocioId = monacoMatch[1]
    const period = monacoMatch[2]

    // Record payment
    await pool.query(
      `INSERT INTO pagos_suscripcion (negocio_id, wompi_transaction_id, wompi_reference, monto, moneda, estado, periodo, datos_wompi)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (wompi_transaction_id) DO UPDATE SET estado = $6, datos_wompi = $8, updated_at = now()`,
      [negocioId, tx.id, reference, tx.amount_in_cents, tx.currency, tx.status, period, JSON.stringify(tx)]
    )

    // If approved, activate subscription — only if not already activated by /pay
    // Uses a transaction with FOR UPDATE to prevent race conditions from duplicate webhooks
    if (tx.status === 'APPROVED') {
      const plan = PLANS[period]
      if (!plan) {
        return res.status(200).json({ received: true })
      }

      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        // Lock the row to prevent concurrent webhook from reading stale state
        const { rows: existingPayment } = await client.query(
          `SELECT estado, periodo_desde FROM pagos_suscripcion WHERE wompi_transaction_id = $1 FOR UPDATE`,
          [tx.id]
        )
        const alreadyActivated = existingPayment[0]?.estado === 'APPROVED' && existingPayment[0]?.periodo_desde

        if (!alreadyActivated) {
          // Extend from MAX(subscription_expires_at, now()) so user doesn't lose remaining days
          const { rows: negRows } = await client.query(
            'SELECT subscription_expires_at FROM negocios WHERE id = $1 FOR UPDATE',
            [negocioId]
          )
          const now = new Date()
          const currentExpiry = negRows[0]?.subscription_expires_at
          const baseDate = currentExpiry && new Date(currentExpiry) > now
            ? new Date(currentExpiry)
            : now
          const expiresAt = new Date(baseDate)
          expiresAt.setDate(expiresAt.getDate() + plan.days)

          await client.query(
            `UPDATE negocios SET plan = 'pro', subscription_expires_at = $2, subscription_period = $3 WHERE id = $1`,
            [negocioId, expiresAt, period]
          )

          await client.query(
            `UPDATE pagos_suscripcion SET periodo_desde = CURRENT_DATE, periodo_hasta = $2 WHERE wompi_transaction_id = $1`,
            [tx.id, expiresAt]
          )
        }

        await client.query('COMMIT')
      } catch (e) {
        await client.query('ROLLBACK')
        throw e
      } finally {
        client.release()
      }
    }

    res.status(200).json({ received: true })
  } catch (err) {
    logger.error('Wompi webhook error:', err)
    res.status(500).json({ error: 'Internal error' })
  }
})

export default router
