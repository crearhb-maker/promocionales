
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Endpoint raíz para verificar estado
app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1 style="color: #16a34a;">Backend Promocionales Activo 🚀</h1>
            <p>Servidor listo para scraping ligero con Cheerio.</p>
            <p>Estado: <strong>ONLINE</strong></p>
        </div>
    `);
});

// Endpoint para búsqueda de productos (Google Images Site Search)
app.get('/search', async (req, res) => {
  const { q, site } = req.query;
  const targetSite = site || 'https://www.catalogospromocionales.com/';
  const query = q ? q.toLowerCase() : '';
  
  if (!q) return res.status(400).json({ error: 'Falta parámetro q' });

  try {
    // Usamos Google Images con parámetros para obtener una versión HTML simple
    const searchUrl = `https://www.google.com/search?q=site:${encodeURIComponent(targetSite)} ${encodeURIComponent(q)}&tbm=isch&gbv=1`;
    
    const { data } = await axios.get(searchUrl, {
        headers: { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' 
        }
    });

    const $ = cheerio.load(data);
    const results = [];
    
    // Parsear la tabla de imágenes de Google (Vista básica)
    $('table.images_table td').each((i, el) => {
        if(i > 30) return; // Límite de resultados
        
        const linkEl = $(el).find('a');
        const imgEl = $(el).find('img');
        
        if(linkEl.length && imgEl.length) {
            let rawUrl = linkEl.attr('href');
            let productUrl = '';
            
            // Limpiar URL de redirección de Google (/url?q=...)
            if(rawUrl && rawUrl.includes('/url?q=')) {
                productUrl = rawUrl.split('/url?q=')[1].split('&')[0];
            } else {
                productUrl = rawUrl;
            }
            
            productUrl = decodeURIComponent(productUrl);

            // Extraer nombre
            let name = $(el).text() || '';
            name = name.replace(/[0-9]+x[0-9]+/, '').substring(0, 80).trim();

            if (productUrl && name) {
                results.push({
                    name: name || `Producto ${i+1}`,
                    productUrl: productUrl,
                    imageUrl: imgEl.attr('src'),
                    description: `Producto encontrado en ${targetSite}`,
                    price: 0, 
                    supplier: targetSite
                });
            }
        }
    });
    
    res.json(results);
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ error: 'Error en búsqueda', details: error.message });
  }
});

// Endpoint para extracción profunda de detalles
app.get('/extract', async (req, res) => {
    const { url } = req.query;
    const user = req.headers['x-api-user'];
    const pass = req.headers['x-api-pass'];

    if (!url) return res.status(400).json({ error: 'Falta parámetro url' });

    try {
         const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                ...(user && pass ? {'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')} : {})
            },
            timeout: 10000
        });

        const $ = cheerio.load(data);
        
        // Lógica de extracción (Imagen, Descripción, Precio, Stock)
        let image = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('.product-image img').attr('src') ||
                    $('#image-main').attr('src') ||
                    $('img[id*="product"]').first().attr('src');
        
        // Resolver URL relativa de imagen
        if (image && !image.startsWith('http')) {
            try {
                const u = new URL(url);
                image = u.origin + (image.startsWith('/') ? '' : '/') + image;
            } catch(e) {}
        }

        const description = $('meta[property="og:description"]').attr('content') || 
                            $('meta[name="description"]').attr('content') ||
                            $('.product-description').text().trim();

        // Intento básico de precio
        const bodyText = $('body').text();
        const priceMatch = bodyText.match(/\$\s?([0-9,.]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

        // Intento básico de stock
        let stock = 'Consultar';
        const lowerBody = bodyText.toLowerCase();
        if (lowerBody.includes('agotado') || lowerBody.includes('out of stock')) stock = '0';
        else if (lowerBody.includes('disponible') || lowerBody.includes('in stock')) stock = 'Disponible';

        res.json({
            image: image || '',
            description: description ? description.substring(0, 300) + '...' : '',
            price,
            stock
        });

    } catch (error) {
        console.error("Extract error:", error.message);
        res.status(500).json({ error: 'No se pudo extraer', details: error.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
      