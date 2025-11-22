
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    res.send(`
        <div style="font-family: sans-serif; padding: 20px; text-align: center;">
            <h1 style="color: #16a34a;">¡Backend V4 Activo! 🚀</h1>
            <p>Servidor listo para Análisis Profundo (Deep Scrape).</p>
            <p>Status: Online</p>
        </div>
    `);
});

app.get('/extract', async (req, res) => {
    const { url } = req.query;
    const user = req.headers['x-api-user'];
    const pass = req.headers['x-api-pass'];

    if (!url) return res.status(400).json({ error: 'Falta URL' });

    console.log(`--> Deep Scrape en: ${url}`);

    try {
         const { data } = await axios.get(url, {
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...(user && pass ? {'Authorization': 'Basic ' + Buffer.from(user + ':' + pass).toString('base64')} : {})
            },
            timeout: 10000 
        });

        const $ = cheerio.load(data);
        
        let image = $('meta[property="og:image"]').attr('content') || 
                    $('meta[name="twitter:image"]').attr('content') ||
                    $('.product-image img').attr('src') ||
                    $('img[id*="product"]').attr('src');
        
        if (image && !image.startsWith('http')) {
            const origin = new URL(url).origin;
            image = origin + (image.startsWith('/') ? '' : '/') + image;
        }

        const description = $('meta[property="og:description"]').attr('content') || 
                            $('meta[name="description"]').attr('content') ||
                            $('#description').text().trim();

        const bodyText = $('body').text();
        const priceMatch = bodyText.match(/\$\s?([0-9,.]+)/);
        const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '')) : 0;

        let stock = 'Consultar';
        const lowerBody = bodyText.toLowerCase();
        if (lowerBody.includes('agotado') || lowerBody.includes('out of stock')) {
            stock = '0';
        } else if (lowerBody.includes('disponible') || lowerBody.includes('in stock')) {
            stock = 'Disponible';
            const stockMatch = lowerBody.match(/stock:?\s?([0-9]+)/);
            if(stockMatch) stock = stockMatch[1];
        }

        res.json({
            image,
            description: description ? description.substring(0, 200) + '...' : '',
            price,
            stock
        });

    } catch (error) {
        console.error("Error extracting:", error.message);
        res.status(500).json({ error: 'Failed to extract' });
    }
});

app.get('/search', async (req, res) => {
  const { q, site } = req.query;
  const targetSite = site || 'https://www.catalogospromocionales.com';
  const query = q ? q.toLowerCase() : '';
  
  if (!q) return res.status(400).json({ error: 'Falta parámetro q' });

  const results = [];

  try {
    const searchUrl = `https://www.google.com/search?q=site:${targetSite} ${q}&tbm=isch&gbv=1`;
    
    const { data } = await axios.get(searchUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
    });

    const $ = cheerio.load(data);
    $('table.images_table td').each((i, el) => {
        if(i > 20) return;
        const linkEl = $(el).find('a');
        const imgEl = $(el).find('img');
        
        if(linkEl.length && imgEl.length) {
            let rawUrl = linkEl.attr('href');
            let productUrl = '';
            if(rawUrl && rawUrl.includes('/url?q=')) {
                productUrl = rawUrl.split('/url?q=')[1].split('&')[0];
            }
            let name = $(el).text().replace(/[0-9]+x[0-9]+/, '').substring(0, 60);

            results.push({
                name:  decodeURIComponent(name).trim() || 'Producto ' + (i+1),
                productUrl: decodeURIComponent(productUrl),
                imageUrl: imgEl.attr('src'),
                description: 'Producto de ' + targetSite,
                price: 0,
                supplier: targetSite
            });
        }
    });
    res.json(results);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error scraping data', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend V4 corriendo en puerto ${PORT}`);
});
      
      
