import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-white shadow-xl',
            headerTitle: 'text-[#183b6d]',
            headerSubtitle: 'text-[#575757]',
            socialButtonsBlockButton: 'border-[#183b6d]/20 hover:border-[#183b6d]/40',
            formButtonPrimary: 'bg-[#183b6d] hover:bg-[#0f2847]',
            footerActionLink: 'text-[#183b6d] hover:text-[#0f2847]',
            footer: 'display: none',
          },
          variables: {
            colorPrimary: '#183b6d',
          },
          layout: {
            logoPlacement: 'inside',
            showOptionalFields: false,
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        redirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL || '/app'}
      />
    </div>
  )
}
