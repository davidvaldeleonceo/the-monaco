# Landing Page Optimizer -- Monaco PRO

## Project Context
- SaaS B2B for car/motorcycle wash businesses in Colombia
- Pricing: $49,900 COP/month or $490,000 COP/year (18% savings)
- Target: owners who are NOT at the shop all day, want remote control
- Competition: notebooks, WhatsApp, Excel -- no strong direct SaaS competition in Colombia
- Domain: themonaco.com.co (no www, nginx redirects)
- WhatsApp contact: 573144016349

## Landing Page Architecture (as of Mar 2026)
- File: `src/components/pages/LandingPage.jsx`
- CSS: `src/App.css` lines 9333-10637 (all `.landing-*` classes)
- Mockup components: EstadoMockup.jsx, PagoMockup.jsx, IaMockup.jsx in same dir
- Images: `/public/img/step-3.png` through `step-23.png`, `hero-phone.png`
- Section order: Nav > Hero > Social Proof > How It Works (carousel) > Features (5) > Pricing > Testimonials > CTA Final > Footer
- Features 3 and 4 (Clientes, Reportes) still use placeholder divs, not real mockups
- Responsive breakpoints: 769px+ (desktop), 500-768px (tablet), 480px- (mobile)

## SEO/Schema Status
- Has: SoftwareApplication, Organization JSON-LD, OG tags, Twitter Card, robots.txt, sitemap.xml
- Missing: FAQPage schema, AggregateRating, Review schema, BreadcrumbList
- Issue: OG image uses icon-512.png (should be 1200x630 custom image)
- Issue: meta title says only "Motos", product also serves "Carros"
- Issue: theme-color #4F56F6 doesn't match current palette (should be #0050B8)
- Issue: viewport meta blocks zoom (accessibility violation)

## AI Discoverability Gaps
- No FAQ section (visible or schema)
- No "About" paragraph citable by AI models
- No AI crawler rules in robots.txt (GPTBot, ClaudeBot, PerplexityBot)
- No lastmod in sitemap.xml
- H2 headings are generic, lack keywords like "software para lavaderos"
- Missing keyword variations: "lavado de motos", "sistema de gestion", "car wash software"

## Audit Decisions (Mar 2026)
- Owner wants to REMOVE free trial, sell paid-only
- Recommended: 15-day money-back guarantee + WhatsApp demo as risk reducers
- 7 instances of "gratis" in the page need to change
- Pricing anchor needed: "Menos de $1.700/dia" or "Lo que cobras por una lavada"
