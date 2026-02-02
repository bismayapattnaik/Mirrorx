# MirrorX - Detailed Prompt Document

## Master Prompt for MirrorX

---

## PRODUCT OVERVIEW PROMPT

```
MirrorX is an AI-powered virtual try-on platform designed specifically for the Indian fashion
e-commerce market. The platform enables users to upload a selfie and visualize themselves
wearing any clothing item from major Indian e-commerce platforms (Myntra, Ajio, Amazon India,
Flipkart, Meesho) within seconds using advanced Google Gemini AI technology.

The platform operates on a dual business model:
1. B2C (Consumer App): Direct-to-consumer virtual try-on service with freemium monetization
2. B2B (Store Mode): Enterprise SaaS solution for offline retail stores to offer digital trial rooms

Key differentiators:
- India-first approach: Optimized for Indian body types, skin tones, and fashion preferences
- Strict identity preservation: AI maintains exact user facial features and body shape
- Platform agnostic: Works with any e-commerce product URL
- Real-time 3D try-on: MediaPipe-powered live webcam experience
- Comprehensive analytics: Full KPI tracking for retail partners
```

---

## TECHNICAL ARCHITECTURE PROMPT

```
MirrorX Technical Architecture:

FRONTEND (apps/web):
- Framework: React 18 with TypeScript for type-safe component development
- Build Tool: Vite for sub-second hot module replacement and optimized production builds
- Styling: Tailwind CSS with shadcn/ui component library for premium dark-mode UI
- Animations: Framer Motion for smooth, performant transitions
- Routing: React Router v7 for client-side navigation
- State Management: Zustand stores (app-store, auth-store, merchant-store, store-mode-store)
- Forms: React Hook Form with Zod validation schemas
- 3D Graphics: Three.js for WebGL rendering
- Computer Vision: MediaPipe Tasks Vision for real-time pose detection

BACKEND (apps/api):
- Runtime: Node.js 20+ with Express.js framework
- Language: TypeScript for full-stack type safety
- Database: PostgreSQL 15+ with connection pooling (20 max connections)
- Authentication: JWT tokens (7-day expiry) + Google OAuth integration
- Password Security: bcryptjs with 12-round salt
- Image Processing: Sharp for optimization and compression
- Payments: Razorpay SDK with webhook signature verification
- AI Services: Google Gemini API (gemini-3-pro-image-preview for generation, gemini-2.0-flash for analysis)
- Web Scraping: Cheerio for product extraction from e-commerce sites
- Security: Helmet headers, CORS protection, express-rate-limit

SHARED (packages/shared):
- TypeScript type definitions shared across frontend and backend
- Zod validation schemas for API contracts
- Constants and configuration values

INFRASTRUCTURE:
- API Deployment: Google Cloud Run (serverless, auto-scaling)
- Frontend Deployment: Vercel (global CDN, edge delivery)
- Database: Supabase managed PostgreSQL or Google Cloud SQL
- Containerization: Docker with Alpine Linux base images
- Build System: Turborepo for monorepo optimization

DATABASE SCHEMA (30+ tables):
- Core: users, tryon_jobs, user_selfies, wardrobe, credits_ledger, subscriptions, orders, daily_usage
- Premium: compare_sets, wishlist_items, fit_signals, occasion_looks, outfit_builds
- Store Mode: stores, store_zones, store_products, store_sessions, store_carts, store_orders,
  store_staff, store_qr_codes, store_analytics_events, store_daily_metrics

SECURITY MEASURES:
- Rate Limiting: 100 req/15min (general), 10 req/15min (auth), 10 req/min (try-on)
- CORS: Locked to production domain (mirrorx.co.in)
- Input Validation: Zod schemas on all endpoints
- File Upload: 10MB limit, image types only (JPEG, PNG, WebP)
- Payment Security: Razorpay signature verification
- DPDP Compliance: Account deletion capability
```

---

## AI/ML CAPABILITIES PROMPT

```
MirrorX AI/ML Stack:

PRIMARY AI ENGINE - Google Gemini 3 Pro Image Preview:
- Multimodal image understanding and generation
- Photorealistic virtual try-on output
- Resolution support up to 2048x2048 pixels
- Generation time: 5-15 seconds per image

IDENTITY PRESERVATION SYSTEM:
- Proprietary system prompts ensure:
  * Exact facial feature preservation
  * Skin tone accuracy
  * Body shape maintenance
  * Only clothing changes, nothing else
- Handles diverse body types and skin tones
- Specifically trained/prompted for Indian market diversity

STYLE ANALYSIS ENGINE - Gemini 2.0 Flash:
- Fashion recommendation generation
- Outfit coordination suggestions
- Occasion-based styling advice
- Color and pattern matching analysis

REAL-TIME 3D TRY-ON - MediaPipe:
- Face landmark detection (468 points)
- Full body pose estimation (33 landmarks)
- Real-time tracking at 30+ FPS
- Works on low-end mobile devices
- Clothing overlay on body mesh using Three.js

TRY-ON MODES:
- PART: Single garment visualization on user
- FULL_FIT: Complete coordinated outfit generation

QUALITY TIERS:
- SD (Standard Definition): Fast, lower resolution
- HD (High Definition): Balanced quality/speed
- ULTRA_HD: Maximum quality for premium users

FEEDBACK LEARNING:
- User satisfaction ratings collected
- Failure cases analyzed and fed back into prompts
- Continuous improvement cycle
```

---

## BUSINESS MODEL PROMPT

```
MirrorX Business Model:

B2C REVENUE STREAMS:

1. Credit Packs (One-Time Purchase):
   - Starter: ₹49 for 20 credits (₹2.45/credit)
   - Basic: ₹99 for 50 credits (₹1.98/credit) - Most Popular
   - Pro: ₹199 for 120 credits (₹1.66/credit)
   - Elite: ₹499 for 350 credits (₹1.43/credit)

2. Subscription Plans:
   - FREE: ₹0 - 5 try-ons/day, SD quality, basic wardrobe (5 items)
   - PRO: ₹149/month - Unlimited try-ons, HD quality, compare mode, outfit builder, unlimited wardrobe
   - ELITE: ₹999/year - All Pro features + ULTRA_HD quality + API access

3. Daily Free Allowance:
   - 5 complimentary try-ons per day for all users
   - Resets at midnight IST

B2B REVENUE STREAMS (Store Mode):

1. Setup Fee: ₹25,000 one-time
   - Implementation and configuration
   - Staff training
   - Initial customization

2. SaaS Fee: ₹9,999/month per store
   - Platform access
   - Analytics dashboard
   - Technical support
   - Regular updates

3. Usage-Based Pricing:
   - ₹2 per try-on transaction
   - 1.5% of order value as transaction fee

4. Add-Ons:
   - White-label branding: ₹5,000/month
   - Kiosk hardware rental: ₹15,000/month

UNIT ECONOMICS:

B2C:
- Customer Acquisition Cost (CAC): ₹75
- Lifetime Value (LTV): ₹450
- LTV:CAC Ratio: 6:1
- Payback Period: 2.5 months
- Monthly Churn: 5%
- ARPU: ₹35 (blended free + paid)

B2B:
- CAC per Store: ₹15,000
- Annual Contract Value: ₹2,40,000
- LTV (3-year): ₹7,20,000
- LTV:CAC Ratio: 48:1
- Gross Margin: 75%
- Break-even per Store: 3 weeks
```

---

## FEATURE SET PROMPT

```
MirrorX Complete Feature Set:

CORE FEATURES:
1. AI Virtual Try-On
   - Upload selfie + paste product URL
   - Photorealistic outfit visualization
   - < 10 second generation time
   - Identity preservation technology

2. Multi-Platform Support
   - Myntra product extraction
   - Ajio product extraction
   - Amazon India product extraction
   - Flipkart product extraction
   - Meesho product extraction

3. Virtual Wardrobe
   - Save unlimited try-on results (Pro/Elite)
   - Categorize by occasion (casual, formal, ethnic, party, sports)
   - Sort by date, brand
   - Share wardrobe items

4. Quick Try-On
   - Save selfie once
   - Instant try-ons without re-uploading
   - Faster generation with cached user image

PREMIUM FEATURES (Studio 2.0):
5. Compare Mode
   - Side-by-side outfit comparison
   - Up to 4 outfits simultaneously
   - Easy decision making

6. Background Modes
   - Original background
   - Studio backdrop
   - Blur effect

7. Quality Selection
   - SD (fast)
   - HD (balanced)
   - ULTRA_HD (premium)

8. Outfit Builder
   - Mix and match multiple items
   - Create complete looks
   - Save outfit combinations

9. Occasion Stylist
   - AI-powered recommendations
   - Event-specific suggestions
   - Weather-aware styling

10. Wishlist
    - Save products for later
    - Price tracking
    - Availability alerts

11. Fit Signals
    - Personalized size recommendations
    - Brand-specific sizing data
    - Fit history learning

STORE MODE (B2B):
12. QR Code Entry System
    - Store-level QR codes
    - Zone-level QR codes
    - Product-level QR codes
    - Session tracking

13. In-Store Try-On
    - Kiosk-based experience
    - Mobile-friendly interface
    - Fast checkout flow

14. Virtual Shopping Cart
    - Add items from try-on
    - Modify quantities
    - Real-time pricing

15. Instant Checkout
    - Razorpay integration
    - UPI, Cards, Net Banking
    - Pickup pass generation

16. Merchant Portal
    - Store setup wizard
    - Product catalog management
    - Bulk import capability
    - Staff management (Admin/Manager/Associate/Cashier roles)

17. Analytics Dashboard
    - QR scan tracking
    - Try-on success rates
    - Conversion funnels
    - Revenue metrics
    - Customer behavior insights

SOCIAL FEATURES:
18. Shop Together
    - Invite friends
    - Real-time collaboration
    - Group styling sessions

19. Feed System
    - Share try-on results
    - Discover trending looks
    - Community engagement

AUTHENTICATION:
20. Multiple Sign-In Options
    - Email/password
    - Google OAuth (one-click)
    - Guest demo mode

COMPLIANCE:
21. Privacy Features
    - DPDP Act compliant
    - Account deletion
    - Data export
    - Consent management
```

---

## MARKET OPPORTUNITY PROMPT

```
MirrorX Market Opportunity (Indian Market):

TOTAL ADDRESSABLE MARKET (TAM):
- Indian Fashion E-Commerce Market 2024: ₹7,50,000 Crore
- Projected 2027: ₹14,50,000 Crore
- CAGR: 24%

SERVICEABLE ADDRESSABLE MARKET (SAM):
- Fashion E-commerce (Virtual Try-On Ready): ₹2,25,000 Crore
- Offline Fashion Retail (Tier 1-2 Cities): ₹3,50,000 Crore
- Total SAM: ₹5,75,000 Crore

SERVICEABLE OBTAINABLE MARKET (SOM) - 5 Year Target:
- B2C Subscriptions: ₹150 Crore
- B2C Credit Packs: ₹50 Crore
- B2B Store Mode: ₹300 Crore
- Total SOM: ₹500 Crore

KEY MARKET DRIVERS:
1. Smartphone Penetration: 750M+ users in India
2. 5G Rollout: Enabling real-time AI on mobile
3. Post-COVID Digital Adoption: 2x online fashion shopping
4. Return Cost Pressure: ₹18,000 Crore lost annually
5. Gen Z & Millennials: Primary demographic (18-35 years)
6. D2C Brand Explosion: 5,000+ brands needing differentiation

PAIN POINTS ADDRESSED:
- 25-40% fashion return rates
- 67% shoppers hesitate due to fit uncertainty
- ₹4,500-6,000 cost per return for retailers
- Trial room capacity limitations
- COVID hygiene concerns with shared spaces

TARGET SEGMENTS:
B2C:
- Fashion enthusiasts (18-35 years)
- Frequent online shoppers (3+ purchases/month)
- Instagram fashion community
- Wedding/occasion shoppers

B2B:
- Multi-brand outlets (MBOs)
- D2C brand stores
- Fashion chains (FBB, Pantaloons, Lifestyle)
- Department stores (Shoppers Stop, Central)
```

---

## FINANCIAL PROJECTIONS PROMPT

```
MirrorX 5-Year Financial Projections (All figures in INR):

REVENUE PROJECTIONS:
Year 1: ₹2 Crore (B2C: ₹1.2 Cr, B2B: ₹0.8 Cr)
Year 2: ₹15 Crore (B2C: ₹6 Cr, B2B: ₹9 Cr) - 650% growth
Year 3: ₹75 Crore (B2C: ₹25 Cr, B2B: ₹50 Cr) - 400% growth
Year 4: ₹200 Crore (B2C: ₹70 Cr, B2B: ₹130 Cr) - 167% growth
Year 5: ₹500 Crore (B2C: ₹150 Cr, B2B: ₹350 Cr) - 150% growth

USER METRICS:
Year 1: 50,000 registered | 15,000 MAU | 2,500 paying | 15 stores
Year 2: 3,00,000 registered | 90,000 MAU | 30,000 paying | 150 stores
Year 3: 15,00,000 registered | 5,00,000 MAU | 2,25,000 paying | 750 stores
Year 4: 50,00,000 registered | 18,00,000 MAU | 10,00,000 paying | 2,500 stores
Year 5: 1,00,00,000 registered | 40,00,000 MAU | 25,00,000 paying | 7,500 stores

PROFITABILITY:
Year 1: EBITDA -₹82 Lakhs (-41% margin) - Investment phase
Year 2: EBITDA ₹3 Crore (20% margin) - Break-even
Year 3: EBITDA ₹40 Crore (53% margin) - Profitable scale
Year 4: EBITDA ₹120 Crore (60% margin) - Strong profitability
Year 5: EBITDA ₹350 Crore (70% margin) - Market leadership

COST STRUCTURE (Year 1):
- Cloud Infrastructure: ₹24 Lakhs/year (12%)
- AI API Costs (Gemini): ₹60 Lakhs/year (30%)
- Team Salaries: ₹1.44 Crore/year (72%)
- Marketing: ₹36 Lakhs/year (18%)
- Legal & Compliance: ₹6 Lakhs/year (3%)
- Miscellaneous: ₹12 Lakhs/year (6%)
- Total: ₹2.82 Crore/year

GROSS MARGINS BY YEAR:
Year 1: 45%
Year 2: 55%
Year 3: 65%
Year 4: 70%
Year 5: 75%
```

---

## COMPETITIVE ANALYSIS PROMPT

```
MirrorX Competitive Landscape:

DIRECT COMPETITORS:
1. Zeekit (Walmart-owned)
   - Geography: USA
   - Technology: 2D overlay
   - Pricing: Enterprise only
   - Weakness: No India presence, not consumer-focused

2. Vue.ai
   - Geography: USA/India
   - Technology: AI styling
   - Pricing: Enterprise
   - Weakness: Not consumer-focused, complex integration

3. Reactive Reality
   - Geography: Europe
   - Technology: 3D avatars
   - Pricing: High-end
   - Weakness: Complex implementation, expensive

4. Trinny London
   - Geography: UK
   - Technology: AR makeup
   - Pricing: Free
   - Weakness: Makeup only, single category

5. Snapchat AR Try-On
   - Geography: Global
   - Technology: AR filters
   - Pricing: Free
   - Weakness: Not fashion-focused, limited accuracy

MIRRORX COMPETITIVE ADVANTAGES:
1. India-First: Built for Indian body types, skin tones, fashion
2. Platform Agnostic: Works with any e-commerce URL
3. Dual Revenue: B2C + B2B model
4. AI Quality: Gemini 3 Pro + proprietary identity preservation
5. Low CAC: Viral product with social sharing
6. Speed: < 10 second generation
7. Pricing: Affordable for Indian market

DEFENSIBILITY MOATS:
- High: India-first focus, platform integrations, B2B relationships
- Medium-High: AI model quality, proprietary prompts
- Medium: UI/UX design, feature comprehensiveness
```

---

## INVESTOR PITCH PROMPT

```
MirrorX Investment Opportunity:

THE PROBLEM:
- 67% of Indian shoppers hesitate to buy online due to fit uncertainty
- 25-40% of fashion items are returned (₹18,000 Crore annual loss)
- Retailers spend ₹4,500-6,000 per return
- Trial rooms are bottlenecks in physical stores

THE SOLUTION:
MirrorX - AI-powered virtual try-on that lets users see themselves in any outfit
before purchase, reducing returns by up to 50% and increasing conversions 2-3x.

TRACTION:
- Production-ready MVP with 15+ features
- Full tech stack: 10,000+ lines of code
- Integrated with 5 major Indian e-commerce platforms
- Razorpay payments live
- Store Mode B2B product complete

MARKET OPPORTUNITY:
- TAM: ₹14,50,000 Crore by 2027
- SAM: ₹5,75,000 Crore
- SOM: ₹500 Crore (Year 5 target)

BUSINESS MODEL:
- B2C: Credit packs (₹49-499) + Subscriptions (₹149/month, ₹999/year)
- B2B: Setup (₹25K) + SaaS (₹9,999/month) + Usage fees

UNIT ECONOMICS:
- B2C LTV:CAC: 6:1
- B2B LTV:CAC: 48:1
- Path to profitability: 18 months

FUNDING ASK:
- Amount: ₹5-10 Crore (Seed Round)
- Valuation: ₹25-30 Crore pre-money
- Equity: 15-20%
- Use: Product (35%), Team (28%), Marketing (21%), Infrastructure (7%), Operations (9%)

MILESTONES (18 months):
- 3,00,000 users
- 100 B2B stores
- ₹1 Crore MRR
- Mobile app launch
- EBITDA positive

EXIT POTENTIAL (Year 5):
- Conservative: ₹1,800 Crore (6x revenue)
- Base Case: ₹4,000 Crore (8x revenue)
- Optimistic: ₹7,500 Crore (10x revenue)

WHY NOW:
1. Gemini AI enables photorealistic results
2. Post-COVID digital behavior locked in
3. Retailers desperate for return-reduction solutions
4. No direct competitor in Indian market
5. First-mover advantage window

WHY US:
1. India-first product design
2. Production-ready technology
3. Dual revenue model
4. Strong unit economics
5. Capital efficient path to scale
```

---

## PRODUCT DEMO SCRIPT PROMPT

```
MirrorX Product Demo Script:

OPENING (30 seconds):
"Welcome to MirrorX - India's first AI-powered virtual try-on platform.
Let me show you how you can see yourself in any outfit before buying."

CONSUMER APP DEMO (2 minutes):

Step 1 - Upload Selfie:
"First, take a quick selfie or upload an existing photo.
Our AI will preserve your exact features throughout the experience."

Step 2 - Find Product:
"Now, go to any fashion website - Myntra, Ajio, Amazon, Flipkart, or Meesho.
Copy the product URL of any item you like."

Step 3 - Generate Try-On:
"Paste the URL here, and in less than 10 seconds, you'll see yourself
wearing that exact outfit. Notice how your face, skin tone, and body
shape remain perfectly preserved."

Step 4 - Save & Compare:
"Love it? Save to your wardrobe. Want to compare? Add multiple items
and view them side-by-side to make the perfect decision."

Step 5 - Share:
"Share your look with friends or on social media directly from the app."

STORE MODE DEMO (2 minutes):

Step 1 - QR Entry:
"For retailers, customers simply scan a QR code at the store entrance
or near any product display."

Step 2 - Browse & Try:
"They can browse your entire catalog and try on any item virtually -
no need to physically stock every size and color."

Step 3 - Add to Cart:
"When they find what they love, one tap adds it to their cart with
real-time pricing."

Step 4 - Checkout:
"Seamless checkout with UPI, cards, or any payment method through
our Razorpay integration."

Step 5 - Analytics:
"Meanwhile, you get real-time analytics - which items are being tried,
conversion rates, popular zones, and revenue tracking."

CLOSING (30 seconds):
"MirrorX reduces returns by up to 50%, increases conversions 2-3x,
and creates a shopping experience your customers will love.
Ready to transform your fashion business?"
```

---

## TECHNICAL INTEGRATION PROMPT

```
MirrorX API Integration Guide:

BASE URL: https://api.mirrorx.co.in

AUTHENTICATION:
All API requests require JWT token in Authorization header:
Authorization: Bearer <jwt_token>

CORE ENDPOINTS:

1. TRY-ON GENERATION
POST /tryon
Content-Type: multipart/form-data

Request:
- selfie: File (JPEG/PNG/WebP, max 10MB)
- product_url: String (Myntra/Ajio/Amazon/Flipkart/Meesho URL)
- gender: String (male/female)
- mode: String (PART/FULL_FIT)

Response:
{
  "job_id": "uuid",
  "status": "processing",
  "estimated_time": 10
}

2. GET TRY-ON RESULT
GET /tryon/:job_id

Response:
{
  "job_id": "uuid",
  "status": "completed",
  "result_url": "https://...",
  "product": {
    "name": "...",
    "brand": "...",
    "price": 1999,
    "image_url": "..."
  }
}

3. PRODUCT EXTRACTION
POST /products/extract
Content-Type: application/json

Request:
{
  "url": "https://www.myntra.com/..."
}

Response:
{
  "name": "Product Name",
  "brand": "Brand",
  "price": 1999,
  "description": "...",
  "image_url": "...",
  "source": "myntra"
}

4. WARDROBE OPERATIONS
GET /wardrobe - List saved items
POST /wardrobe/save - Save try-on result
DELETE /wardrobe/:id - Remove item

5. CREDIT OPERATIONS
GET /credits/balance - Get current balance
GET /credits/history - Transaction history

RATE LIMITS:
- General: 100 requests per 15 minutes
- Try-on: 10 requests per minute
- Auth: 10 requests per 15 minutes

ERROR CODES:
- 400: Bad Request (invalid input)
- 401: Unauthorized (invalid/expired token)
- 402: Payment Required (insufficient credits)
- 429: Too Many Requests (rate limited)
- 500: Server Error

WEBHOOKS (B2B):
Configure webhook URL in merchant settings to receive:
- try_on.completed
- order.created
- order.paid
- session.started
- session.ended
```

---

## BRAND VOICE & MESSAGING PROMPT

```
MirrorX Brand Guidelines:

BRAND ESSENCE:
"See yourself in style, before you buy"

TAGLINE OPTIONS:
- "Try Before You Buy, Virtually"
- "Your AI Fashion Mirror"
- "See It. Love It. Buy It."
- "Fashion Confidence, Instantly"

BRAND PERSONALITY:
- Innovative but accessible
- Premium but not elitist
- Tech-forward but human-centered
- Confident but not arrogant
- Indian-first with global quality

TONE OF VOICE:
- Friendly and approachable
- Confident and knowledgeable
- Helpful and supportive
- Exciting but not overwhelming

COLOR PALETTE:
- Primary: Deep Black (#02040a)
- Accent: Premium Gold (#D4AF37)
- Secondary: Warm Gold variants
- Text: White/Light gray on dark backgrounds

TYPOGRAPHY:
- Headlines: Modern sans-serif, bold
- Body: Clean, readable sans-serif
- Monospace for technical elements

KEY MESSAGES:

For Consumers:
- "Never second-guess an outfit again"
- "Your personal AI stylist, available 24/7"
- "Works with all your favorite shopping apps"
- "See exactly how it looks on YOU"

For Retailers:
- "Reduce returns by up to 50%"
- "Increase conversions 2-3x"
- "Digital trial rooms without the queue"
- "Complete analytics on customer behavior"

For Investors:
- "₹500 Crore revenue potential in 5 years"
- "First-mover in ₹14.5 Lakh Crore market"
- "Unit economics that scale: 48:1 B2B LTV:CAC"
- "Production-ready technology, capital-efficient growth"

AVOID:
- Overpromising AI capabilities
- Technical jargon with consumers
- Comparing directly to competitors
- Making accuracy guarantees
```

---

## COMPLETE ELEVATOR PITCH PROMPT

```
MirrorX Elevator Pitches:

30-SECOND PITCH:
"MirrorX is an AI-powered virtual try-on platform for Indian fashion.
Users upload a selfie, paste any product URL from Myntra, Ajio, or Amazon,
and see themselves wearing that outfit in seconds. We're solving the
₹18,000 Crore return problem in Indian fashion e-commerce. With B2C
subscriptions and B2B store solutions, we're targeting ₹500 Crore revenue
in 5 years. We're raising ₹5-10 Crore to scale."

60-SECOND PITCH:
"67% of Indian shoppers hesitate to buy fashion online because they
can't visualize how it'll look on them. This leads to 25-40% returns,
costing retailers ₹18,000 Crore annually.

MirrorX solves this with AI-powered virtual try-on. Upload a selfie,
paste a product URL from any major platform, and see yourself wearing
that exact outfit in under 10 seconds - with your face and body
perfectly preserved.

For consumers, we offer free daily try-ons plus premium subscriptions.
For retailers, we provide Store Mode - QR-powered digital trial rooms
with complete analytics.

We have a production-ready product, Razorpay payments integrated, and
support for Myntra, Ajio, Amazon, Flipkart, and Meesho. Our unit
economics are strong: 6:1 LTV:CAC for B2C, 48:1 for B2B.

We're raising ₹5-10 Crore to reach 3 lakh users and 100 retail stores
in 18 months. The ₹14.5 Lakh Crore fashion market is waiting for
this solution. MirrorX is ready to deliver it."

2-MINUTE PITCH:
[Use the complete Investor Pitch Prompt above]
```

---

## USE THIS MASTER PROMPT FOR:

1. **AI Assistants**: Feed to ChatGPT/Claude for generating marketing content
2. **Investor Meetings**: Quick reference during Q&A
3. **Sales Calls**: Product positioning and feature explanations
4. **Content Creation**: Blog posts, social media, PR
5. **Team Onboarding**: New employee orientation
6. **Developer Documentation**: Technical integration guides
7. **Customer Support**: Consistent messaging and feature explanations
8. **Pitch Decks**: Slide content generation
9. **Partnership Discussions**: Value proposition articulation
10. **Media Interviews**: Key talking points

---

*Document Version: 1.0*
*Last Updated: February 2025*
*Confidential - For Internal Use*
