// Force dynamic rendering for onboard page (uses Clerk hooks)
export const dynamic = 'force-dynamic'

export default function OnboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
