// Force dynamic rendering (uses Clerk hooks)
export const dynamic = 'force-dynamic'

export default function Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
