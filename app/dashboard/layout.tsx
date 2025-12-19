/**
 * Dashboard Layout
 * Forces dynamic rendering to prevent static generation issues with Clerk
 */

export const dynamic = 'force-dynamic'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
