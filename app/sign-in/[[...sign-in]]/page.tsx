import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <SignIn
        appearance={{
          variables: {
            colorPrimary: '#dba63f',
            colorBackground: '#000000',
            colorText: '#ffffff',
            colorTextSecondary: '#a0a0a0',
            colorInputBackground: '#1a1a1a',
            colorInputText: '#ffffff',
            borderRadius: '0.5rem',
          },
          elements: {
            rootBox: "mx-auto",
            card: "bg-zinc-900 shadow-2xl border border-zinc-800",
            headerTitle: "text-white",
            headerSubtitle: "text-zinc-400",
            socialButtonsBlockButton: "bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-white",
            formButtonPrimary: "bg-[#dba63f] hover:bg-[#c99535] text-black font-semibold",
            footerActionLink: "text-[#dba63f] hover:text-[#c99535]",
            formFieldInput: "bg-zinc-800 border-zinc-700 text-white",
            formFieldLabel: "text-zinc-300",
            identityPreviewText: "text-white",
            identityPreviewEditButton: "text-[#dba63f]",
          },
        }}
        routing="path"
        path="/sign-in"
        signUpUrl="/sign-up"
        forceRedirectUrl="/"
      />
    </div>
  )
}
