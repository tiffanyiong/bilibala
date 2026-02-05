import React from 'react';

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
      <h1 className="text-3xl font-serif text-stone-800 mb-2">Terms of Service</h1>
      <p className="text-sm text-stone-500 mb-8">Last Updated: February 5, 2026</p>

      <div className="prose prose-stone prose-sm max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">1. Acceptance of Terms</h2>
          <p className="text-stone-600 leading-relaxed">
            By accessing or using the web application <strong>Bilibala</strong> ("Service," "we," "us," or "our"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, you must not access or use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">2. Description of Service</h2>
          <p className="text-stone-600 leading-relaxed">
            Bilibala is an AI-powered language learning platform that analyzes third-party video content (e.g., from YouTube) to provide logic structure analysis, vocabulary translation, and pronunciation feedback. The Service includes features such as "AI Live Tutor," "Logic Graph Analysis," and "Speaking Practice."
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">3. User Accounts</h2>
          <ol className="list-decimal pl-6 text-stone-600 space-y-3">
            <li>
              <strong>Registration:</strong> To access certain features, you may register for an account using your <strong>email address</strong> or through a third-party authentication service (e.g., <strong>Google OAuth</strong>). You agree to provide accurate, current, and complete information during the registration process.
            </li>
            <li>
              <strong>Security:</strong> You are responsible for maintaining the confidentiality of your account credentials, including your password or email access. You accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
            </li>
            <li>
              <strong>Anonymous Usage:</strong> We may allow limited access to the Service without registration. We reserve the right to restrict this access using browser fingerprinting technologies to prevent abuse.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">4. YouTube API Services</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            Our Service uses YouTube API Services to display video content and transcripts.
          </p>
          <ol className="list-decimal pl-6 text-stone-600 space-y-2">
            <li>
              By using the Service, you agree to be bound by the{' '}
              <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-stone-800 underline hover:text-stone-600">
                YouTube Terms of Service
              </a>.
            </li>
            <li>You acknowledge that Bilibala does not own the video content displayed and that all rights to such content belong to the respective content creators and YouTube.</li>
            <li>
              Please review the{' '}
              <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer" className="text-stone-800 underline hover:text-stone-600">
                Google Privacy Policy
              </a>.
            </li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">5. Subscriptions and Payments</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            We use <strong>Stripe</strong> as our third-party payment processor. By subscribing, you agree to Stripe's terms and privacy policy.
          </p>

          <h3 className="text-lg font-medium text-stone-700 mb-3">5.1. Pro Subscription</h3>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Billing Cycle:</strong> The Pro plan is billed in advance on a monthly or annual basis.</li>
            <li><strong>Automatic Renewal:</strong> Your subscription will automatically renew at the end of each billing cycle unless you cancel it at least 24 hours before the renewal date.</li>
            <li>
              <strong>Cancellation:</strong> You may cancel your subscription at any time via the "Billing" section in your Dashboard.
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Effect of Cancellation:</strong> Cancellation will stop the <em>next</em> auto-renewal charge. You will retain access to Pro features until the end of your current billing period.</li>
                <li><strong>No Partial Refunds:</strong> Except as provided in Section 5.2 below, <strong>we do not provide refunds or credits for any partial subscription periods</strong> or unused time. For example, if you cancel an Annual subscription after 3 months, you will not receive a refund for the remaining 9 months, but you will continue to have access for the remainder of the year.</li>
              </ul>
            </li>
          </ul>

          <h3 className="text-lg font-medium text-stone-700 mb-3 mt-6">5.2. 7-Day Money-Back Guarantee (Annual Plans Only)</h3>
          <p className="text-stone-600 leading-relaxed mb-2">
            We want you to be satisfied with Bilibala. If you subscribe to the <strong>Annual Plan</strong> for the first time, you are eligible for a full refund if you contact us within <strong>seven (7) calendar days</strong> of your initial purchase.
          </p>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li>To request a refund, please email <strong>support@bilibala.app</strong>.</li>
            <li>This guarantee applies only to the first year of an Annual subscription and does not apply to Monthly subscriptions or renewal charges.</li>
          </ul>

          <h3 className="text-lg font-medium text-stone-700 mb-3 mt-6">5.3. One-Time Purchases</h3>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Final Sale:</strong> "Starter Packs" ($5) and "AI Tutor Top-ups" ($3) are non-recurring, one-time purchases. They are <strong>final and non-refundable</strong> once the credits have been applied to your account.</li>
            <li><strong>Credit Expiry:</strong> Credits purchased via Top-ups do not expire as long as your account remains active, unless otherwise stated at the time of purchase.</li>
          </ul>

          <h3 className="text-lg font-medium text-stone-700 mb-3 mt-6">5.4. Price Changes</h3>
          <p className="text-stone-600 leading-relaxed">
            We reserve the right to adjust pricing for our Service at any time. Any price changes to your recurring subscription will take effect following email notice to you, giving you the option to cancel before the new price is applied.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">6. AI Disclaimer</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            The Service utilizes Artificial Intelligence (AI) technologies (including Google Gemini) to generate feedback, translations, and logic graphs.
          </p>
          <ol className="list-decimal pl-6 text-stone-600 space-y-2">
            <li><strong>Accuracy:</strong> AI is not perfect and may generate incorrect, misleading, or nonsensical information ("hallucinations"). You should not rely on the Service as the sole source of truth for language learning or professional translation.</li>
            <li><strong>No Professional Advice:</strong> The Service is for educational purposes only and does not constitute professional linguistic or career advice.</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">7. Acceptable Use</h2>
          <p className="text-stone-600 leading-relaxed mb-2">You agree not to:</p>
          <ol className="list-decimal pl-6 text-stone-600 space-y-2">
            <li>Use the Service for any illegal purpose.</li>
            <li>Attempt to circumvent any usage limits (e.g., using multiple devices or scripts to bypass the 3-video limit on the Free tier).</li>
            <li>Scrape, harvest, or extract data from the Service using automated means.</li>
            <li>Share your account credentials with others to split a subscription.</li>
          </ol>
          <p className="text-stone-600 leading-relaxed mt-4">
            We reserve the right to <strong>terminate or suspend your account immediately</strong>, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">8. Intellectual Property</h2>
          <ol className="list-decimal pl-6 text-stone-600 space-y-2">
            <li><strong>Our IP:</strong> The Service and its original content (excluding User Content and YouTube videos), features, and functionality (including the "Logic Graph" visualization code) are and will remain the exclusive property of Bilibala.</li>
            <li><strong>User Content:</strong> You retain rights to the audio recordings you submit. However, you grant us a worldwide, non-exclusive license to process these recordings to provide you with feedback.</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">9. Limitation of Liability</h2>
          <p className="text-stone-600 leading-relaxed uppercase text-xs">
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, BILIBALA SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM (A) YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">10. Governing Law</h2>
          <p className="text-stone-600 leading-relaxed">
            These Terms shall be governed and construed in accordance with the laws of <strong>California, United States</strong>, without regard to its conflict of law provisions. Any disputes arising from these Terms or the Service shall be resolved in the state or federal courts located in <strong>Santa Clara County, California</strong>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">11. Contact Us</h2>
          <p className="text-stone-600 leading-relaxed">
            If you have any questions about these Terms, please contact us at:
          </p>
          <p className="text-stone-600 leading-relaxed mt-2">
            <strong>support@bilibala.app</strong>
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;
