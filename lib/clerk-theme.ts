/**
 * Grain & Vault - Clerk Theme Configuration
 *
 * Centralized appearance config for Clerk components.
 * Designed for Clerk Pro tier with:
 * - Complete white-label branding (no Clerk badge)
 * - Custom colors matching Grain & Vault design
 * - High-performance settings for thousands of concurrent users
 * - Enterprise-ready security indicators
 */

import type { Appearance } from '@clerk/types'

// Grain & Vault brand colors
export const BRAND_COLORS = {
  primary: '#10b981',      // emerald-500
  primaryHover: '#059669', // emerald-600
  secondary: '#14b8a6',    // teal-500
  background: '#030712',   // gray-950
  backgroundCard: '#0a0a0a',
  inputBackground: '#171717',
  border: 'rgba(255, 255, 255, 0.1)',
  borderHover: 'rgba(16, 185, 129, 0.3)',
  text: '#ffffff',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
}

/**
 * Full Clerk appearance configuration for Grain & Vault
 * Use this for SignIn, SignUp, and UserButton components
 */
export const grainVaultClerkAppearance: Appearance = {
  // Layout settings
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    termsPageUrl: '/terms',
    privacyPageUrl: '/privacy',
    logoPlacement: 'none', // We use our own logo above the component
    shimmer: true,
    animations: true,
    unsafe_disableDevelopmentModeWarnings: true,
  },

  // CSS Variables for consistent theming
  variables: {
    colorPrimary: BRAND_COLORS.primary,
    colorBackground: BRAND_COLORS.backgroundCard,
    colorInputBackground: BRAND_COLORS.inputBackground,
    colorInputText: BRAND_COLORS.text,
    colorText: BRAND_COLORS.text,
    colorTextSecondary: BRAND_COLORS.textSecondary,
    colorDanger: BRAND_COLORS.danger,
    colorSuccess: BRAND_COLORS.success,
    colorWarning: BRAND_COLORS.warning,
    borderRadius: '0.75rem',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    fontFamilyButtons: 'Inter, system-ui, sans-serif',
    fontWeight: {
      normal: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    spacingUnit: '1rem',
  },

  // Element-specific styling
  elements: {
    // Root container
    rootBox: 'w-full',
    card: 'bg-gradient-to-b from-gray-900/90 to-gray-900/70 border border-white/10 shadow-2xl shadow-black/50 backdrop-blur-xl rounded-2xl overflow-hidden',

    // =========================================
    // CLERK PRO: Hide all branding
    // =========================================
    footer: 'hidden',
    footerAction: 'hidden',
    footerActionLink: 'hidden',
    footerActionText: 'hidden',
    badge: 'hidden',
    logoBox: 'hidden',
    logoImage: 'hidden',

    // Header (hide default, use custom)
    headerTitle: 'hidden',
    headerSubtitle: 'hidden',

    // =========================================
    // Social OAuth Buttons
    // =========================================
    socialButtonsBlockButton: `
      bg-white/5
      border border-white/10
      text-white
      hover:bg-white/10
      hover:border-emerald-500/30
      transition-all duration-300
      rounded-xl
      py-3
      font-medium
    `,
    socialButtonsBlockButtonText: 'text-white font-medium',
    socialButtonsBlockButtonArrow: 'text-gray-400',
    socialButtonsProviderIcon: 'w-5 h-5',
    socialButtonsIconButton: `
      bg-white/5
      border border-white/10
      hover:bg-white/10
      hover:border-emerald-500/30
      transition-all duration-200
      rounded-xl
    `,

    // =========================================
    // Divider
    // =========================================
    dividerLine: 'bg-white/10',
    dividerText: 'text-gray-500 text-sm bg-transparent',
    dividerRow: 'my-6',

    // =========================================
    // Form Fields
    // =========================================
    formFieldLabel: 'text-gray-300 font-medium mb-2 text-sm',
    formFieldLabelRow: 'mb-2',
    formFieldInput: `
      bg-white/5
      border border-white/10
      text-white
      placeholder-gray-500
      rounded-xl
      py-3 px-4
      focus:border-emerald-500/50
      focus:ring-2
      focus:ring-emerald-500/20
      transition-all
      text-base
    `,
    formFieldInputShowPasswordButton: 'text-gray-400 hover:text-white transition-colors',
    formFieldInputShowPasswordIcon: 'w-5 h-5',
    formFieldHintText: 'text-gray-500 text-xs mt-1',
    formFieldSuccessText: 'text-emerald-400 text-sm mt-1',
    formFieldErrorText: 'text-red-400 text-sm mt-1',
    formFieldWarningText: 'text-amber-400 text-sm mt-1',
    formFieldAction: 'text-emerald-500 hover:text-emerald-400 font-medium transition-colors',
    formFieldRow: 'mb-4',

    // =========================================
    // Primary Button (Sign In / Continue)
    // =========================================
    formButtonPrimary: `
      bg-gradient-to-r from-emerald-500 to-teal-600
      hover:from-emerald-400 hover:to-teal-500
      text-black
      font-bold
      py-3
      rounded-xl
      transition-all duration-300
      shadow-lg shadow-emerald-500/25
      hover:shadow-emerald-500/40
      hover:scale-[1.02]
      disabled:opacity-50
      disabled:cursor-not-allowed
      disabled:hover:scale-100
    `,
    formButtonReset: 'text-gray-400 hover:text-white transition-colors',

    // =========================================
    // Identity Preview (after email entry)
    // =========================================
    identityPreview: 'bg-white/5 border border-white/10 rounded-xl p-4',
    identityPreviewText: 'text-white font-medium',
    identityPreviewEditButton: 'text-emerald-500 hover:text-emerald-400 transition-colors',
    identityPreviewEditButtonIcon: 'text-emerald-500 w-4 h-4',

    // =========================================
    // OTP / Verification Code
    // =========================================
    otpCodeFieldInput: `
      bg-white/5
      border border-white/10
      text-white
      text-center
      text-xl
      font-semibold
      rounded-xl
      focus:border-emerald-500/50
      focus:ring-2
      focus:ring-emerald-500/20
    `,
    otpCodeField: 'gap-3',

    // =========================================
    // Alternative Methods
    // =========================================
    alternativeMethodsBlockButton: `
      bg-white/5
      border border-white/10
      text-gray-300
      hover:text-white
      hover:bg-white/10
      rounded-xl
      transition-all
    `,

    // =========================================
    // Alerts & Notifications
    // =========================================
    alert: 'bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4',
    alertText: 'text-red-400 text-sm',
    alertIcon: 'text-red-400',

    // =========================================
    // Loading States
    // =========================================
    spinner: 'text-emerald-500',

    // =========================================
    // Card Spacing
    // =========================================
    main: 'px-8 py-8',

    // =========================================
    // User Button (when signed in)
    // =========================================
    userButtonAvatarBox: 'w-9 h-9 rounded-lg border border-white/10',
    userButtonPopoverCard: 'bg-gray-900 border border-white/10 rounded-xl shadow-2xl',
    userButtonPopoverActionButton: 'hover:bg-white/5 rounded-lg transition-colors',
    userButtonPopoverActionButtonText: 'text-white',
    userButtonPopoverActionButtonIcon: 'text-gray-400',
    userButtonPopoverFooter: 'hidden',

    // =========================================
    // User Profile Modal
    // =========================================
    modalContent: 'bg-gray-900 border border-white/10',
    modalCloseButton: 'text-gray-400 hover:text-white',
    profileSectionTitle: 'text-white font-semibold',
    profileSectionContent: 'text-gray-300',
    profileSectionPrimaryButton: `
      bg-gradient-to-r from-emerald-500 to-teal-600
      hover:from-emerald-400 hover:to-teal-500
      text-black font-semibold rounded-lg
    `,

    // =========================================
    // Passkeys & Security
    // =========================================
    passkeyIcon: 'text-emerald-500',

    // =========================================
    // Phone Input
    // =========================================
    phoneInputBox: 'bg-white/5 border border-white/10 rounded-xl',

    // =========================================
    // Select / Dropdown
    // =========================================
    selectButton: 'bg-white/5 border border-white/10 text-white rounded-xl',
    selectOptionsContainer: 'bg-gray-900 border border-white/10 rounded-xl',
    selectOption: 'text-white hover:bg-white/5',
  },
}

/**
 * Clerk appearance for sign-in only
 * Includes redirect to /join for sign-up
 */
export const signInAppearance: Appearance = {
  ...grainVaultClerkAppearance,
}

/**
 * Clerk appearance for sign-up only
 */
export const signUpAppearance: Appearance = {
  ...grainVaultClerkAppearance,
}

/**
 * Clerk appearance for UserButton (minimal)
 */
export const userButtonAppearance: Appearance = {
  elements: {
    avatarBox: 'w-8 h-8 rounded-lg',
    userButtonPopoverCard: 'bg-gray-900 border border-white/10 rounded-xl shadow-2xl backdrop-blur-xl',
    userButtonPopoverActionButton: 'hover:bg-white/5 rounded-lg transition-colors',
    userButtonPopoverActionButtonText: 'text-white text-sm',
    userButtonPopoverActionButtonIcon: 'text-gray-400 w-4 h-4',
    userButtonPopoverFooter: 'hidden',
  },
}

/**
 * ClerkProvider configuration for the app
 * Optimized for thousands of concurrent sessions
 */
export const clerkProviderConfig = {
  // Auth URLs (unified across domains)
  signInUrl: '/sign-in',
  signUpUrl: '/join',
  afterSignInUrl: '/dashboard',
  afterSignUpUrl: '/dashboard',

  // Appearance
  appearance: grainVaultClerkAppearance,

  // Performance optimizations for scale
  // These help with thousands of concurrent users
  publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
}

export default grainVaultClerkAppearance
