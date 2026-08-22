const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface ProvisionResponse {
  user: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    team_id: string;
    role: string;
    teams: {
      id: string;
      name: string;
      plan: string;
    };
  };
  team: {
    id: string;
    name: string;
    plan: string;
  };
  onboardingState: {
    gmail_connected: boolean;
    first_macro_added: boolean;
    extension_installed: boolean;
    viewed_demo: boolean;
  } | null;
  isFirstLogin: boolean;
}

export async function provisionUser(accessToken: string): Promise<ProvisionResponse> {
  const res = await fetch(`${API_URL}/auth/provision`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Provision failed' }));
    throw new Error(err.message || 'Failed to provision user');
  }

  return res.json();
}

export async function getOnboardingState(accessToken: string) {
  const res = await fetch(`${API_URL}/auth/onboarding`, {
    headers: { 'Authorization': `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Failed to fetch onboarding state');
  return res.json();
}

export async function updateOnboardingState(
  accessToken: string,
  updates: Partial<{
    gmail_connected: boolean;
    first_macro_added: boolean;
    extension_installed: boolean;
    viewed_demo: boolean;
  }>
) {
  const res = await fetch(`${API_URL}/auth/onboarding`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update onboarding state');
  return res.json();
}
