/**
 * Resend Email Integration
 *
 * Handles email notifications via Resend for viral payments, claims, and alerts
 */

import { Resend } from 'resend';

// Types
export interface EmailResult {
  success: boolean;
  emailId?: string;
  error?: string;
}

export interface PaymentEmailData {
  email: string;
  amount: number;
  senderName: string;
  senderCompany?: string;
  claimUrl: string;
  expiresAt: string;
  memo?: string;
}

export interface ClaimEmailData {
  email: string;
  amount: number;
  walletBalance: number;
  senderName?: string;
}

export interface CreditApprovalEmailData {
  email: string;
  name?: string;
  amount: number;
  apr: number;
  availableCredit: number;
  transactionAmount: number;
}

// Initialize Resend client
let resendClient: Resend | null = null;

function getResendClient(): Resend {
  if (!resendClient) {
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    resendClient = new Resend(apiKey);
  }

  return resendClient;
}

// Default from email
const FROM_EMAIL = process.env.FROM_EMAIL || 'Wells Onyx <notifications@wellsonyx.io>';

/**
 * Send a basic email
 */
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string,
  options?: {
    from?: string;
    replyTo?: string;
    cc?: string[];
    bcc?: string[];
    tags?: Record<string, string>;
  }
): Promise<EmailResult> {
  try {
    const client = getResendClient();

    const response = await client.emails.send({
      from: options?.from || FROM_EMAIL,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      reply_to: options?.replyTo,
      cc: options?.cc,
      bcc: options?.bcc,
      tags: options?.tags ? Object.entries(options.tags).map(([name, value]) => ({ name, value })) : undefined,
    });

    console.log(`Email sent to ${to}: ${response.id}`);

    return {
      success: true,
      emailId: response.id,
    };
  } catch (error) {
    console.error('Error sending email:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send payment notification email
 *
 * Beautiful HTML email with clear CTA to claim payment
 */
export async function sendPaymentNotification(
  data: PaymentEmailData
): Promise<EmailResult> {
  const { email, amount, senderName, senderCompany, claimUrl, expiresAt, memo } = data;

  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const expiresDate = new Date(expiresAt);
  const expiresInDays = Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  const subject = `You have ${formattedAmount} waiting from ${senderName}`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">💰</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">You've Got Money!</h1>
      <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">
        ${senderName}${senderCompany ? ` from ${senderCompany}` : ''} sent you a payment
      </p>
    </div>

    <!-- Amount Card -->
    <div style="background: white; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Amount
        </div>
        <div style="font-size: 56px; font-weight: 700; color: #111827; line-height: 1;">
          ${formattedAmount}
        </div>
      </div>

      ${memo ? `
      <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-left: 4px solid #667eea;">
        <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Note from ${senderName}
        </div>
        <div style="color: #374151; font-size: 15px; line-height: 1.6;">
          ${memo}
        </div>
      </div>
      ` : ''}

      <!-- CTA Button -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
          Claim Your Money
        </a>
      </div>

      <!-- Expiration Warning -->
      <div style="background: #fef3c7; border: 1px solid #fbbf24; padding: 16px 20px; border-radius: 8px; margin-top: 30px;">
        <div style="display: flex; align-items: center;">
          <div style="font-size: 24px; margin-right: 12px;">⏰</div>
          <div>
            <div style="font-weight: 600; color: #92400e; font-size: 14px;">
              Expires in ${expiresInDays} days
            </div>
            <div style="color: #78350f; font-size: 13px; margin-top: 4px;">
              Claim before ${expiresDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- What is Wells Onyx -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h3 style="margin: 0 0 15px 0; font-size: 16px; color: #111827;">What is Wells Onyx?</h3>
      <p style="margin: 0; color: #6b7280; font-size: 14px; line-height: 1.6;">
        Wells Onyx is a modern payments platform that makes sending and receiving money instant and free.
        When you claim this payment, you'll automatically get a Wells Onyx account with:
      </p>
      <ul style="margin: 15px 0 0 0; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.8;">
        <li><strong>Instant access</strong> to your money</li>
        <li><strong>Free payments</strong> to anyone</li>
        <li><strong>Instant credit line</strong> (based on this transaction)</li>
        <li><strong>No fees, no subscriptions</strong></li>
      </ul>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 13px;">
      <p style="margin: 0 0 10px 0;">
        Claim link: <a href="${claimUrl}" style="color: #667eea; text-decoration: none;">${claimUrl}</a>
      </p>
      <p style="margin: 0;">
        Questions? Reply to this email or visit <a href="https://wellsonyx.io/support" style="color: #667eea; text-decoration: none;">wellsonyx.io/support</a>
      </p>
      <p style="margin: 15px 0 0 0; font-size: 12px;">
        © ${new Date().getFullYear()} Wells Onyx. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html, {
    tags: {
      type: 'payment_notification',
      amount: amount.toString(),
    },
  });
}

/**
 * Send claim confirmation email
 */
export async function sendClaimConfirmation(
  data: ClaimEmailData
): Promise<EmailResult> {
  const { email, amount, walletBalance, senderName } = data;

  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  const formattedBalance = walletBalance.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  const subject = `${formattedAmount} claimed successfully!`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Success Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">✅</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Payment Claimed!</h1>
      <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">
        ${formattedAmount} is now in your Wells Onyx wallet
      </p>
    </div>

    <!-- Balance Card -->
    <div style="background: white; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="color: #6b7280; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Your Balance
        </div>
        <div style="font-size: 48px; font-weight: 700; color: #111827; line-height: 1;">
          ${formattedBalance}
        </div>
      </div>

      <div style="background: #f0fdf4; border: 1px solid #86efac; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
        <div style="color: #166534; font-size: 15px; line-height: 1.6;">
          ${senderName ? `<strong>${senderName}'s payment</strong> has been added to your wallet.` : 'Payment has been added to your wallet.'}
          You can now send payments, request credit, or cash out.
        </div>
      </div>

      <!-- Next Steps -->
      <h3 style="margin: 30px 0 15px 0; font-size: 18px; color: #111827;">What's Next?</h3>

      <div style="margin-bottom: 15px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/send" style="display: block; background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; text-decoration: none; color: inherit;">
          <div style="font-weight: 600; color: #111827; font-size: 16px; margin-bottom: 4px;">
            💸 Send Money
          </div>
          <div style="color: #6b7280; font-size: 14px;">
            Send instant, free payments to anyone
          </div>
        </a>
      </div>

      <div style="margin-bottom: 15px;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/credit" style="display: block; background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; text-decoration: none; color: inherit;">
          <div style="font-weight: 600; color: #111827; font-size: 16px; margin-bottom: 4px;">
            🎯 Get Instant Credit
          </div>
          <div style="color: #6b7280; font-size: 14px;">
            Access credit line based on your transaction history
          </div>
        </a>
      </div>

      <div>
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" style="display: block; background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; text-decoration: none; color: inherit;">
          <div style="font-weight: 600; color: #111827; font-size: 16px; margin-bottom: 4px;">
            📊 View Dashboard
          </div>
          <div style="color: #6b7280; font-size: 14px;">
            See all your transactions and insights
          </div>
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; text-align: center;">
      <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Questions? Visit <a href="https://wellsonyx.io/support" style="color: #667eea; text-decoration: none;">wellsonyx.io/support</a>
      </div>
      <div style="margin-top: 20px; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Wells Onyx. All rights reserved.
      </div>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html, {
    tags: {
      type: 'claim_confirmation',
      amount: amount.toString(),
    },
  });
}

/**
 * Send welcome email for new users
 */
export async function sendWelcomeEmail(
  email: string,
  name?: string
): Promise<EmailResult> {
  const subject = `Welcome to Wells Onyx${name ? `, ${name}` : ''}!`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Header -->
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">👋</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Welcome to Wells Onyx!</h1>
      <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">
        Modern payments built for the future
      </p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        ${name ? `Hi ${name},` : 'Hello!'}
      </p>
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        Welcome to Wells Onyx! You're now part of a modern payments platform that makes sending and receiving money instant, free, and effortless.
      </p>

      <h3 style="margin: 30px 0 15px 0; font-size: 18px; color: #111827;">What You Can Do:</h3>

      <ul style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.8;">
        <li><strong>Send instant payments</strong> to anyone, anywhere - no fees</li>
        <li><strong>Receive money</strong> directly to your Wells Onyx wallet</li>
        <li><strong>Access instant credit</strong> based on your transaction history</li>
        <li><strong>Track everything</strong> in one beautiful dashboard</li>
      </ul>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/dashboard" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(102, 126, 234, 0.4);">
          Go to Dashboard
        </a>
      </div>

      <div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 20px; border-radius: 4px; margin-top: 30px;">
        <div style="font-weight: 600; color: #1e40af; margin-bottom: 8px;">
          💡 Pro Tip
        </div>
        <div style="color: #1e3a8a; font-size: 14px; line-height: 1.6;">
          Every payment you send earns you a 0.1% bonus. The more you use Wells Onyx, the more you earn!
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 13px;">
      <p style="margin: 0;">
        Questions? Visit <a href="https://wellsonyx.io/support" style="color: #667eea; text-decoration: none;">wellsonyx.io/support</a>
      </p>
      <p style="margin: 15px 0 0 0; font-size: 12px;">
        © ${new Date().getFullYear()} Wells Onyx. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html, {
    tags: {
      type: 'welcome',
    },
  });
}

/**
 * Send credit approval email
 */
export async function sendCreditApproval(
  data: CreditApprovalEmailData
): Promise<EmailResult> {
  const { email, name, amount, apr, availableCredit, transactionAmount } = data;

  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });

  const formattedAvailable = availableCredit.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  });

  const aprPercent = (apr * 100).toFixed(1);

  const subject = `You're approved for ${formattedAmount} credit!`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Success Header -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">🎉</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Credit Approved!</h1>
      <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">
        You've been approved for instant credit
      </p>
    </div>

    <!-- Credit Details -->
    <div style="background: white; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb;">
      <p style="margin: 0 0 30px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        ${name ? `Congrats ${name}! ` : 'Congratulations! '}Based on your ${transactionAmount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })} transaction, we've approved you for instant credit.
      </p>

      <!-- Credit Amount -->
      <div style="text-align: center; margin-bottom: 30px; background: #f0fdf4; padding: 30px; border-radius: 12px; border: 2px solid #86efac;">
        <div style="color: #166534; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
          Credit Line
        </div>
        <div style="font-size: 56px; font-weight: 700; color: #166534; line-height: 1;">
          ${formattedAmount}
        </div>
        <div style="color: #166534; font-size: 16px; margin-top: 8px;">
          ${formattedAvailable} available now
        </div>
      </div>

      <!-- Terms -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px;">
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
            APR
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #111827;">
            ${aprPercent}%
          </div>
        </div>
        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-bottom: 8px;">
            Monthly Fee
          </div>
          <div style="font-size: 32px; font-weight: 700; color: #111827;">
            $0
          </div>
        </div>
      </div>

      <!-- CTA -->
      <div style="text-align: center; margin: 35px 0;">
        <a href="${process.env.NEXT_PUBLIC_BASE_URL}/credit" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(16, 185, 129, 0.4);">
          Access Your Credit
        </a>
      </div>

      <!-- How It Works -->
      <h3 style="margin: 30px 0 15px 0; font-size: 18px; color: #111827;">How It Works:</h3>
      <ol style="margin: 0; padding-left: 20px; color: #374151; font-size: 15px; line-height: 1.8;">
        <li>Use your credit for payments or transfers</li>
        <li>Pay back within 30 days for free</li>
        <li>Or pay over time at ${aprPercent}% APR</li>
        <li>Your limit grows as you use Wells Onyx</li>
      </ol>
    </div>

    <!-- Footer -->
    <div style="background: white; padding: 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px; text-align: center;">
      <div style="color: #6b7280; font-size: 13px; line-height: 1.6;">
        Questions about your credit line? Visit <a href="https://wellsonyx.io/credit-faq" style="color: #667eea; text-decoration: none;">wellsonyx.io/credit-faq</a>
      </div>
      <div style="margin-top: 20px; color: #9ca3af; font-size: 12px;">
        © ${new Date().getFullYear()} Wells Onyx. All rights reserved.
      </div>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html, {
    tags: {
      type: 'credit_approval',
      amount: amount.toString(),
      apr: aprPercent,
    },
  });
}

/**
 * Send payment reminder email (for unclaimed payments)
 */
export async function sendPaymentReminder(
  email: string,
  amount: number,
  senderName: string,
  claimUrl: string,
  daysRemaining: number
): Promise<EmailResult> {
  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  const subject = `Reminder: ${formattedAmount} from ${senderName} expires in ${daysRemaining} days`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f3f4f6;">
  <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">

    <!-- Warning Header -->
    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; padding: 40px 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 10px;">⏰</div>
      <h1 style="margin: 0; font-size: 28px; font-weight: 700;">Payment Expiring Soon!</h1>
      <p style="margin: 15px 0 0 0; font-size: 18px; opacity: 0.95;">
        Don't lose your ${formattedAmount}
      </p>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 40px 30px; border-left: 1px solid #e5e7eb; border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <p style="margin: 0 0 20px 0; color: #374151; font-size: 16px; line-height: 1.6;">
        This is a reminder that <strong>${senderName}</strong> sent you <strong>${formattedAmount}</strong>.
      </p>

      <div style="background: #fef3c7; border: 2px solid #fbbf24; padding: 20px; border-radius: 8px; margin: 25px 0;">
        <div style="font-weight: 700; color: #92400e; font-size: 18px; margin-bottom: 8px;">
          ⚠️ Expires in ${daysRemaining} days
        </div>
        <div style="color: #78350f; font-size: 14px;">
          Claim your money now before it's returned to the sender.
        </div>
      </div>

      <div style="text-align: center; margin: 35px 0;">
        <a href="${claimUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 18px 48px; border-radius: 8px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 14px rgba(245, 158, 11, 0.4);">
          Claim Now
        </a>
      </div>

      <p style="margin: 20px 0 0 0; color: #6b7280; font-size: 14px; text-align: center;">
        Link: <a href="${claimUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">${claimUrl}</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="text-align: center; margin-top: 30px; padding: 20px; color: #9ca3af; font-size: 13px;">
      <p style="margin: 0;">
        Questions? Visit <a href="https://wellsonyx.io/support" style="color: #667eea; text-decoration: none;">wellsonyx.io/support</a>
      </p>
      <p style="margin: 15px 0 0 0; font-size: 12px;">
        © ${new Date().getFullYear()} Wells Onyx. All rights reserved.
      </p>
    </div>

  </div>
</body>
</html>
  `;

  return sendEmail(email, subject, html, {
    tags: {
      type: 'payment_reminder',
      amount: amount.toString(),
      days_remaining: daysRemaining.toString(),
    },
  });
}

/**
 * Send bulk emails (with rate limiting)
 */
export async function sendBulkEmails(
  emails: Array<{
    to: string;
    subject: string;
    html: string;
  }>,
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<EmailResult[]> {
  const { batchSize = 50, delayMs = 1000 } = options || {};
  const results: EmailResult[] = [];

  // Process in batches
  for (let i = 0; i < emails.length; i += batchSize) {
    const batch = emails.slice(i, i + batchSize);

    // Send batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(({ to, subject, html }) => sendEmail(to, subject, html))
    );

    // Collect results
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          success: false,
          error: result.reason?.message || 'Unknown error',
        });
      }
    });

    // Delay between batches (except for last batch)
    if (i + batchSize < emails.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
