---
name: Multi-currency hardcoded COP remnants
description: Files that still use hardcoded '$' symbol or 'es-CO' locale for number formatting after multi-currency implementation
type: project
---

## Hardcoded `$` + `es-CO` number formatting (not using `formatMoney`/`formatPriceLocale`)

These files still format money with `'$' + num.toLocaleString('es-CO')` or similar instead of using `utils/money.js`:

1. **`src/components/shared/NumberTicker.jsx`** — `formatCOP()` function, hardcoded `es-CO` locale, hardcoded `prefix='$'`
2. **`src/components/pages/Home.jsx`** — lines 1428, 1444, 1772, 4163, 4188, 4207, 4289, 4325, 4377, 4388, 4399 (search results, form inputs)
3. **`src/components/pages/Balance.jsx`** — lines 312, 328 (edit form valorDisplay)
4. **`src/components/pages/Clientes.jsx`** — line 897 (WhatsApp template variable formatting)
5. **`src/hooks/useServiceHandlers.js`** — line 313 (WhatsApp template variable formatting)
6. **`src/components/shared/ServiceCard.jsx`** — lines 260, 618 (pago form input display)
7. **`src/components/pages/PagoTrabajadores.jsx`** — lines 937, 991 (descuento/abono form input display)
8. **`src/components/Admin/AdminDashboard.jsx`** — line 21 (admin fmt function)
9. **`src/components/pages/BalanceMockup.jsx`** — line 27 (landing page mockup)
10. **`src/components/pages/PagoMockup.jsx`** — lines 39, 44, 51 (landing page mockup)
11. **`src/components/payment/CheckoutModal.jsx`** — lines 8-9 (subscription plan prices in COP)
12. **`src/components/payment/WompiWidget.jsx`** — line 294 (subscription prices in COP)
13. **`src/components/pages/Reportes.jsx`** — Excel numFmt `'$ #,##0'` in ~15 places

## `parsePriceLocale` issue
- `src/utils/money.js` `parsePriceLocale()` strips ALL non-digits — this breaks for USD/PEN/NIO which have decimals

## `formatPriceLocale` issue
- Always uses `maximumFractionDigits: 0` — should respect currency config `decimals` for USD/PEN/NIO

**Why:** Multi-currency was implemented but only some files were updated. These remnants will show wrong symbols (e.g., `$` instead of `S/` for PEN, `C$` for NIO) and wrong number formatting.

**How to apply:** When fixing, use `formatPriceLocale`/`parsePriceLocale` from `utils/money.js` for input formatting, and `formatMoney`/`getCurrencySymbol` for display formatting.
