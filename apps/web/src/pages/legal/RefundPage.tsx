import { Link } from 'react-router-dom';
import { Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RefundPage() {
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
        <h1 className="text-3xl font-orbitron font-bold mb-2">Refund Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: January 2026</p>

        <div className="prose prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">1. Credit Pack Refunds</h2>
            <p className="text-muted-foreground">
              Credits purchased on MirrorX are generally non-refundable. However, we may
              consider refunds in the following cases:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>
                <strong>Technical Issues:</strong> If our service experiences significant
                technical problems preventing you from using purchased credits within 7 days
                of purchase
              </li>
              <li>
                <strong>Duplicate Charges:</strong> If you were charged multiple times for
                the same transaction
              </li>
              <li>
                <strong>Within 24 Hours:</strong> Full refund if credits have not been used
                and requested within 24 hours of purchase
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">2. Subscription Refunds</h2>
            <h3 className="font-semibold mt-4 mb-2">Pro Monthly Subscription</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Cancel anytime to prevent future charges</li>
              <li>No partial refunds for unused portion of the month</li>
              <li>Access continues until the end of the billing period</li>
            </ul>

            <h3 className="font-semibold mt-4 mb-2">Elite Yearly Subscription</h3>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>
                <strong>Within 7 days:</strong> Full refund if service has been used fewer
                than 10 times
              </li>
              <li>
                <strong>After 7 days:</strong> Pro-rated refund may be considered on a
                case-by-case basis
              </li>
              <li>
                <strong>After 30 days:</strong> No refunds will be issued
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">3. Non-Refundable Items</h2>
            <p className="text-muted-foreground">The following are NOT eligible for refunds:</p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Credits that have already been used</li>
              <li>Subscription periods that have been fully utilized</li>
              <li>Accounts terminated for Terms of Service violations</li>
              <li>Credits remaining when you delete your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">4. How to Request a Refund</h2>
            <p className="text-muted-foreground">To request a refund:</p>
            <ol className="list-decimal list-inside text-muted-foreground space-y-2 mt-4">
              <li>Email support@mirrorx.co.in with subject &quot;Refund Request&quot;</li>
              <li>Include your registered email address</li>
              <li>Provide the transaction ID or order number</li>
              <li>Explain the reason for your refund request</li>
            </ol>
            <p className="text-muted-foreground mt-4">
              We will respond within 3-5 business days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">5. Refund Processing</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>Approved refunds are processed within 7-10 business days</li>
              <li>Refunds are issued to the original payment method</li>
              <li>Bank processing times may add additional days</li>
              <li>You will receive email confirmation once processed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">6. Chargebacks</h2>
            <p className="text-muted-foreground">
              If you file a chargeback with your bank instead of contacting us:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Your account may be suspended pending investigation</li>
              <li>Additional fees may apply</li>
              <li>We recommend contacting us first to resolve issues</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">7. Service Guarantees</h2>
            <p className="text-muted-foreground">
              While we strive to provide the best service:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>AI-generated results are previews and may vary from actual products</li>
              <li>We do not guarantee satisfaction with third-party products</li>
              <li>Technical issues will be addressed but may not always qualify for refunds</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-gold mb-4">8. Contact</h2>
            <p className="text-muted-foreground">
              For refund-related questions or to submit a request:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 mt-4">
              <li>Email: support@mirrorx.co.in</li>
              <li>Response time: 3-5 business days</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
