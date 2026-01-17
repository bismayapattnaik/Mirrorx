# MirrorX - AI Virtual Try-On Platform

MirrorX is a full-stack AI-powered virtual try-on platform for Indian fashion e-commerce. Upload a selfie, paste a product URL from Myntra/Ajio/Amazon, and see yourself wearing the outfit in seconds.

![MirrorX](https://placehold.co/1200x630/02040a/D4AF37?text=MirrorX+-+AI+Virtual+Try-On)

## Features

- **AI Virtual Try-On**: Photorealistic outfit visualization using Google Gemini
- **Product URL Extraction**: Works with Myntra, Ajio, Amazon, Flipkart, Meesho
- **Virtual Wardrobe**: Save and manage your favorite looks
- **Credits System**: Free daily tries + credit packs for power users
- **Subscriptions**: Pro and Elite plans with Razorpay integration
- **Google OAuth**: One-click sign-in with Google
- **Dark Mode Design**: Premium luxury UI with gold accents
- **Mobile Responsive**: Works beautifully on all devices

## Tech Stack

### Frontend (`apps/web`)
- React 18 + TypeScript
- Vite
- Tailwind CSS + shadcn/ui
- Framer Motion
- React Router
- Zustand (state management)
- React Hook Form + Zod

### Backend (`apps/api`)
- Node.js + Express
- TypeScript
- PostgreSQL
- JWT Authentication
- Razorpay SDK
- Google Gemini API
- Sharp (image processing)

### Shared (`packages/shared`)
- TypeScript types
- Zod validation schemas

## Project Structure

```
mirrorx/
├── apps/
│   ├── api/                 # Express backend
│   │   ├── src/
│   │   │   ├── db/          # Database connection & migrations
│   │   │   ├── middleware/  # Auth, error handling, validation
│   │   │   ├── routes/      # API endpoints
│   │   │   ├── services/    # Gemini AI service
│   │   │   └── index.ts     # Server entry point
│   │   └── Dockerfile
│   │
│   └── web/                 # React frontend
│       ├── src/
│       │   ├── components/  # UI components
│       │   ├── hooks/       # Custom hooks
│       │   ├── layouts/     # Page layouts
│       │   ├── lib/         # Utilities & API client
│       │   ├── pages/       # Route pages
│       │   └── store/       # Zustand stores
│       └── index.html
│
├── packages/
│   └── shared/              # Shared types & schemas
│
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 15+
- Google Gemini API key
- Razorpay account (for payments)
- Google Cloud Console project (for OAuth)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/your-org/mirrorx.git
cd mirrorx
pnpm install
```

### 2. Environment Setup

Copy the example env files:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Configure `apps/api/.env`:

```env
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://postgres:password@localhost:5432/mirrorx
JWT_SECRET=your-secure-jwt-secret-min-32-chars
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your-razorpay-secret
RAZORPAY_WEBHOOK_SECRET=your-webhook-secret
GEMINI_API_KEY=your-gemini-api-key
```

Configure `apps/web/.env`:

```env
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
```

### 3. Database Setup

Create the database and run migrations:

```bash
# Create database
createdb mirrorx

# Run migrations
pnpm db:migrate

# (Optional) Seed sample data
pnpm db:seed
```

### 4. Start Development

```bash
# Start both frontend and backend
pnpm dev

# Or start individually
pnpm dev:web   # Frontend on http://localhost:3000
pnpm dev:api   # Backend on http://localhost:4000
```

## API Endpoints

### Authentication
- `POST /auth/signup` - Register new user
- `POST /auth/login` - Email/password login
- `POST /auth/google` - Google OAuth login

### User
- `GET /me` - Get current user profile
- `PATCH /me` - Update profile
- `DELETE /me` - Delete account (DPDP Act compliance)

### Try-On
- `POST /tryon` - Generate try-on image (multipart/form-data)
- `GET /tryon/:id` - Get job status

### Products
- `POST /products/extract` - Extract product info from URL

### Credits & Payments
- `GET /credits/balance` - Get credits balance
- `GET /credits/history` - Get transaction history
- `POST /payments/create-order` - Create Razorpay order
- `POST /payments/verify` - Verify payment
- `POST /webhooks/razorpay` - Handle Razorpay webhooks

### Wardrobe
- `GET /wardrobe` - List saved items
- `POST /wardrobe/save` - Save try-on result
- `DELETE /wardrobe/:id` - Delete item

## Deployment

### Backend (Google Cloud Run)

1. Build and push Docker image:

```bash
cd apps/api
docker build -t gcr.io/your-project/mirrorx-api .
docker push gcr.io/your-project/mirrorx-api
```

2. Deploy to Cloud Run:

```bash
gcloud run deploy mirrorx-api \
  --image gcr.io/your-project/mirrorx-api \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars "DATABASE_URL=..." \
  --set-env-vars "JWT_SECRET=..." \
  --set-env-vars "GEMINI_API_KEY=..."
```

### Frontend (Vercel)

1. Connect your repository to Vercel

2. Configure build settings:
   - **Framework**: Vite
   - **Root Directory**: `apps/web`
   - **Build Command**: `pnpm build`
   - **Output Directory**: `dist`

3. Add environment variables:
   - `VITE_API_URL`: Your Cloud Run API URL
   - `VITE_GOOGLE_CLIENT_ID`: Google OAuth client ID
   - `VITE_RAZORPAY_KEY_ID`: Razorpay key ID

### Database (Supabase or Cloud SQL)

For production, use:
- **Supabase**: Managed Postgres with built-in auth
- **Cloud SQL**: Google Cloud managed database

## Testing

```bash
# Run API tests
pnpm test

# Run with coverage
cd apps/api && pnpm test --coverage
```

## Environment Variables Reference

### API (`apps/api/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `JWT_SECRET` | Secret for JWT signing (min 32 chars) | Yes |
| `JWT_EXPIRES_IN` | Token expiry (default: 7d) | No |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `RAZORPAY_KEY_ID` | Razorpay key ID | Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay secret | Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook signature secret | Yes |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GEMINI_TEXT_MODEL` | Text model (default: gemini-3-pro-preview) | No |
| `GEMINI_IMAGE_MODEL` | Image model (default: gemini-3-pro-image-preview) | No |

### Web (`apps/web/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | API base URL (empty for proxy) | No |
| `VITE_GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `VITE_RAZORPAY_KEY_ID` | Razorpay public key | Yes |

## Pricing Configuration

Configured in `packages/shared/src/types/index.ts`:

**Credit Packs:**
- Starter: ₹49 (20 credits)
- Basic: ₹99 (50 credits) - Best value
- Pro: ₹199 (120 credits)
- Elite: ₹499 (350 credits)

**Subscriptions:**
- Free: 5 try-ons/day
- Pro: ₹149/month - Unlimited
- Elite: ₹999/year - Unlimited + API access

## Security Considerations

- CORS locked to production domain
- Rate limiting on auth and try-on endpoints
- Helmet security headers
- Input validation with Zod
- Razorpay signature verification
- JWT token expiry
- DPDP Act compliant data deletion

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Email: support@mirrorx.co.in
- Business: business@mirrorx.co.in

---

Built with love in India
