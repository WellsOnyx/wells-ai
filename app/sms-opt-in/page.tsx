/**
 * SMS Opt-In Page
 * Required for Twilio toll-free verification
 */

export default function SmsOptInPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Wells Onyx SMS Notifications
          </h1>
          <p className="text-lg text-gray-600">
            Opt-in to receive important updates about procurement, quotes, and orders
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            How SMS Notifications Work
          </h2>

          <div className="space-y-4 text-gray-700">
            <p>
              Wells Onyx sends SMS notifications to suppliers and partners to keep you informed about:
            </p>

            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>New procurement requests (RFQs)</li>
              <li>Quote deadlines and reminders</li>
              <li>Purchase order updates</li>
              <li>Payment confirmations</li>
              <li>Important account notifications</li>
            </ul>

            <p className="mt-6">
              <strong>Message Frequency:</strong> You'll receive messages as needed based on your active procurement activities. Typical volume: 2-10 messages per month.
            </p>

            <p>
              <strong>Message & Data Rates:</strong> Standard messaging and data rates may apply based on your mobile carrier plan.
            </p>
          </div>
        </div>

        <div className="bg-blue-50 border-l-4 border-blue-500 p-6 mb-8">
          <h2 className="text-xl font-semibold text-blue-900 mb-3">
            How to Opt-In
          </h2>

          <div className="space-y-3 text-blue-800">
            <p>
              <strong>Method 1:</strong> When you provide your phone number during Wells Onyx onboarding or supplier registration, you automatically opt-in to SMS notifications.
            </p>

            <p>
              <strong>Method 2:</strong> Text any message to our SMS number (provided in your welcome email) to confirm opt-in.
            </p>

            <p>
              <strong>Method 3:</strong> Reply to any Wells Onyx SMS with "1" to confirm receipt and maintain your subscription.
            </p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Your Rights & Controls
          </h2>

          <div className="space-y-4 text-gray-700">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Opt-Out Anytime</h3>
              <p>
                Reply <strong>STOP</strong> to any Wells Onyx SMS to immediately unsubscribe from all future messages.
                You'll receive a confirmation that you've been unsubscribed.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Get Help</h3>
              <p>
                Reply <strong>HELP</strong> to any Wells Onyx SMS to receive support information, including:
              </p>
              <ul className="list-disc list-inside ml-4 mt-2">
                <li>Contact information</li>
                <li>How to unsubscribe</li>
                <li>Support resources</li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Contact Us</h3>
              <p>
                For questions or concerns about SMS notifications:
              </p>
              <ul className="list-none ml-4 mt-2 space-y-1">
                <li><strong>Email:</strong> jonah@wellsonyx.com</li>
                <li><strong>Phone:</strong> 850-459-1961</li>
                <li><strong>Website:</strong> <a href="https://wellsonyx.com" className="text-blue-600 hover:underline">wellsonyx.com</a></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-6 mb-8">
          <h2 className="text-xl font-semibold text-yellow-900 mb-3">
            Privacy & Data Protection
          </h2>

          <div className="space-y-3 text-yellow-800">
            <p>
              Wells Onyx takes your privacy seriously:
            </p>

            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>We never share your phone number with third parties for marketing purposes</li>
              <li>Your phone number is only used for transactional procurement notifications</li>
              <li>We comply with TCPA (Telephone Consumer Protection Act) regulations</li>
              <li>All messages are secure and encrypted in transit</li>
              <li>You can request deletion of your phone number at any time</li>
            </ul>

            <p className="mt-4">
              Read our full <a href="/privacy" className="text-yellow-900 font-semibold hover:underline">Privacy Policy</a> and{' '}
              <a href="/terms" className="text-yellow-900 font-semibold hover:underline">Terms of Service</a>.
            </p>
          </div>
        </div>

        <div className="bg-green-50 border-l-4 border-green-500 p-6">
          <h2 className="text-xl font-semibold text-green-900 mb-3">
            Sample Messages
          </h2>

          <div className="space-y-4 text-green-800">
            <div className="bg-white p-4 rounded border border-green-200">
              <p className="font-mono text-sm">
                Wells Onyx: New RFQ #1234 - Circuit Boards (Qty: 500). Quote due: Nov 5. Reply: 1=View Details | 2=Pass
              </p>
            </div>

            <div className="bg-white p-4 rounded border border-green-200">
              <p className="font-mono text-sm">
                Wells Onyx: Quote #5678 approved! PO #9012 issued. Total: $12,500. Expected delivery: Nov 15.
              </p>
            </div>

            <div className="bg-white p-4 rounded border border-green-200">
              <p className="font-mono text-sm">
                Wells Onyx: Payment processed for PO #9012. $12,500 sent via ACH. Expected in 2-3 business days.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            By providing your phone number to Wells Onyx, you consent to receive SMS notifications as described above.
          </p>
          <p className="mt-2">
            Last updated: October 30, 2025
          </p>
        </div>
      </div>
    </div>
  )
}
