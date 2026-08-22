import { serverApi } from '@/lib/api-server';
import { resolveNoActiveOrgRedirect } from '@/lib/no-active-org-redirect';
import { auth } from '@/utils/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { NextRequest } from 'next/server';
import { createSetupSession } from './lib/setup-session';

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  // Get search params from the request
  const searchParams = request.nextUrl.searchParams.toString();
  const queryString = searchParams ? `?${searchParams}` : '';

  if (!session?.user?.id) {
    redirect(`/sign-in${queryString}`);
  }

  // Invite flows take precedence over the CS-569 offboard guard: a raw
  // ?inviteCode= is turned into /invite/{code} downstream by /setup/[setupId],
  // so let it flow through untouched rather than pre-empting it here. Matches
  // the downstream truthy check (an empty ?inviteCode= is not an invite).
  const inviteCode = request.nextUrl.searchParams.get('inviteCode');
  if (!inviteCode) {
    // CS-569: guard the onboarding loop at the setup entry too (direct nav or
    // the create-additional intent). Reuse the same decision the landing page
    // uses so the two can't drift. A non-null target means the user is invited
    // or offboarded; `null` means a new user (or one with active orgs) who
    // should fall through to onboarding.
    const meRes = await serverApi.get<{
      organizations: unknown[];
      pendingInvitation: { id: string } | null;
      hasInactiveMembership?: boolean;
    }>('/v1/auth/me');
    const hasActiveOrg = (meRes.data?.organizations?.length ?? 0) > 0;
    if (!hasActiveOrg) {
      const target = resolveNoActiveOrgRedirect(meRes.data);
      if (target) {
        redirect(target);
      }
    }

    // Nobody is shown the new-organization screen unless they are an
    // explicitly allowlisted operator. This is the single choke point: every
    // route to onboarding (the landing page, ?intent=create-additional, and
    // direct navigation) comes through here to get a setup session, so no
    // setup session is ever minted for anyone else.
    //
    // An invited auditor is unaffected: they arrive via /invite/{code}, which
    // is handled by the inviteCode branch above and downstream in
    // /setup/[setupId], so they reach their organization without ever seeing
    // onboarding. Leaving ORG_CREATION_ALLOWED_EMAILS unset restores upstream
    // behaviour.
    const orgCreators = (process.env.ORG_CREATION_ALLOWED_EMAILS ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

    const mayCreateOrg =
      orgCreators.length === 0 ||
      orgCreators.includes(session.user.email?.toLowerCase() ?? '');

    if (!mayCreateOrg) {
      // A user with no org must NOT be sent to `/` — the landing page routes
      // no-org users back to /setup, which would loop. Dead-end them instead.
      redirect(hasActiveOrg ? '/' : '/auth/access-removed');
    }
  }

  const setupSession = await createSetupSession(session.user.id);
  redirect(`/setup/${setupSession.id}${queryString}`);
}
