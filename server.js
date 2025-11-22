
/* 
  SERVER.JS - Versión Ligera Mejorada
  Optimizado para Render Free. Soporta recepción de credenciales.
*/

const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

// RUTA DE BIENVENIDA (Health Check)
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1 style="color: #16a34a;">¡Backend Ligero v2 Activo! 🚀</h1>
            <p>Servidor corriendo con tecnología Fast-Scrape (Cheerio).</p>
            <p>Copia la URL de esta página y pégala en la configuración de tu App.</p>
            <hr/>
            <small>Status: Online | Time: ${new Date().toISOString()}</small>
        </div>
    `);
});

app.get('/search', async (req, res) => {
  const { q, site } = req.query;
  const user = req.headers['x-api-user']; // Credencial Usuario
  const pass = req.headers['x-api-pass']; // Credencial Password
  
  const targetSite = site || 'https://www.catalogospromocionales.com';
  
  if (!q) return res.status(400).json({ error: 'Falta parámetro q' });

  console.log(`Buscando "${q}" en ${targetSite} (Modo Ligero)`);
  if(user) console.log("Credenciales de proveedor recibidas (Listo para implementación futura)");

  try {
    // Usamos Google Images versión básica (gbv=1) con filtro de sitio
    const searchUrl = `https://www.google.com/search?q=site:${targetSite} ${q}&tbm=isch&gbv=1`;
    
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    // Extracción mejorada de imágenes de tabla Google
    $('table.images_table td').each((i, el) => {
        if(i > 20) return; // Traer más resultados

        const linkEl = $(el).find('a');
        const imgEl = $(el).find('img');
        
        if(linkEl.length) {
            // Limpiar URL sucia de google (/url?q=...)
            let rawUrl = linkEl.attr('href');
            let productUrl = '';
            if(rawUrl && rawUrl.includes('/url?q=')) {
                productUrl = rawUrl.split('/url?q=')[1].split('&')[0];
            }

            // Extraer texto cercano para nombre
            let rawText = $(el).text() || '';
            // Limpiar el texto (suele tener resolución "200x200" etc)
            let name = rawText.replace(/[0-9]+x[0-9]+/, '').replace(/images?/, '').substring(0, 60);

            if(productUrl && imgEl.attr('src')) {
                results.push({
                    name:  decodeURIComponent(name).trim() || 'Producto ' + (i+1),
                    productUrl: decodeURIComponent(productUrl),
                    imageUrl: imgEl.attr('src'),
                    description: 'Producto detectado en ' + targetSite,
                    price: 0,
                    supplier: targetSite
                });
            }
        }
    });

    // Si Google Images falla o devuelve poco, fallback a búsqueda Web normal
    if(results.length < 2) {
         const webUrl = `https://www.google.com/search?q=site:${targetSite} ${q}&gbv=1`;
         const { data: webData } = await axios.get(webUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
         const $web = cheerio.load(webData);
         
         $web('div.Gx5Zad').each((i, el) => {
             const title = $web(el).find('div.BNeawe.vvjwJb').text();
             const link = $web(el).find('a').attr('href');
             
             if(title && link) {
                 let cleanLink = link;
                 if(link.includes('/url?q=')) cleanLink = link.split('/url?q=')[1].split('&')[0];
                 
                 results.push({
                    name: title,
                    productUrl: decodeURIComponent(cleanLink),
                    imageUrl: '', // Sin imagen
                    description: $web(el).find('div.BNeawe.s3v9rd').text(),
                    price: 0
                 });
             }
         });
    }

    res.json(results);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error scraping data', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend Ligero corriendo en puerto ${PORT}`);
});
      
