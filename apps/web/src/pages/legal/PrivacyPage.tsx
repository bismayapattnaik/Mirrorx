import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PrivacyPage() {
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
        <h1 className="text-3xl font-orbitron font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground">
              MirrorX (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information
              when you use our virtual try-on platform at mirrorx.co.in.
            </p>
            <p className="text-muted-foreground mt-4">
              This policy complies with the Digital Personal Data Protection Act, 2023 (DPDP Act) of India.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">2. Information We Collect</h2>
            <h3 className="font-semibold mt-4 mb-2">Personal Information</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Email address (for account creation and communication)</li>
              <li>Name (optional, for personalization)</li>
              <li>Phone number (optional, for account recovery)</li>
              <li>Profile picture/avatar</li>
              <li>Google account information (if using Google sign-in)</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Images uploaded for virtual try-on (processed and stored temporarily)</li>
              <li>Try-on results saved to your wardrobe</li>
              <li>Transaction and payment history</li>
              <li>Usage patterns and preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>To provide and maintain our virtual try-on service</li>
              <li>To process your transactions and manage your account</li>
              <li>To generate AI-powered try-on images</li>
              <li>To improve our AI models and service quality</li>
              <li>To communicate with you about your account and updates</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">4. Data Storage and Security</h2>
            <p className="text-muted-foreground">
              Your data is stored on secure servers with encryption at rest and in transit.
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>SSL/TLS encryption for all data transmission</li>
              <li>Encrypted database storage</li>
              <li>Regular security audits</li>
              <li>Access controls and authentication</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">5. Image Data Processing</h2>
            <p className="text-muted-foreground">
              Images you upload are processed by our AI system to generate try-on previews.
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Uploaded images are processed in real-time and may be temporarily cached</li>
              <li>Generated try-on images are stored only if you save them to your wardrobe</li>
              <li>You can delete any saved images at any time</li>
              <li>We do not use your images for AI training without explicit consent</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">6. Your Rights (DPDP Act Compliance)</h2>
            <p className="text-muted-foreground">Under the DPDP Act, you have the right to:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Withdraw consent for data processing</li>
              <li>Data portability</li>
              <li>Grievance redressal</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              To exercise these rights, visit your Account settings or contact us at privacy@facefit.co.in
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">7. Data Retention</h2>
            <p className="text-muted-foreground">
              We retain your data for as long as your account is active. Upon account deletion:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Personal data is deleted within 30 days</li>
              <li>Wardrobe images are permanently deleted</li>
              <li>Transaction records are retained for 7 years (legal requirement)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">8. Third-Party Services</h2>
            <p className="text-muted-foreground">We use the following third-party services:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Google Cloud (AI processing and hosting)</li>
              <li>Razorpay (payment processing)</li>
              <li>Google OAuth (authentication)</li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Each service has its own privacy policy. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">9. Contact Us</h2>
            <p className="text-muted-foreground">
              For privacy-related inquiries or to exercise your rights:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Email: privacy@facefit.co.in</li>
              <li>Data Protection Officer: dpo@facefit.co.in</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
