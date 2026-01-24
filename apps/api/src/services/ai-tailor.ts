import { GoogleGenAI } from '@google/genai';

const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const VISION_MODEL = 'gemini-2.0-flash';

/**
 * Comprehensive AI Tailor Service
 * Analyzes user photos and provides personalized style recommendations
 */

export interface StyleDNA {
  bodyType: 'hourglass' | 'pear' | 'apple' | 'rectangle' | 'inverted_triangle' | 'athletic';
  skinTone: string;
  skinUndertone: 'warm' | 'cool' | 'neutral';
  colorSeason: 'spring' | 'summer' | 'autumn' | 'winter';
  faceShape: 'oval' | 'round' | 'square' | 'heart' | 'oblong' | 'diamond';
  stylePersonality: string[];
  bestColors: string[];
  avoidColors: string[];
  bestPatterns: string[];
  bestNecklines: string[];
  bestSilhouettes: string[];
}

export interface TailorRecommendation {
  category: string;
  item: string;
  description: string;
  whyItWorks: string;
  colorOptions: string[];
  priceRange: string;
  occasions: string[];
  buyLinks: Array<{ store: string; url: string }>;
  priority: 'essential' | 'recommended' | 'optional';
}

export interface OutfitSuggestion {
  name: string;
  occasion: string;
  items: Array<{
    type: string;
    description: string;
    color: string;
    searchQuery: string;
  }>;
  stylingTips: string[];
  confidence: number;
}

export interface SizeRecommendation {
  brand: string;
  category: string;
  recommendedSize: string;
  fitNotes: string;
  confidence: number;
}

// Indian e-commerce stores
const INDIAN_STORES = [
  { name: 'Myntra', baseUrl: 'https://www.myntra.com/search?q=' },
  { name: 'Ajio', baseUrl: 'https://www.ajio.com/search/?text=' },
  { name: 'Amazon', baseUrl: 'https://www.amazon.in/s?k=' },
  { name: 'Flipkart', baseUrl: 'https://www.flipkart.com/search?q=' },
  { name: 'Meesho', baseUrl: 'https://www.meesho.com/search?q=' },
  { name: 'Nykaa Fashion', baseUrl: 'https://www.nykaafashion.com/search?q=' },
  { name: 'Tata CLiQ', baseUrl: 'https://www.tatacliq.com/search/?searchCategory=all&text=' },
];

/**
 * Analyze user's photo to create their Style DNA
 */
export async function analyzeStyleDNA(
  photoBase64: string,
  gender: 'male' | 'female'
): Promise<StyleDNA> {
  const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const genderWord = gender === 'female' ? 'woman' : 'man';

  const prompt = `You are an expert fashion stylist and color analyst. Analyze this photo of a ${genderWord} and create their complete Style DNA profile.

Analyze CAREFULLY and provide accurate assessments for:

1. BODY TYPE: Analyze visible proportions (hourglass/pear/apple/rectangle/inverted_triangle/athletic)
2. SKIN TONE: Describe the exact skin tone (e.g., "fair with golden undertones", "medium brown", "deep ebony")
3. SKIN UNDERTONE: Determine if warm (golden/yellow), cool (pink/blue), or neutral
4. COLOR SEASON: Based on skin, hair, and features - spring/summer/autumn/winter
5. FACE SHAPE: Analyze facial structure (oval/round/square/heart/oblong/diamond)
6. STYLE PERSONALITY: What styles would suit this person? (e.g., ["Classic", "Minimalist", "Bohemian"])
7. BEST COLORS: List 8-10 specific colors that would be most flattering
8. AVOID COLORS: List colors that may wash out or clash with their coloring
9. BEST PATTERNS: What patterns suit their build and personality
10. BEST NECKLINES: What necklines flatter their face shape and body
11. BEST SILHOUETTES: What clothing silhouettes work best

Return ONLY a valid JSON object with these exact fields:
{
  "bodyType": "one of: hourglass/pear/apple/rectangle/inverted_triangle/athletic",
  "skinTone": "detailed description",
  "skinUndertone": "warm/cool/neutral",
  "colorSeason": "spring/summer/autumn/winter",
  "faceShape": "oval/round/square/heart/oblong/diamond",
  "stylePersonality": ["array", "of", "styles"],
  "bestColors": ["specific", "color", "names"],
  "avoidColors": ["colors", "to", "avoid"],
  "bestPatterns": ["pattern", "types"],
  "bestNecklines": ["neckline", "types"],
  "bestSilhouettes": ["silhouette", "types"]
}`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanPhoto } },
        { text: prompt }
      ]
    }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse Style DNA:', e);
    }
  }

  // Default response if parsing fails
  return {
    bodyType: 'rectangle',
    skinTone: 'Medium',
    skinUndertone: 'neutral',
    colorSeason: 'autumn',
    faceShape: 'oval',
    stylePersonality: ['Classic', 'Modern'],
    bestColors: ['Navy', 'Burgundy', 'Forest Green', 'Cream'],
    avoidColors: ['Neon colors'],
    bestPatterns: ['Solid', 'Subtle stripes'],
    bestNecklines: ['V-neck', 'Crew neck'],
    bestSilhouettes: ['Fitted', 'A-line']
  };
}

/**
 * Get personalized wardrobe recommendations based on Style DNA
 */
export async function getWardrobeRecommendations(
  photoBase64: string,
  styleDNA: StyleDNA,
  gender: 'male' | 'female',
  budget: 'budget' | 'mid-range' | 'premium' = 'mid-range'
): Promise<TailorRecommendation[]> {
  const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const genderWord = gender === 'female' ? 'woman' : 'man';

  const budgetRanges = {
    budget: { tops: '₹500-₹1,500', bottoms: '₹700-₹2,000', shoes: '₹800-₹2,500' },
    'mid-range': { tops: '₹1,500-₹4,000', bottoms: '₹2,000-₹5,000', shoes: '₹2,500-₹6,000' },
    premium: { tops: '₹4,000-₹15,000', bottoms: '₹5,000-₹20,000', shoes: '₹6,000-₹25,000' }
  };

  const prompt = `You are an expert personal stylist for Indian ${genderWord}s. Based on this person's photo and their Style DNA profile, create a personalized wardrobe recommendation.

STYLE DNA:
- Body Type: ${styleDNA.bodyType}
- Skin Tone: ${styleDNA.skinTone} (${styleDNA.skinUndertone} undertone)
- Color Season: ${styleDNA.colorSeason}
- Face Shape: ${styleDNA.faceShape}
- Style Personality: ${styleDNA.stylePersonality.join(', ')}
- Best Colors: ${styleDNA.bestColors.join(', ')}
- Best Silhouettes: ${styleDNA.bestSilhouettes.join(', ')}

BUDGET: ${budget} (Tops: ${budgetRanges[budget].tops}, Bottoms: ${budgetRanges[budget].bottoms})

Create a complete wardrobe recommendation with 10-12 items covering:
- Essential basics (t-shirts, shirts, trousers)
- Statement pieces
- Occasion wear (office, casual, festive)
- Accessories

For each item provide:
1. Category (Tops/Bottoms/Outerwear/Footwear/Accessories)
2. Specific item name
3. Detailed description
4. Why it works for this person's body/coloring
5. Color options (from their best colors)
6. Price range in INR
7. Suitable occasions
8. Priority (essential/recommended/optional)
9. Search query for Indian e-commerce

Return ONLY a valid JSON array:
[{
  "category": "category",
  "item": "item name",
  "description": "detailed description",
  "whyItWorks": "personalized reasoning",
  "colorOptions": ["color1", "color2"],
  "priceRange": "₹X,XXX - ₹X,XXX",
  "occasions": ["occasion1", "occasion2"],
  "priority": "essential/recommended/optional",
  "searchQuery": "search term for Indian stores"
}]`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanPhoto } },
        { text: prompt }
      ]
    }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      const items = JSON.parse(jsonMatch[0]);
      // Add buy links to each item
      return items.map((item: any) => ({
        ...item,
        buyLinks: INDIAN_STORES.map(store => ({
          store: store.name,
          url: `${store.baseUrl}${encodeURIComponent(item.searchQuery || item.item)}`
        }))
      }));
    } catch (e) {
      console.error('Failed to parse recommendations:', e);
    }
  }

  return [];
}

/**
 * Generate complete outfit suggestions for specific occasions
 */
export async function generateOutfitSuggestions(
  photoBase64: string,
  styleDNA: StyleDNA,
  gender: 'male' | 'female',
  occasions: string[] = ['casual', 'office', 'party', 'festive']
): Promise<OutfitSuggestion[]> {
  const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');
  const genderWord = gender === 'female' ? 'woman' : 'man';

  const prompt = `You are a celebrity stylist creating complete outfit looks for this ${genderWord}.

STYLE DNA:
- Body Type: ${styleDNA.bodyType}
- Best Colors: ${styleDNA.bestColors.join(', ')}
- Style Personality: ${styleDNA.stylePersonality.join(', ')}
- Best Silhouettes: ${styleDNA.bestSilhouettes.join(', ')}

Create ${occasions.length} complete outfit looks for these occasions: ${occasions.join(', ')}

For each outfit:
1. Give it a catchy name
2. List all items (top, bottom, footwear, accessories)
3. Provide specific styling tips
4. Rate your confidence (0-100) that this will look amazing

Return ONLY valid JSON:
[{
  "name": "Outfit Name",
  "occasion": "occasion type",
  "items": [
    {"type": "Top", "description": "specific item", "color": "color", "searchQuery": "search term"},
    {"type": "Bottom", "description": "specific item", "color": "color", "searchQuery": "search term"},
    {"type": "Footwear", "description": "specific item", "color": "color", "searchQuery": "search term"},
    {"type": "Accessory", "description": "specific item", "color": "color", "searchQuery": "search term"}
  ],
  "stylingTips": ["tip1", "tip2", "tip3"],
  "confidence": 85
}]`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanPhoto } },
        { text: prompt }
      ]
    }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse outfit suggestions:', e);
    }
  }

  return [];
}

/**
 * Predict size across different Indian brands
 */
export async function predictSize(
  photoBase64: string,
  userMeasurements: {
    height?: number; // in cm
    weight?: number; // in kg
    chest?: number; // in inches
    waist?: number; // in inches
    hips?: number; // in inches
  },
  gender: 'male' | 'female',
  category: 'tops' | 'bottoms' | 'dresses'
): Promise<SizeRecommendation[]> {
  const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');

  const measurementInfo = Object.entries(userMeasurements)
    .filter(([_, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ') || 'Not provided';

  const brands = gender === 'female'
    ? ['Zara', 'H&M', 'Mango', 'Forever 21', 'AND', 'W', 'Biba', 'FabIndia', 'Global Desi']
    : ['Zara', 'H&M', 'Levis', 'Van Heusen', 'Peter England', 'Allen Solly', 'Jack & Jones'];

  const prompt = `You are a sizing expert for Indian fashion brands. Based on this ${gender}'s photo and measurements, predict their size across brands.

MEASUREMENTS: ${measurementInfo}
CATEGORY: ${category}
BRANDS TO PREDICT: ${brands.join(', ')}

Analyze the photo for body proportions and predict accurate sizes. Indian brands often run smaller than international brands.

Return ONLY valid JSON:
[{
  "brand": "brand name",
  "category": "${category}",
  "recommendedSize": "S/M/L/XL or specific size",
  "fitNotes": "Notes about fit (slim fit, relaxed, etc.)",
  "confidence": 85
}]`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: cleanPhoto } },
        { text: prompt }
      ]
    }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (e) {
      console.error('Failed to parse size predictions:', e);
    }
  }

  return [];
}

/**
 * Analyze a garment and suggest how to style it for this specific user
 */
export async function styleGarmentForUser(
  userPhotoBase64: string,
  garmentPhotoBase64: string,
  styleDNA: StyleDNA,
  gender: 'male' | 'female'
): Promise<{
  compatibility: number;
  verdict: string;
  howToWear: string[];
  complementaryItems: Array<{
    type: string;
    description: string;
    color: string;
    searchQuery: string;
    buyLinks: Array<{ store: string; url: string }>;
  }>;
  occasions: string[];
  warnings: string[];
}> {
  const cleanUser = userPhotoBase64.replace(/^data:image\/\w+;base64,/, '');
  const cleanGarment = garmentPhotoBase64.replace(/^data:image\/\w+;base64,/, '');

  const prompt = `You are a personal stylist. Image 1 is your client (${gender}). Image 2 is a garment they want to buy.

CLIENT'S STYLE DNA:
- Body Type: ${styleDNA.bodyType}
- Skin Tone: ${styleDNA.skinTone} (${styleDNA.skinUndertone})
- Best Colors: ${styleDNA.bestColors.join(', ')}
- Colors to Avoid: ${styleDNA.avoidColors.join(', ')}

Analyze:
1. How well does this garment suit this person? (0-100 compatibility score)
2. Your verdict (Would you recommend this purchase?)
3. How should they style this garment?
4. What complementary items would complete the look?
5. What occasions is this suitable for?
6. Any warnings (wrong color for skin tone, unflattering cut, etc.)

Return ONLY valid JSON:
{
  "compatibility": 85,
  "verdict": "Your honest assessment",
  "howToWear": ["styling tip 1", "styling tip 2"],
  "complementaryItems": [
    {"type": "Bottom", "description": "specific item", "color": "color", "searchQuery": "search term"}
  ],
  "occasions": ["casual", "office"],
  "warnings": ["any concerns"]
}`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{
      role: 'user',
      parts: [
        { text: 'IMAGE 1 - CLIENT PHOTO:' },
        { inlineData: { mimeType: 'image/jpeg', data: cleanUser } },
        { text: 'IMAGE 2 - GARMENT TO ANALYZE:' },
        { inlineData: { mimeType: 'image/jpeg', data: cleanGarment } },
        { text: prompt }
      ]
    }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    try {
      const result = JSON.parse(jsonMatch[0]);
      // Add buy links
      result.complementaryItems = (result.complementaryItems || []).map((item: any) => ({
        ...item,
        buyLinks: INDIAN_STORES.map(store => ({
          store: store.name,
          url: `${store.baseUrl}${encodeURIComponent(item.searchQuery || item.description)}`
        }))
      }));
      return result;
    } catch (e) {
      console.error('Failed to parse garment analysis:', e);
    }
  }

  return {
    compatibility: 70,
    verdict: 'This garment could work for you with the right styling.',
    howToWear: ['Pair with neutral bottoms', 'Add minimal accessories'],
    complementaryItems: [],
    occasions: ['casual'],
    warnings: []
  };
}

/**
 * Get trending styles that match user's Style DNA
 */
export async function getTrendingForUser(
  styleDNA: StyleDNA,
  gender: 'male' | 'female'
): Promise<Array<{
  trend: string;
  description: string;
  howToAdopt: string;
  suitabilityScore: number;
  shoppingList: Array<{
    item: string;
    searchQuery: string;
    buyLinks: Array<{ store: string; url: string }>;
  }>;
}>> {
  const prompt = `You are a fashion trend analyst. Based on current 2024-2025 fashion trends and this person's Style DNA, recommend trends that would work for them.

STYLE DNA:
- Body Type: ${styleDNA.bodyType}
- Color Season: ${styleDNA.colorSeason}
- Best Colors: ${styleDNA.bestColors.join(', ')}
- Style Personality: ${styleDNA.stylePersonality.join(', ')}
- Best Silhouettes: ${styleDNA.bestSilhouettes.join(', ')}

GENDER: ${gender}

Identify 5 current fashion trends that would suit this person. For each:
1. Name the trend
2. Describe it
3. Explain how this specific person can adopt it
4. Rate suitability (0-100)
5. Provide a shopping list

Focus on trends popular in India and available on Indian e-commerce.

Return ONLY valid JSON:
[{
  "trend": "Trend Name",
  "description": "What is this trend",
  "howToAdopt": "Personalized advice for this person",
  "suitabilityScore": 85,
  "shoppingList": [
    {"item": "specific item", "searchQuery": "search term"}
  ]
}]`;

  const response = await client.models.generateContent({
    model: VISION_MODEL,
    contents: [{ role: 'user', parts: [{ text: prompt }] }]
  });

  const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\[[\s\S]*\]/);

  if (jsonMatch) {
    try {
      const trends = JSON.parse(jsonMatch[0]);
      return trends.map((trend: any) => ({
        ...trend,
        shoppingList: (trend.shoppingList || []).map((item: any) => ({
          ...item,
          buyLinks: INDIAN_STORES.map(store => ({
            store: store.name,
            url: `${store.baseUrl}${encodeURIComponent(item.searchQuery || item.item)}`
          }))
        }))
      }));
    } catch (e) {
      console.error('Failed to parse trends:', e);
    }
  }

  return [];
}

export default {
  analyzeStyleDNA,
  getWardrobeRecommendations,
  generateOutfitSuggestions,
  predictSize,
  styleGarmentForUser,
  getTrendingForUser
};
