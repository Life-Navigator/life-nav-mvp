export interface LinkedInProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  headline?: string;
  profilePicture?: string;
}

export interface LinkedInEmail {
  emailAddress: string;
}

export async function getProfile(accessToken: string): Promise<LinkedInProfile> {
  const res = await fetch('https://api.linkedin.com/v2/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`LinkedIn profile fetch failed: ${text}`);
  }

  return res.json();
}

export async function getEmail(accessToken: string): Promise<string | null> {
  const res = await fetch(
    'https://api.linkedin.com/v2/emailAddress?q=members&projection=(elements*(handle~))',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;

  const data = await res.json();
  return data?.elements?.[0]?.['handle~']?.emailAddress || null;
}

export function mapToCareerProfile(profile: LinkedInProfile, email: string | null) {
  return {
    first_name: profile.localizedFirstName,
    last_name: profile.localizedLastName,
    headline: profile.headline || null,
    linkedin_url: `https://www.linkedin.com/in/${profile.id}`,
    email: email || null,
    source: 'linkedin',
    synced_at: new Date().toISOString(),
  };
}
