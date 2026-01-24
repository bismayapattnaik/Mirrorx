import { GoogleGenAI } from '@google/genai';

// Initialize Gemini client
const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const TEXT_MODEL = 'gemini-2.0-flash';
const IMAGE_MODEL = 'gemini-3-pro-image-preview';

type Gender = 'male' | 'female';

// User profile analysis result
export interface ProfileAnalysis {
  skinTone: {
    tone: string; // e.g., "fair", "light", "medium", "olive", "tan", "dark", "deep"
    undertone: string; // "warm", "cool", "neutral"
    description: string;
  };
  faceShape: string; // "oval", "round", "square", "heart", "oblong"
  bodyType: string; // "ectomorph", "mesomorph", "endomorph", "athletic"
  colorPalette: {
    bestColors: string[];
    avoidColors: string[];
    neutrals: string[];
    accentColors: string[];
  };
  stylePersonality: string; // "classic", "trendy", "casual", "bohemian", "minimalist", "sporty"
}

// Style recommendation
export interface StyleRecommendation {
  category: string;
  title: string;
  description: string;
  colors: string[];
  occasions: string[];
  priceRange: string;
  searchQuery: string;
  buyLinks: Array<{ store: string; url: string }>;
}

// Size recommendation
export interface SizeRecommendation {
  category: string; // "topwear", "bottomwear", "footwear"
  recommendedSize: string;
  measurements: {
    chest?: string;
    waist?: string;
    hips?: string;
    length?: string;
    footLength?: string;
  };
  fitTips: string[];
}

// Analyze user profile from photo
export async function analyzeUserProfile(
  photoBase64: string,
  gender: Gender
): Promise<ProfileAnalysis> {
  try {
    const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const genderWord = gender === 'female' ? 'woman' : 'man';

    const prompt = `You are an expert fashion consultant and color analyst. Analyze this ${genderWord}'s photo to determine their style profile.

Analyze and return a JSON object with:
{
  "skinTone": {
    "tone": "<one of: fair, light, medium, olive, tan, dark, deep>",
    "undertone": "<one of: warm, cool, neutral>",
    "description": "<brief description of their skin tone characteristics>"
  },
  "faceShape": "<one of: oval, round, square, heart, oblong, diamond>",
  "bodyType": "<based on visible build: ectomorph/slim, mesomorph/athletic, endomorph/curvy, average>",
  "colorPalette": {
    "bestColors": ["<5-6 colors that would look best on them based on skin tone>"],
    "avoidColors": ["<3-4 colors to avoid>"],
    "neutrals": ["<3-4 neutral colors that suit them>"],
    "accentColors": ["<3-4 bold accent colors for accessories>"]
  },
  "stylePersonality": "<suggested style based on their look: classic, trendy, casual, bohemian, minimalist, sporty, elegant>"
}

Consider:
- Indian skin tones and fashion sensibilities
- Colors that complement their undertone
- Practical everyday fashion advice

Return ONLY the JSON object, no other text.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanPhoto,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // Default fallback
    return getDefaultProfile(gender);
  } catch (error) {
    console.error('Profile analysis error:', error);
    return getDefaultProfile(gender);
  }
}

// Get personalized style recommendations
export async function getPersonalizedRecommendations(
  profile: ProfileAnalysis,
  gender: Gender,
  occasion?: string,
  season?: string
): Promise<StyleRecommendation[]> {
  try {
    const genderWord = gender === 'female' ? 'women' : 'men';
    const occasionText = occasion ? `for ${occasion}` : 'for everyday wear';
    const seasonText = season || 'all seasons';

    const prompt = `You are an expert Indian fashion stylist. Based on this profile, suggest trendy outfits ${occasionText}.

Profile:
- Skin tone: ${profile.skinTone.tone} with ${profile.skinTone.undertone} undertone
- Best colors: ${profile.colorPalette.bestColors.join(', ')}
- Style personality: ${profile.stylePersonality}
- Body type: ${profile.bodyType}

Generate 6 outfit recommendations for ${genderWord}, considering:
- Current Indian fashion trends 2024-2025
- ${seasonText} appropriate
- Mix of casual and formal options
- Budget range from affordable to premium
- Available on Indian e-commerce (Myntra, Ajio, Amazon)

Return a JSON array of recommendations:
[
  {
    "category": "<topwear/bottomwear/fulloutfit/ethnic/western>",
    "title": "<catchy outfit name>",
    "description": "<detailed outfit description with specific items>",
    "colors": ["<recommended colors from their palette>"],
    "occasions": ["<suitable occasions>"],
    "priceRange": "<in INR, e.g., '₹1,500 - ₹3,500'>",
    "searchQuery": "<search term for Indian e-commerce>"
  }
]

Return ONLY the JSON array, no other text.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      const recommendations = JSON.parse(jsonMatch[0]);
      return addBuyLinks(recommendations);
    }

    return [];
  } catch (error) {
    console.error('Recommendations error:', error);
    return [];
  }
}

// Generate size recommendation based on photo analysis
export async function getSizeRecommendation(
  photoBase64: string,
  gender: Gender,
  productCategory: string,
  userHeight?: number, // in cm
  userWeight?: number, // in kg
  pastFeedback?: Array<{ size: string; fit: string }> // "too tight", "too loose", "perfect"
): Promise<SizeRecommendation> {
  try {
    const cleanPhoto = photoBase64.replace(/^data:image\/\w+;base64,/, '');
    const genderWord = gender === 'female' ? 'woman' : 'man';

    let feedbackContext = '';
    if (pastFeedback && pastFeedback.length > 0) {
      feedbackContext = `
Past size feedback from user:
${pastFeedback.map(f => `- Size ${f.size} was ${f.fit}`).join('\n')}
Consider this feedback when recommending size.`;
    }

    const prompt = `You are an expert fashion sizing consultant. Analyze this ${genderWord}'s photo to recommend the best size for ${productCategory}.

${userHeight ? `User's height: ${userHeight} cm` : ''}
${userWeight ? `User's weight: ${userWeight} kg` : ''}
${feedbackContext}

Based on visible body proportions and any provided measurements, recommend the best size.

Return a JSON object:
{
  "category": "${productCategory}",
  "recommendedSize": "<S/M/L/XL/XXL or specific size like 32/34/36 for jeans>",
  "measurements": {
    "chest": "<estimated chest size if relevant>",
    "waist": "<estimated waist size>",
    "hips": "<estimated hip size if relevant>",
    "length": "<recommended length preference>"
  },
  "fitTips": [
    "<3-4 specific fit tips for this person>",
    "<e.g., 'Go for regular fit tops for better draping'>",
    "<e.g., 'Mid-rise bottoms will be most flattering'>"
  ]
}

Use Indian sizing standards. Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanPhoto,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    return {
      category: productCategory,
      recommendedSize: 'M',
      measurements: {},
      fitTips: ['Unable to determine exact size from photo. M is recommended as a starting point.'],
    };
  } catch (error) {
    console.error('Size recommendation error:', error);
    return {
      category: productCategory,
      recommendedSize: 'M',
      measurements: {},
      fitTips: ['Please try again or provide more details for accurate sizing.'],
    };
  }
}

// Analyze a clothing item and suggest complementary items
export async function getComplementarySuggestions(
  clothingBase64: string,
  clothingType: 'topwear' | 'bottomwear' | 'footwear' | 'accessory',
  userProfile?: ProfileAnalysis,
  gender: Gender = 'female'
): Promise<{
  itemAnalysis: string;
  complementaryItems: StyleRecommendation[];
  fullOutfitIdea: string;
  sizeSuggestion?: string;
}> {
  try {
    const cleanImage = clothingBase64.replace(/^data:image\/\w+;base64,/, '');
    const genderWord = gender === 'female' ? 'women' : 'men';

    let profileContext = '';
    if (userProfile) {
      profileContext = `
User's color palette:
- Best colors: ${userProfile.colorPalette.bestColors.join(', ')}
- Undertone: ${userProfile.skinTone.undertone}
Match suggestions to these colors.`;
    }

    const prompt = `Analyze this ${clothingType} item and suggest complementary pieces to complete the outfit for ${genderWord}.
${profileContext}

The user has uploaded a ${clothingType}. Analyze it and suggest:
1. What items would complete this outfit
2. Color combinations that work
3. Where to buy matching items in India

Return a JSON object:
{
  "itemAnalysis": "<detailed analysis of the uploaded item - color, style, material, brand style>",
  "complementaryItems": [
    {
      "category": "<what type of item>",
      "title": "<specific item name>",
      "description": "<why it matches and detailed description>",
      "colors": ["<recommended colors>"],
      "occasions": ["<when to wear>"],
      "priceRange": "<in INR>",
      "searchQuery": "<search term for Indian sites>"
    }
  ],
  "fullOutfitIdea": "<describe the complete outfit look when all pieces come together>",
  "sizeSuggestion": "<general sizing tip for matching items>"
}

Suggest 4-5 complementary items. Focus on Indian fashion trends and available brands.
Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: cleanImage,
              },
            },
          ],
        },
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      result.complementaryItems = addBuyLinks(result.complementaryItems || []);
      return result;
    }

    return {
      itemAnalysis: 'Unable to analyze the item',
      complementaryItems: [],
      fullOutfitIdea: '',
    };
  } catch (error) {
    console.error('Complementary suggestions error:', error);
    return {
      itemAnalysis: 'Error analyzing item',
      complementaryItems: [],
      fullOutfitIdea: '',
    };
  }
}

// Get trending outfits based on season and occasion
export async function getTrendingOutfits(
  gender: Gender,
  occasion?: string,
  season?: string,
  userProfile?: ProfileAnalysis
): Promise<{
  trends: Array<{
    name: string;
    description: string;
    keyPieces: string[];
    celebrities: string[];
    howToWear: string;
  }>;
  recommendations: StyleRecommendation[];
}> {
  try {
    const genderWord = gender === 'female' ? 'women' : 'men';
    const occasionText = occasion || 'everyday';
    const seasonText = season || 'current season';

    let profileContext = '';
    if (userProfile) {
      profileContext = `User's best colors: ${userProfile.colorPalette.bestColors.join(', ')}`;
    }

    const prompt = `You are an expert Indian fashion stylist. What are the current trending outfits for ${genderWord} in India for ${occasionText} in ${seasonText}?
${profileContext}

Return a JSON object:
{
  "trends": [
    {
      "name": "<trend name, e.g., 'Quiet Luxury', 'Y2K Revival', 'Indo-Western'>",
      "description": "<what this trend is about>",
      "keyPieces": ["<essential items for this trend>"],
      "celebrities": ["<Indian celebrities wearing this trend>"],
      "howToWear": "<tips on how to pull off this trend>"
    }
  ],
  "recommendations": [
    {
      "category": "<topwear/bottomwear/fulloutfit/ethnic>",
      "title": "<specific trendy item>",
      "description": "<detailed description>",
      "colors": ["<trending colors>"],
      "occasions": ["<suitable occasions>"],
      "priceRange": "<in INR>",
      "searchQuery": "<search term>"
    }
  ]
}

Include 4-5 trends and 6-8 specific product recommendations.
Focus on what's trending on Indian social media and fashion platforms.
Return ONLY the JSON object.`;

    const response = await client.models.generateContent({
      model: TEXT_MODEL,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0]);
      result.recommendations = addBuyLinks(result.recommendations || []);
      return result;
    }

    return { trends: [], recommendations: [] };
  } catch (error) {
    console.error('Trending outfits error:', error);
    return { trends: [], recommendations: [] };
  }
}

// Helper: Add buy links to recommendations
function addBuyLinks(recommendations: any[]): StyleRecommendation[] {
  const INDIAN_STORES = [
    { name: 'Myntra', baseUrl: 'https://www.myntra.com/search?q=' },
    { name: 'Ajio', baseUrl: 'https://www.ajio.com/search/?text=' },
    { name: 'Amazon', baseUrl: 'https://www.amazon.in/s?k=' },
    { name: 'Flipkart', baseUrl: 'https://www.flipkart.com/search?q=' },
  ];

  return recommendations.map(rec => ({
    ...rec,
    buyLinks: INDIAN_STORES.map(store => ({
      store: store.name,
      url: `${store.baseUrl}${encodeURIComponent(rec.searchQuery || rec.title)}`,
    })),
  }));
}

// Helper: Default profile fallback
function getDefaultProfile(gender: Gender): ProfileAnalysis {
  return {
    skinTone: {
      tone: 'medium',
      undertone: 'warm',
      description: 'Medium warm skin tone typical of South Asian complexion',
    },
    faceShape: 'oval',
    bodyType: 'average',
    colorPalette: {
      bestColors: ['navy blue', 'maroon', 'olive green', 'mustard', 'coral'],
      avoidColors: ['neon colors', 'very pale pastels'],
      neutrals: ['beige', 'off-white', 'gray', 'brown'],
      accentColors: ['gold', 'copper', 'turquoise'],
    },
    stylePersonality: 'classic',
  };
}

export default {
  analyzeUserProfile,
  getPersonalizedRecommendations,
  getSizeRecommendation,
  getComplementarySuggestions,
  getTrendingOutfits,
};
