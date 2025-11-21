
/* 
  SERVER.JS - Tu Backend Privado para Productos Promocionales
  
  Instrucciones de despliegue:
  1. Descarga este archivo y el package.json.
  2. Crea un repositorio nuevo en tu GitHub personal.
  3. Sube ambos archivos a ese repositorio.
  4. Ve a Render.com (con tu cuenta personal), crea un "Web Service" y conecta ese repositorio.
*/

const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/search', async (req, res) => {
  const { q, site } = req.query;
  const targetSite = site || 'https://www.catalogospromocionales.com';
  
  if (!q) return res.status(400).json({ error: 'Query parameter q is required' });

  console.log(`Searching for ${q} on ${targetSite}`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    // Estrategia simple: Buscar en Google restringido al sitio
    // Esto es más robusto que tratar de navegar la estructura de cada sitio individualmente
    const searchUrl = `https://www.google.com/search?q=site:${targetSite} ${q}&tbm=isch`;
    
    await page.goto(searchUrl, { waitUntil: 'networkidle2' });

    // Extraer resultados de imágenes de Google (suelen tener mejor metadata)
    const results = await page.evaluate(() => {
      const elements = document.querySelectorAll('div.isv-r');
      return Array.from(elements).slice(0, 10).map(el => {
        const linkEl = el.querySelector('a:nth-child(2)');
        const imgEl = el.querySelector('img');
        return {
          name: el.innerText.split('\n')[0] || 'Producto Promocional',
          productUrl: linkEl ? linkEl.href : '',
          imageUrl: imgEl ? imgEl.src : '',
          description: 'Disponible en inventario',
          price: 0 // El precio suele requerir navegación profunda
        };
      });
    });

    res.json(results);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error scraping data', details: error.message });
  } finally {
    if (browser) await browser.close();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend corriendo en puerto ${PORT}`);
});
      