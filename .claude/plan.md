# Plan: Landing Page Premium para monacomotodetailing.com

## Contexto
Crear una web estilo Apple/Tesla (light theme, premium, animaciones suaves) para **monacomotodetailing.com** que aloje las 2 ramas del negocio:
1. **Lavadero de motos** — Monaco Moto Detailing, Soacha León XIII
2. **Curso online** — "Guía completa para abrir un lavadero de motos exitoso" ($772.000 COP en Hotmart)

## Arquitectura: Proyecto separado

Crear un **nuevo proyecto** independiente (`monaco-landing/`) en lugar de meterlo dentro de `the-monaco`. Razones:
- `the-monaco` es una SPA (React + PWA + backend Express) — mezclar una landing estática ahí complica el routing y el SEO
- La landing necesita SSR/SSG para SEO (meta tags, structured data, prerenderizado)
- Deploy independiente = más simple de mantener
- Usaremos **Vite + React** (mismo stack que ya conoces) con `vite-plugin-ssr` o simplemente prerenderizado estático

### Estructura del proyecto
```
monaco-landing/
├── index.html
├── vite.config.js
├── package.json
├── Dockerfile
├── public/
│   ├── favicon.ico
│   ├── og-image.jpg          (1200x630 para redes sociales)
│   ├── logo.svg
│   ├── robots.txt
│   └── sitemap.xml
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── styles/
│   │   └── global.css         (estilo Apple/Tesla light theme)
│   ├── sections/
│   │   ├── Navbar.jsx
│   │   ├── Hero.jsx           (video/foto full-width, headline impactante)
│   │   ├── Services.jsx       (servicios del lavadero con precios)
│   │   ├── Gallery.jsx        (fotos antes/después, scroll horizontal)
│   │   ├── Course.jsx         (sección del curso con módulos)
│   │   ├── Testimonials.jsx   (reseñas — placeholder por ahora)
│   │   ├── Location.jsx       (mapa + dirección + horarios)
│   │   ├── FAQ.jsx            (preguntas frecuentes — clave para SEO + IA)
│   │   ├── CTA.jsx            (call to action final)
│   │   └── Footer.jsx
│   └── components/
│       └── ScrollReveal.jsx   (animación de aparición al hacer scroll)
```

## Secciones de la Landing (orden de scroll)

### 1. Navbar (sticky, transparente → sólido al scroll)
- Logo Monaco Moto Detailing
- Links: Servicios | Curso | Ubicación | Contacto
- CTA: "Agenda tu cita" → WhatsApp

### 2. Hero (full viewport, estilo Tesla)
- Foto/video de fondo del lavadero (placeholder con gradient si no hay foto HD)
- H1: **"Detailing premium para tu moto en Soacha"**
- Subtítulo: "Lavado profesional, polichada y restauración. Resultados que hablan solos."
- 2 botones: "Agendar cita" (WhatsApp) | "Ver servicios" (scroll)

### 3. Servicios (grid cards, estilo Apple)
- Cards grandes con icono + nombre + precio + descripción corta
- Servicios a mostrar (los de la app — se hardcodean con los datos reales):
  - Lavado General
  - Lavado Premium
  - Polichada
  - Cera y Restaurador
  - Kit de Arrastre
  - (los que tenga configurados)
- CTA: "Agenda tu lavada" → WhatsApp

### 4. Galería (scroll horizontal, estilo Apple productos)
- Fotos del trabajo (antes/después)
- Placeholder con cards si aún no hay fotos HD

### 5. Curso — "Monta tu propio lavadero"
- H2: **"¿Quieres montar tu propio lavadero de motos?"**
- Subtítulo: "El 80% de los lavaderos quiebran en los primeros 6 meses. Este curso te enseña cómo ser del 20% que sobrevive."
- Módulos del curso (de Hotmart):
  - Ingeniería del local (drenaje, iluminación, zonas)
  - Maquinaria correcta (hidrofoamer, compresor, marcas)
  - Legalización (permisos, trampas de grasa)
  - Marketing premium (atraer clientes con poder adquisitivo)
  - Proveedores verificados
- Precio: $772.000 COP
- CTA: "Comprar curso" → link Hotmart

### 6. Ubicación + Contacto
- Google Maps embed (Carrera 8 #41a - 31, León XIII, Soacha)
- Horarios: Lunes a Domingo 9am - 6pm
- WhatsApp: 3022269608
- Instagram: @monaco_motodetailing

### 7. FAQ (CLAVE para SEO + IA)
Preguntas optimizadas para búsquedas reales:
- "¿Cuánto cuesta lavar una moto en Soacha?"
- "¿Qué incluye el lavado premium de motos?"
- "¿Cuánto cuesta montar un lavadero de motos?"
- "¿Qué se necesita para abrir un lavadero de motos?"
- "¿Dónde queda Monaco Moto Detailing?"
- "¿El curso incluye soporte?"

### 8. Footer
- Logo + redes sociales (Instagram, TikTok)
- Links rápidos
- © 2026 Monaco Moto Detailing

## SEO Técnico

### Meta tags en index.html
```html
<title>Monaco Moto Detailing | Lavadero Premium de Motos en Soacha</title>
<meta name="description" content="Lavadero profesional de motos en Soacha, León XIII. Lavado premium, polichada, cera y restauración. Abierto L-D 9am-6pm. Agenda tu cita por WhatsApp.">
<meta name="keywords" content="lavadero de motos soacha, lavado de motos leon xiii, detailing motos, polichada motos soacha, lavadero de motos cerca">
<link rel="canonical" href="https://monacomotodetailing.com">

<!-- Open Graph -->
<meta property="og:title" content="Monaco Moto Detailing | Lavadero Premium de Motos">
<meta property="og:description" content="Detailing profesional para tu moto en Soacha. Resultados premium, precios justos.">
<meta property="og:image" content="https://monacomotodetailing.com/og-image.jpg">
<meta property="og:url" content="https://monacomotodetailing.com">
<meta property="og:type" content="website">
```

### Structured Data (JSON-LD) — CLAVE para IA
```json
// LocalBusiness — para Google Maps y búsquedas locales
{
  "@context": "https://schema.org",
  "@type": "AutoWash",
  "name": "Monaco Moto Detailing",
  "description": "Lavadero premium de motos en Soacha, León XIII",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Carrera 8 #41a - 31",
    "addressLocality": "Soacha",
    "addressRegion": "Cundinamarca",
    "addressCountry": "CO"
  },
  "telephone": "+573022269608",
  "openingHours": "Mo-Su 09:00-18:00",
  "priceRange": "$$",
  "url": "https://monacomotodetailing.com",
  "sameAs": [
    "https://www.instagram.com/monaco_motodetailing/"
  ]
}

// Course — para que la IA recomiende el curso
{
  "@context": "https://schema.org",
  "@type": "Course",
  "name": "Guía completa para abrir un lavadero de motos exitoso",
  "description": "Curso online que enseña ingeniería, maquinaria, legalización y marketing para montar un lavadero de motos rentable.",
  "provider": {
    "@type": "Organization",
    "name": "Monaco Moto Detailing"
  },
  "offers": {
    "@type": "Offer",
    "price": "772000",
    "priceCurrency": "COP"
  }
}

// FAQPage — para aparecer en snippets de Google y respuestas de IA
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [...]
}
```

### robots.txt + sitemap.xml
- Generados automáticamente
- Sitemap con la URL canónica

## Estilo Visual (Apple/Tesla Light Theme)

### Paleta
- **Fondo**: #FFFFFF (blanco puro)
- **Texto principal**: #1d1d1f (casi negro, como Apple)
- **Texto secundario**: #6e6e73
- **Acento**: #0071e3 (azul Apple) o color de marca Monaco
- **Cards**: #f5f5f7 (gris muy claro)

### Tipografía
- Font: Inter o SF Pro Display (Google Fonts: Inter)
- H1: 56px bold, line-height 1.07 (como Apple)
- H2: 40px semibold
- Body: 17px, line-height 1.47

### Animaciones
- Scroll reveal (fade-up al entrar en viewport) usando IntersectionObserver
- Navbar blur al scroll
- Hover suaves en cards y botones
- Sin librerías pesadas — CSS transitions + JS vanilla

## Deploy
- Dockerfile multi-stage (build con Node → serve con nginx)
- Se puede deployar en el mismo servidor Docker
- Configurar DNS de monacomotodetailing.com → IP del servidor
- SSL con Let's Encrypt / certbot

## Tareas pendientes del usuario (NO son parte del código)
1. **Crear Google Business Profile** — esto es CRÍTICO para SEO local
2. **Subir fotos HD** del lavadero y trabajos terminados
3. **Pedir reseñas** a clientes en Google Maps
4. **Crear imagen OG** (1200x630px) para redes sociales

## Archivos a crear
1. `monaco-landing/package.json`
2. `monaco-landing/vite.config.js`
3. `monaco-landing/index.html` (con meta tags + structured data)
4. `monaco-landing/src/main.jsx`
5. `monaco-landing/src/App.jsx`
6. `monaco-landing/src/styles/global.css`
7. `monaco-landing/src/sections/Navbar.jsx`
8. `monaco-landing/src/sections/Hero.jsx`
9. `monaco-landing/src/sections/Services.jsx`
10. `monaco-landing/src/sections/Gallery.jsx`
11. `monaco-landing/src/sections/Course.jsx`
12. `monaco-landing/src/sections/Testimonials.jsx`
13. `monaco-landing/src/sections/Location.jsx`
14. `monaco-landing/src/sections/FAQ.jsx`
15. `monaco-landing/src/sections/Footer.jsx`
16. `monaco-landing/src/components/ScrollReveal.jsx`
17. `monaco-landing/public/robots.txt`
18. `monaco-landing/public/sitemap.xml`
19. `monaco-landing/Dockerfile`
