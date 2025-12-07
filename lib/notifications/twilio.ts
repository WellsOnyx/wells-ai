/**
 * Twilio SMS Integration
 *
 * Handles SMS notifications via Twilio for viral payments, claims, and alerts
 */

import twilio from 'twilio';

// Types
export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface PaymentNotificationData {
  phone: string;
  amount: number;
  senderName: string;
  claimUrl: string;
  expiresIn?: string;
}

export interface ClaimConfirmationData {
  phone: string;
  amount: number;
  walletBalance?: number;
}

export interface CreditApprovalData {
  phone: string;
  amount: number;
  apr: number;
  availableCredit: number;
}

// Initialize Twilio client
let twilioClient: twilio.Twilio | null = null;

function getTwilioClient(): twilio.Twilio {
  if (!twilioClient) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      throw new Error('Twilio credentials not configured. Set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
    }

    twilioClient = twilio(accountSid, authToken);
  }

  return twilioClient;
}

/**
 * Validate and format phone number
 */
function formatPhoneNumber(phone: string): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Add +1 for US numbers if not present
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // If already has country code
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // If has + already, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: assume US number
  return `+${digits}`;
}

/**
 * Send a basic SMS
 */
export async function sendSMS(
  to: string,
  message: string,
  options?: {
    from?: string;
    statusCallback?: string;
  }
): Promise<SMSResult> {
  try {
    const client = getTwilioClient();
    const fromNumber = options?.from || process.env.TWILIO_PHONE_NUMBER;

    if (!fromNumber) {
      throw new Error('TWILIO_PHONE_NUMBER not configured');
    }

    // Format phone number
    const formattedTo = formatPhoneNumber(to);

    // Send SMS
    const messageSent = await client.messages.create({
      body: message,
      from: fromNumber,
      to: formattedTo,
      statusCallback: options?.statusCallback,
    });

    console.log(`SMS sent to ${formattedTo}: ${messageSent.sid}`);

    return {
      success: true,
      messageId: messageSent.sid,
    };
  } catch (error) {
    console.error('Error sending SMS:', error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send payment notification SMS
 *
 * Example: "You received $500 from Acme Corp! Claim it now: https://wellsonyx.io/claim/pay_abc123 (Expires in 30 days)"
 */
export async function sendPaymentNotification(
  data: PaymentNotificationData
): Promise<SMSResult> {
  const { phone, amount, senderName, claimUrl, expiresIn = '30 days' } = data;

  // Format amount with commas
  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const message = `💰 You received ${formattedAmount} from ${senderName}!

Claim your money: ${claimUrl}

Expires in ${expiresIn}. Powered by Wells Onyx.`;

  return sendSMS(phone, message, {
    statusCallback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/notifications/sms`,
  });
}

/**
 * Send claim confirmation SMS
 *
 * Example: "$500 claimed! Your new balance: $500. Send money or apply for credit: https://wellsonyx.io/dashboard"
 */
export async function sendClaimConfirmation(
  data: ClaimConfirmationData
): Promise<SMSResult> {
  const { phone, amount, walletBalance } = data;

  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  let message = `✅ ${formattedAmount} claimed successfully!`;

  if (walletBalance !== undefined) {
    const formattedBalance = walletBalance.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
    message += `\n\nYour balance: ${formattedBalance}`;
  }

  message += `\n\nSend money or get instant credit: ${process.env.NEXT_PUBLIC_BASE_URL}/dashboard`;

  return sendSMS(phone, message);
}

/**
 * Send credit line approval SMS
 *
 * Example: "Congrats! You're approved for $10,000 credit at 12% APR. Access it now: https://wellsonyx.io/credit"
 */
export async function sendCreditApproval(
  data: CreditApprovalData
): Promise<SMSResult> {
  const { phone, amount, apr, availableCredit } = data;

  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  const aprPercent = (apr * 100).toFixed(1);

  const message = `🎉 Credit Approved!

Amount: ${formattedAmount}
APR: ${aprPercent}%
Available: ${formattedAmount}

Access your credit: ${process.env.NEXT_PUBLIC_BASE_URL}/credit

- Wells Onyx`;

  return sendSMS(phone, message);
}

/**
 * Send payment reminder (for unclaimed payments)
 */
export async function sendPaymentReminder(
  phone: string,
  amount: number,
  senderName: string,
  claimUrl: string,
  daysRemaining: number
): Promise<SMSResult> {
  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const message = `⏰ Reminder: ${formattedAmount} from ${senderName} expires in ${daysRemaining} days!

Claim now: ${claimUrl}

- Wells Onyx`;

  return sendSMS(phone, message);
}

/**
 * Send sender notification when payment is claimed
 */
export async function sendPaymentClaimedNotification(
  phone: string,
  amount: number,
  recipientName: string
): Promise<SMSResult> {
  const formattedAmount = amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  const message = `✅ ${recipientName} claimed your ${formattedAmount} payment!

View transaction: ${process.env.NEXT_PUBLIC_BASE_URL}/transactions

- Wells Onyx`;

  return sendSMS(phone, message);
}

/**
 * Send 2FA/OTP code
 */
export async function send2FACode(
  phone: string,
  code: string
): Promise<SMSResult> {
  const message = `Your Wells Onyx verification code: ${code}

This code expires in 10 minutes. Do not share this code with anyone.`;

  return sendSMS(phone, message);
}

/**
 * Send bulk SMS (with rate limiting)
 *
 * Sends messages in batches to avoid Twilio rate limits
 */
export async function sendBulkSMS(
  messages: Array<{ to: string; message: string }>,
  options?: {
    batchSize?: number;
    delayMs?: number;
  }
): Promise<SMSResult[]> {
  const { batchSize = 10, delayMs = 1000 } = options || {};
  const results: SMSResult[] = [];

  // Process in batches
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);

    // Send batch in parallel
    const batchResults = await Promise.allSettled(
      batch.map(({ to, message }) => sendSMS(to, message))
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
    if (i + batchSize < messages.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}

/**
 * Verify SMS delivery status
 */
export async function checkMessageStatus(
  messageId: string
): Promise<{
  status: string;
  errorCode?: number;
  errorMessage?: string;
}> {
  try {
    const client = getTwilioClient();
    const message = await client.messages(messageId).fetch();

    return {
      status: message.status,
      errorCode: message.errorCode || undefined,
      errorMessage: message.errorMessage || undefined,
    };
  } catch (error) {
    console.error('Error checking message status:', error);
    throw error;
  }
}

/**
 * Get SMS usage/stats for billing
 */
export async function getSMSUsage(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalMessages: number;
  totalCost: number;
  successfulMessages: number;
  failedMessages: number;
}> {
  try {
    const client = getTwilioClient();

    const messages = await client.messages.list({
      dateSentAfter: startDate,
      dateSentBefore: endDate,
      limit: 1000, // Adjust as needed
    });

    const stats = messages.reduce(
      (acc, msg) => {
        acc.totalMessages += 1;
        acc.totalCost += parseFloat(msg.price || '0');

        if (msg.status === 'delivered') {
          acc.successfulMessages += 1;
        } else if (msg.status === 'failed' || msg.status === 'undelivered') {
          acc.failedMessages += 1;
        }

        return acc;
      },
      {
        totalMessages: 0,
        totalCost: 0,
        successfulMessages: 0,
        failedMessages: 0,
      }
    );

    return stats;
  } catch (error) {
    console.error('Error getting SMS usage:', error);
    throw error;
  }
}
