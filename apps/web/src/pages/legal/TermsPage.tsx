import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-midnight">
      <nav className="glass sticky top-0 z-50">
        <div className="container max-w-container mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gold-gradient rounded-lg flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="font-orbitron text-xl font-bold text-gold">MirrorX</span>
          </Link>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </nav>

      <div className="container max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-orbitron font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground">
              By accessing or using MirrorX (&quot;the Service&quot;), you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use our service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground">
              MirrorX provides an AI-powered virtual try-on platform that allows users to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Upload photos and visualize themselves wearing different outfits</li>
              <li>Extract product information from supported e-commerce sites</li>
              <li>Save and manage a virtual wardrobe</li>
              <li>Access AI styling recommendations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">3. Account Registration</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>You must provide accurate and complete information during registration</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must be at least 18 years old to use the Service</li>
              <li>One person may not maintain multiple accounts</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">4. Credits and Payments</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Credits are required for generating try-on images beyond the daily free limit</li>
              <li>Credits are non-transferable and non-refundable except as stated in our Refund Policy</li>
              <li>Subscription fees are billed in advance on a recurring basis</li>
              <li>All prices are in Indian Rupees (INR) and include applicable taxes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">5. Acceptable Use</h2>
            <p className="text-muted-foreground">You agree NOT to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Upload images of minors or without consent of the person depicted</li>
              <li>Upload inappropriate, illegal, or offensive content</li>
              <li>Use the service for fraudulent or deceptive purposes</li>
              <li>Attempt to reverse engineer or exploit our AI systems</li>
              <li>Circumvent usage limits or security measures</li>
              <li>Resell or redistribute generated content commercially without permission</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">6. Intellectual Property</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>You retain rights to images you upload</li>
              <li>Generated try-on images are for personal, non-commercial use</li>
              <li>MirrorX branding, logos, and AI technology remain our property</li>
              <li>Product images belong to their respective owners</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">7. AI-Generated Content Disclaimer</h2>
            <p className="text-muted-foreground">
              Our AI system generates visualizations that are intended as previews only:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Results may not perfectly represent actual fit or appearance</li>
              <li>Colors may vary from actual products</li>
              <li>We do not guarantee purchase satisfaction based on try-on previews</li>
              <li>Product availability and prices are determined by third-party retailers</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground">
              To the maximum extent permitted by law, MirrorX shall not be liable for:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Indirect, incidental, or consequential damages</li>
              <li>Loss of data or business interruption</li>
              <li>Actions taken based on AI-generated content</li>
              <li>Third-party product quality or disputes</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">9. Termination</h2>
            <p className="text-muted-foreground">
              We may suspend or terminate your account if you violate these terms.
              You may delete your account at any time through your account settings.
              Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">10. Governing Law</h2>
            <p className="text-muted-foreground">
              These terms are governed by the laws of India. Any disputes shall be subject
              to the exclusive jurisdiction of courts in Bangalore, Karnataka.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">11. Contact</h2>
            <p className="text-muted-foreground">
              For questions about these terms, contact us at legal@mirrorx.co.in
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
