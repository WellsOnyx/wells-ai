// lib/supplier-onboarding-emails.ts
// Automated email templates for supplier onboarding sequence

export interface EmailTemplate {
  subject: string
  html: string
}

export function getWelcomeEmail(supplierName: string, supplierEmail: string): EmailTemplate {
  return {
    subject: 'Welcome to Wells AI - Next Steps',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to Wells AI!</h1>
        </div>

        <div style="padding: 40px 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #1f2937;">Hi <strong>${supplierName}</strong>,</p>

          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            You're now part of the Wells AI supplier network. We connect pre-qualified buyers with vetted suppliers like you.
          </p>

          <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 20px;">What Happens Next:</h3>
            <ol style="color: #4b5563; line-height: 1.8; padding-left: 20px;">
              <li><strong>Approval</strong> - Our team will review your application (typically within 48 hours)</li>
              <li><strong>Profile Setup</strong> - Complete your supplier profile with capabilities and certifications</li>
              <li><strong>Start Receiving RFQs</strong> - Get matched with relevant quote requests automatically</li>
            </ol>
          </div>

          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #92400e;">💡 Pro Tip</h4>
            <p style="color: #78350f; margin: 0; line-height: 1.6;">
              Suppliers with complete profiles receive 3x more quote requests. Make sure to add your capabilities, certifications, and delivery areas.
            </p>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://wellsai.vercel.app/suppliers/dashboard"
               style="background: #f59e0b; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Complete Your Profile
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 35px; line-height: 1.6;">
            Questions? Reply to this email or reach out to <a href="mailto:suppliers@wellsai.com" style="color: #f59e0b;">suppliers@wellsai.com</a>
          </p>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Wells AI | B2B Commerce Platform | Join 50+ Active Suppliers
          </p>
        </div>
      </div>
    `
  }
}

export function getDay3ReminderEmail(supplierName: string): EmailTemplate {
  return {
    subject: 'Action Needed: Add Your First Products',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 25px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Almost Ready to Receive Orders</h1>
        </div>

        <div style="padding: 35px 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #1f2937;">Hi <strong>${supplierName}</strong>,</p>

          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            You joined Wells AI 3 days ago. To start receiving quote requests, you need to add your product catalog.
          </p>

          <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; border: 2px solid #fbbf24;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 22px;">📦 0 Products Added</h3>
            <p style="color: #6b7280; margin: 15px 0;">Suppliers with product listings receive 5x more RFQs</p>
            <a href="https://wellsai.vercel.app/suppliers/dashboard"
               style="background: #f59e0b; color: white; padding: 12px 35px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block; margin-top: 10px;">
              Add Products Now
            </a>
          </div>

          <div style="background: white; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #1f2937;">Quick Setup Guide:</h4>
            <ul style="color: #4b5563; line-height: 1.8;">
              <li>Add 5-10 of your most popular products</li>
              <li>Include competitive pricing and availability</li>
              <li>Upload product images (optional but recommended)</li>
              <li>Set delivery times and minimum order quantities</li>
            </ul>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 30px; line-height: 1.6;">
            Need help? Our supplier success team is here: <a href="mailto:suppliers@wellsai.com" style="color: #f59e0b;">suppliers@wellsai.com</a>
          </p>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Wells AI | Connecting Buyers and Suppliers Since 2024
          </p>
        </div>
      </div>
    `
  }
}

export function getDay7ReminderEmail(supplierName: string): EmailTemplate {
  return {
    subject: 'Complete Your Wells AI Profile (10 Minutes)',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); padding: 25px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Your Profile is Incomplete</h1>
        </div>

        <div style="padding: 35px 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #1f2937;">Hi <strong>${supplierName}</strong>,</p>

          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            It's been a week since you joined Wells AI. Suppliers who complete their profiles within 7 days receive their first RFQ 4x faster.
          </p>

          <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; border-left: 4px solid #ef4444;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 20px;">⚠️ Missing Information:</h3>
            <ul style="color: #4b5563; line-height: 1.8;">
              <li>Company capabilities & specializations</li>
              <li>Certifications (ISO, OSHA, etc.)</li>
              <li>Delivery locations served</li>
              <li>Payment terms & minimum order size</li>
            </ul>
          </div>

          <div style="background: #ecfdf5; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #065f46;">✅ Complete Profile Benefits:</h4>
            <ul style="color: #047857; line-height: 1.8; margin: 10px 0;">
              <li>Higher search ranking in buyer searches</li>
              <li>Automatic matching with relevant RFQs</li>
              <li>Trust badge on your supplier profile</li>
              <li>Priority placement in quote request emails</li>
            </ul>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://wellsai.vercel.app/suppliers/dashboard"
               style="background: #f59e0b; color: white; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px; display: inline-block;">
              Complete Profile (10 min)
            </a>
          </div>

          <p style="color: #6b7280; font-size: 14px; margin-top: 35px; text-align: center;">
            <em>Takes 10 minutes. Makes all the difference.</em>
          </p>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Wells AI | Trusted by 50+ Enterprise Suppliers
          </p>
        </div>
      </div>
    `
  }
}

export function getDay14AlmostLiveEmail(supplierName: string): EmailTemplate {
  return {
    subject: "You're Almost Live on Wells AI!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">🎉 You're Almost There!</h1>
        </div>

        <div style="padding: 40px 30px; background: #f9fafb;">
          <p style="font-size: 18px; color: #1f2937;">Hi <strong>${supplierName}</strong>,</p>

          <p style="font-size: 16px; color: #4b5563; line-height: 1.6;">
            It's been 2 weeks since you joined Wells AI. You're <strong>so close</strong> to going live and receiving your first quote requests!
          </p>

          <div style="background: white; border-radius: 8px; padding: 25px; margin: 25px 0; text-align: center; border: 2px solid #10b981;">
            <h3 style="margin-top: 0; color: #1f2937; font-size: 22px;">Final Checklist:</h3>
            <div style="text-align: left; margin: 20px auto; max-width: 400px;">
              <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">✓ Account Created</span>
              </div>
              <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #6b7280;">✓ Email Verified</span>
              </div>
              <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <span style="color: #f59e0b;"><strong>→ Complete Profile</strong></span>
              </div>
              <div style="padding: 10px 0;">
                <span style="color: #f59e0b;"><strong>→ Add Products</strong></span>
              </div>
            </div>
          </div>

          <div style="background: #fef3c7; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h4 style="margin-top: 0; color: #92400e;">🚀 What You're Missing:</h4>
            <p style="color: #78350f; margin: 0; line-height: 1.6;">
              <strong>Last week alone</strong>, our platform matched 127 RFQs with suppliers in your categories.
              Complete your profile today to start receiving quote requests tomorrow.
            </p>
          </div>

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://wellsai.vercel.app/suppliers/dashboard"
               style="background: #10b981; color: white; padding: 16px 45px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 18px; display: inline-block;">
              Finish Setup & Go Live
            </a>
          </div>

          <div style="margin-top: 35px; padding-top: 25px; border-top: 2px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 14px; line-height: 1.6;">
              <strong>Need help getting started?</strong><br>
              Our supplier success team can help you complete setup in 15 minutes.<br>
              Email: <a href="mailto:suppliers@wellsai.com" style="color: #f59e0b;">suppliers@wellsai.com</a> |
              Schedule: <a href="https://wellsai.vercel.app/suppliers/book-call" style="color: #f59e0b;">Book a 15-min call</a>
            </p>
          </div>
        </div>

        <div style="background: #1f2937; padding: 20px; text-align: center;">
          <p style="color: #9ca3af; margin: 0; font-size: 12px;">
            Wells AI | Powering B2B Commerce for Modern Suppliers
          </p>
          <p style="color: #6b7280; margin: 10px 0 0 0; font-size: 11px;">
            Don't want these emails? <a href="#" style="color: #9ca3af;">Unsubscribe</a>
          </p>
        </div>
      </div>
    `
  }
}
