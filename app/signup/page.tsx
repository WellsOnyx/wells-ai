import { redirect } from 'next/navigation'

/**
 * Redirect /signup to /join (the real signup flow)
 */
export default function SignupRedirect() {
  redirect('/join')
}
