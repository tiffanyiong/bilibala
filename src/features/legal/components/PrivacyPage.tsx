import React from 'react';

const PrivacyPage: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto px-4 pt-24 pb-12">
      <h1 className="text-3xl font-serif text-stone-800 mb-2">Privacy Policy</h1>
      <p className="text-sm text-stone-500 mb-8">Last Updated: February 8, 2026</p>

      <div className="prose prose-stone prose-sm max-w-none">
        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">1. Introduction</h2>
          <p className="text-stone-600 leading-relaxed">
            Welcome to <strong>Bilibala</strong> ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our web application <strong>Bilibala</strong> and use our services (the "Service").
          </p>
          <p className="text-stone-600 leading-relaxed mt-4">
            By accessing or using the Service, you agree to the collection and use of information in accordance with this policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">2. Information We Collect</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            We collect information that you provide to us directly, as well as data collected automatically when you use the Service.
          </p>

          <h3 className="text-lg font-medium text-stone-700 mb-3">A. Personal Information</h3>
          <p className="text-stone-600 leading-relaxed mb-2">
            When you register for an account or use our specific features, we may collect:
          </p>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Account Data:</strong> Your name, email address, and profile picture (provided via <strong>Google OAuth</strong> or email registration).</li>
            <li><strong>User Content:</strong> YouTube links you submit for analysis, vocabulary you save, study notes, and learning progress data.</li>
            <li><strong>Audio Data:</strong> Voice recordings made during "Speaking Practice" or "AI Live Tutor" sessions. These recordings are processed to provide pronunciation, intonation, and logic feedback.</li>
          </ul>

          <h3 className="text-lg font-medium text-stone-700 mb-3 mt-6">B. Payment Information</h3>
          <p className="text-stone-600 leading-relaxed">
            We use <strong>Stripe</strong> to process payments. We do not store your credit card details on our servers. All payment data is handled securely by Stripe in accordance with their privacy policy.
          </p>

          <h3 className="text-lg font-medium text-stone-700 mb-3 mt-6">C. Usage Data & Tracking</h3>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Log Data:</strong> Internet Protocol (IP) address, browser type, operating system, and access times.</li>
            <li><strong>Browser Fingerprinting:</strong> For non-logged-in (anonymous) users, we use browser fingerprinting technologies to enforce usage limits (e.g., the monthly free analysis limit). This generates a unique identifier for your device without collecting personally identifiable information.</li>
            <li><strong>Cookies:</strong> We use cookies to maintain your login session (via Supabase) and store your preferences.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">3. How We Use Your Information</h2>
          <p className="text-stone-600 leading-relaxed mb-2">We use the collected data for the following purposes:</p>
          <ol className="list-decimal pl-6 text-stone-600 space-y-2">
            <li><strong>To Provide the Service:</strong> Creating and managing your account, processing video analysis, and tracking your learning progress.</li>
            <li><strong>AI Analysis:</strong> Your text and audio inputs are sent to third-party AI providers (such as <strong>Google Gemini</strong>) to generate summaries, vocabulary lists, and logic feedback graphs.</li>
            <li><strong>Communication:</strong> Sending you weekly progress reports (if subscribed), service updates, security alerts, or responding to support inquiries.</li>
            <li><strong>Enforcement:</strong> Preventing abuse of the Service, such as bypassing free tier limits via anonymous usage tracking.</li>
          </ol>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">4. YouTube API Services</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            Our Service uses YouTube API Services to retrieve video metadata, transcripts, and content. By using Bilibala, you are agreeing to be bound by the{' '}
            <a href="https://www.youtube.com/t/terms" target="_blank" rel="noopener noreferrer" className="text-stone-800 underline hover:text-stone-600">
              YouTube Terms of Service
            </a>.
          </p>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li>We do not access your private YouTube account data (like private playlists, watch history, or likes) unless you explicitly grant such permissions.</li>
            <li>We utilize YouTube's API to display content but do not claim ownership of any video data.</li>
            <li>
              Please review the{' '}
              <a href="http://www.google.com/policies/privacy" target="_blank" rel="noopener noreferrer" className="text-stone-800 underline hover:text-stone-600">
                Google Privacy Policy
              </a>{' '}
              for more details on how Google handles data.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">5. Data Sharing and Third-Party Processors</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            We do not sell your personal data. We share data only with the following third-party service providers essential to our operation:
          </p>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Supabase:</strong> For database hosting, secure user authentication, and data storage.</li>
            <li><strong>Stripe:</strong> For payment processing and subscription management.</li>
            <li><strong>Google (Gemini/Vertex AI):</strong> For generating AI content, logic analysis, and feedback.</li>
            <li><strong>Resend:</strong> For sending transactional emails and weekly reports.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">6. Data Retention</h2>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>User Accounts:</strong> We retain your personal data as long as your account is active. You may request account deletion at any time.</li>
            <li><strong>Voice Recordings:</strong> Audio data is processed temporarily to generate feedback. We do not permanently store raw user audio files for public use or training purposes without your explicit consent.</li>
            <li><strong>Anonymous Usage:</strong> Fingerprint hashes are stored to enforce monthly limits and are reset or rotated periodically.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">7. Your Rights (GDPR & CCPA)</h2>
          <p className="text-stone-600 leading-relaxed mb-4">
            Depending on your location (including <strong>California</strong> and the EEA), you have specific rights regarding your personal data:
          </p>
          <ul className="list-disc pl-6 text-stone-600 space-y-2">
            <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Right to Correction:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to Deletion:</strong> Request deletion of your account and associated data.</li>
            <li><strong>Right to Opt-out:</strong> You may opt-out of marketing emails or weekly reports via the "Unsubscribe" link in our emails.</li>
          </ul>
          <p className="text-stone-600 leading-relaxed mt-4">
            To exercise these rights, please contact us at <strong>support@mybilibala.com</strong>.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">8. Children's Privacy</h2>
          <p className="text-stone-600 leading-relaxed">
            Our Service is not intended for use by children under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected personal information from a child under 13, we will take steps to delete such information.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">9. Security</h2>
          <p className="text-stone-600 leading-relaxed">
            We implement industry-standard security measures (including encryption in transit and at rest via Supabase) to protect your data. However, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">10. Changes to This Policy</h2>
          <p className="text-stone-600 leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date at the top of this policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-stone-800 mb-4">11. Contact Us</h2>
          <p className="text-stone-600 leading-relaxed">
            If you have any questions about this Privacy Policy, please contact us:
          </p>
          <p className="text-stone-600 leading-relaxed mt-2">
            <strong>By email:</strong> support@mybilibala.com
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;
