
/* 
  SERVER.JS - Versión Ligera (Cheerio + Axios)
  Esta versión NO descarga Chrome y NO se traba en Render.
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
            <h1 style="color: #16a34a;">¡Backend Ligero Activo! 🚀</h1>
            <p>Servidor corriendo con tecnología Fast-Scrape (Cheerio).</p>
            <p>Copia la URL de esta página y pégala en la configuración de tu App.</p>
            <hr/>
            <small>Status: Online | Time: ${new Date().toISOString()}</small>
        </div>
    `);
});

app.get('/search', async (req, res) => {
  const { q, site } = req.query;
  const targetSite = site || 'https://www.catalogospromocionales.com';
  
  if (!q) return res.status(400).json({ error: 'Falta parámetro q' });

  console.log(`Buscando ${q} en ${targetSite} (Modo Ligero)`);

  try {
    // Usamos Google Images en versión básica (HTML puro) que es rapidísima
    const searchUrl = `https://www.google.com/search?q=site:${targetSite} ${q}&tbm=isch&gbv=1`;
    
    const { data } = await axios.get(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    const $ = cheerio.load(data);
    const results = [];

    // Extraer datos de la tabla de imágenes básica de Google
    // Esta estructura cambia a veces, pero suele ser estable en la versión gbv=1
    $('table.images_table td').each((i, el) => {
        if(i > 10) return; // Limitar resultados

        const linkEl = $(el).find('a');
        const imgEl = $(el).find('img');
        const descEl = $(el).text(); // A veces el texto está suelto

        if(linkEl.length) {
            // La URL de google suele venir sucia: /url?q=REAL_URL&sa=...
            let rawUrl = linkEl.attr('href');
            let productUrl = '';
            if(rawUrl && rawUrl.includes('/url?q=')) {
                productUrl = rawUrl.split('/url?q=')[1].split('&')[0];
            }

            results.push({
                name:  decodeURIComponent(productUrl.split('/').pop() || 'Producto Encontrado').replace(/-/g, ' '),
                productUrl: decodeURIComponent(productUrl),
                imageUrl: imgEl.attr('src'),
                description: 'Resultado web rápido',
                price: 0,
                supplier: targetSite
            });
        }
    });

    // Si no encontró nada en imágenes, intentamos búsqueda web normal
    if(results.length === 0) {
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
                    imageUrl: '', // Sin imagen en modo texto
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
      
