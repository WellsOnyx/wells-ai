/**
 * RFQ Layout
 * Forces dynamic rendering for all RFQ pages
 */

export const dynamic = 'force-dynamic';

export default function RFQLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
