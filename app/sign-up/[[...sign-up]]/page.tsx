import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0a] to-[#1a1a1a]">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-white shadow-xl',
            headerTitle: 'text-[#183b6d]',
            headerSubtitle: 'text-[#575757]',
            socialButtonsBlockButton: 'border-[#183b6d]/20 hover:border-[#183b6d]/40',
            formButtonPrimary: 'bg-[#183b6d] hover:bg-[#0f2847]',
            footerActionLink: 'text-[#183b6d] hover:text-[#0f2847]',
          },
          variables: {
            colorPrimary: '#183b6d',
          },
        }}
        routing="path"
        path="/sign-up"
        signInUrl="/sign-in"
        redirectUrl={process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL || '/app'}
      />
    </div>
  )
}
