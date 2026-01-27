/**
 * Product Image Scraper Service
 * Extracts product images from Indian e-commerce URLs
 */

import * as cheerio from 'cheerio';

// Simple in-memory cache for product images
const imageCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

interface ProductInfo {
  image_url: string | null;
  title: string | null;
  price: number | null;
  brand: string | null;
}

/**
 * Extract product image from a URL
 */
export async function extractProductImage(url: string): Promise<string | null> {
  try {
    // Check cache first
    const cached = imageCache.get(url);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.url;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    // Try different selectors for product images
    let imageUrl: string | null = null;

    // Myntra
    if (url.includes('myntra.com')) {
      imageUrl = $('img.image-grid-image').first().attr('src') ||
                 $('picture.image-grid-imageContainer img').first().attr('src') ||
                 $('div.image-grid-col img').first().attr('src');
    }
    // Ajio
    else if (url.includes('ajio.com')) {
      imageUrl = $('img.rilrtl-lazy-img').first().attr('src') ||
                 $('div.zoom-wrap img').first().attr('src') ||
                 $('img[data-zoom-image]').first().attr('src');
    }
    // Amazon
    else if (url.includes('amazon.in') || url.includes('amazon.com')) {
      imageUrl = $('#landingImage').attr('src') ||
                 $('#imgBlkFront').attr('src') ||
                 $('img.s-image').first().attr('src');
    }
    // Flipkart
    else if (url.includes('flipkart.com')) {
      imageUrl = $('img._396cs4').first().attr('src') ||
                 $('img._2r_T1I').first().attr('src') ||
                 $('div._3togXc img').first().attr('src');
    }
    // Generic fallback - try common selectors
    else {
      imageUrl = $('meta[property="og:image"]').attr('content') ||
                 $('img[itemprop="image"]').attr('src') ||
                 $('img.product-image').first().attr('src') ||
                 $('img.main-image').first().attr('src');
    }

    if (imageUrl) {
      // Cache the result
      imageCache.set(url, { url: imageUrl, timestamp: Date.now() });
    }

    return imageUrl;
  } catch (error) {
    console.error('Product image extraction error:', error);
    return null;
  }
}

/**
 * Extract product info from search results page
 */
export async function extractFirstProductFromSearch(searchUrl: string): Promise<ProductInfo | null> {
  try {
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;

    const html = await response.text();
    const $ = cheerio.load(html);

    let product: ProductInfo = {
      image_url: null,
      title: null,
      price: null,
      brand: null,
    };

    // Myntra search results
    if (searchUrl.includes('myntra.com')) {
      const firstProduct = $('li.product-base').first();
      product.image_url = firstProduct.find('img.img-responsive').attr('src') ||
                         firstProduct.find('picture img').attr('src');
      product.title = firstProduct.find('h4.product-product').text().trim();
      product.brand = firstProduct.find('h3.product-brand').text().trim();
      const priceText = firstProduct.find('span.product-discountedPrice').text() ||
                       firstProduct.find('span.product-price').text();
      product.price = parseInt(priceText.replace(/[^\d]/g, '')) || null;
    }
    // Ajio search results
    else if (searchUrl.includes('ajio.com')) {
      const firstProduct = $('div.item').first();
      product.image_url = firstProduct.find('img.rilrtl-lazy-img').attr('src');
      product.title = firstProduct.find('div.nameCls').text().trim();
      product.brand = firstProduct.find('div.brand').text().trim();
      const priceText = firstProduct.find('span.price').text();
      product.price = parseInt(priceText.replace(/[^\d]/g, '')) || null;
    }
    // Amazon search results
    else if (searchUrl.includes('amazon.in')) {
      const firstProduct = $('div[data-component-type="s-search-result"]').first();
      product.image_url = firstProduct.find('img.s-image').attr('src');
      product.title = firstProduct.find('h2 span').text().trim();
      const priceText = firstProduct.find('span.a-price-whole').first().text();
      product.price = parseInt(priceText.replace(/[^\d]/g, '')) || null;
    }

    return product.image_url ? product : null;
  } catch (error) {
    console.error('Search product extraction error:', error);
    return null;
  }
}

/**
 * Get placeholder image URL based on item type - with variety using Unsplash
 * Uses multiple images per category for diversity
 */
export function getPlaceholderImage(itemType: string, gender: 'male' | 'female' = 'female', seed?: string): string {
  // Multiple images per category for variety
  const placeholdersByType: Record<string, string[]> = {
    top: [
      'https://images.unsplash.com/photo-1562157873-818bc0726f68?w=400&h=500&fit=crop', // casual shirts
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=400&h=500&fit=crop', // formal shirt
      'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=400&h=500&fit=crop', // t-shirt
      'https://images.unsplash.com/photo-1607345366928-199ea26cfe3e?w=400&h=500&fit=crop', // kurta
      'https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&h=500&fit=crop', // blouse
      'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=400&h=500&fit=crop', // top
    ],
    bottom: [
      'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=400&h=500&fit=crop', // jeans
      'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=400&h=500&fit=crop', // trousers
      'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?w=400&h=500&fit=crop', // pants
      'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=400&h=500&fit=crop', // chinos
      'https://images.unsplash.com/photo-1582552938357-32b906df40cb?w=400&h=500&fit=crop', // skirt
    ],
    footwear: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=500&fit=crop', // sneakers
      'https://images.unsplash.com/photo-1460353581641-37baddab0fa2?w=400&h=500&fit=crop', // nike
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=500&fit=crop', // running shoes
      'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=400&h=500&fit=crop', // formal shoes
      'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=400&h=500&fit=crop', // heels
      'https://images.unsplash.com/photo-1603808033192-082d6919d3e1?w=400&h=500&fit=crop', // sandals
    ],
    accessory: [
      'https://images.unsplash.com/photo-1523170335258-f5ed11844a49?w=400&h=500&fit=crop', // watch
      'https://images.unsplash.com/photo-1611923134239-b9be5b4d1b42?w=400&h=500&fit=crop', // sunglasses
      'https://images.unsplash.com/photo-1590548784585-643d2b9f2925?w=400&h=500&fit=crop', // bag
      'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?w=400&h=500&fit=crop', // jewelry
      'https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?w=400&h=500&fit=crop', // belt
    ],
    outerwear: [
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=400&h=500&fit=crop', // jacket
      'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=400&h=500&fit=crop', // coat
      'https://images.unsplash.com/photo-1548883354-94bcfe321cbb?w=400&h=500&fit=crop', // blazer
      'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=400&h=500&fit=crop', // hoodie
    ],
  };

  const images = placeholdersByType[itemType] || placeholdersByType.top;

  // Use seed to pick a consistent but varied image
  if (seed) {
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return images[hash % images.length];
  }

  // Random selection if no seed
  return images[Math.floor(Math.random() * images.length)];
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of imageCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      imageCache.delete(key);
    }
  }
}

// Clear cache every hour
setInterval(clearExpiredCache, 1000 * 60 * 60);
