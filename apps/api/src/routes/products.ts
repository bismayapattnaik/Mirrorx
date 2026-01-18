import { Router, Response } from 'express';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { productExtractRequestSchema } from '@facefit/shared';
import type { ProductExtractResponse } from '@facefit/shared';

const router = Router();

// User agent to mimic browser
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Extract product info from HTML
function extractProductInfo(html: string, url: string): ProductExtractResponse {
  const $ = cheerio.load(html);

  // Common selectors for Indian e-commerce sites
  let title = $('meta[property="og:title"]').attr('content') ||
              $('meta[name="title"]').attr('content') ||
              $('h1').first().text().trim();

  let imageUrl = $('meta[property="og:image"]').attr('content') ||
                 $('meta[name="twitter:image"]').attr('content');

  let description = $('meta[property="og:description"]').attr('content') ||
                    $('meta[name="description"]').attr('content');

  let brand: string | null = null;
  let price: number | null = null;
  let source = 'unknown';

  // Site-specific extraction
  if (url.includes('myntra.com')) {
    source = 'myntra';
    brand = $('.pdp-title').first().text().trim() || null;
    const priceText = $('.pdp-price strong').first().text().trim();
    price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
  } else if (url.includes('ajio.com')) {
    source = 'ajio';
    brand = $('.brand-name').first().text().trim() || null;
    const priceText = $('.prod-sp').first().text().trim();
    price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
  } else if (url.includes('amazon.')) {
    source = 'amazon';
    brand = $('#bylineInfo').text().replace('Visit the ', '').replace(' Store', '').trim() || null;
    const priceText = $('.a-price-whole').first().text().trim();
    price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
  } else if (url.includes('flipkart.com')) {
    source = 'flipkart';
    brand = $('span._2WkVRV').first().text().trim() || null;
    const priceText = $('div._30jeq3').first().text().trim();
    price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
  } else if (url.includes('meesho.com')) {
    source = 'meesho';
    // Meesho requires JavaScript rendering, basic extraction
    const priceText = $('h4').filter((_, el) => $(el).text().includes('₹')).first().text();
    price = priceText ? parseInt(priceText.replace(/[^\d]/g, ''), 10) : null;
  }

  return {
    title: title || null,
    brand,
    price,
    currency: 'INR',
    image_url: imageUrl || null,
    description: description || null,
    source,
  };
}

// POST /products/extract - Extract product info from URL
router.post(
  '/extract',
  authenticate,
  validate(productExtractRequestSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { url } = req.body;

      // Fetch the page
      const response = await axios.get(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        timeout: 15000,
        maxRedirects: 5,
      });

      const productInfo = extractProductInfo(response.data, url);

      // Validate we got at least an image
      if (!productInfo.image_url) {
        return res.status(422).json({
          error: 'Extraction failed',
          message: 'Could not extract product image from this URL. Please upload the image manually.',
          partial: productInfo,
        });
      }

      res.json(productInfo);
    } catch (error) {
      console.error('Product extraction error:', error);

      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          return res.status(504).json({
            error: 'Timeout',
            message: 'The product page took too long to load. Please try again or upload the image manually.',
          });
        }
        if (error.response?.status === 403) {
          return res.status(422).json({
            error: 'Access denied',
            message: 'Cannot access this product page. Please upload the image manually.',
          });
        }
      }

      res.status(500).json({
        error: 'Extraction failed',
        message: 'Failed to extract product information. Please upload the image manually.',
      });
    }
  }
);

export default router;
