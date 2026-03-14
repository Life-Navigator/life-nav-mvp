export interface CredlyBadge {
  id: string;
  issued_at: string;
  expires_at: string | null;
  badge_template: {
    id: string;
    name: string;
    description: string;
    skills: string[];
    issuer: {
      name: string;
    };
    image_url: string;
  };
  badge_url: string;
}

export async function fetchBadges(username: string): Promise<CredlyBadge[]> {
  const res = await fetch(
    `https://www.credly.com/users/${encodeURIComponent(username)}/badges.json`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) {
    if (res.status === 404) throw new Error('Credly user not found');
    throw new Error(`Failed to fetch Credly badges: ${res.status}`);
  }

  const data = await res.json();
  return data?.data || [];
}

export async function validateUsername(username: string): Promise<boolean> {
  try {
    const res = await fetch(
      `https://www.credly.com/users/${encodeURIComponent(username)}/badges.json?page_size=1`,
      { headers: { Accept: 'application/json' } }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export function mapBadgeToCourse(badge: CredlyBadge) {
  return {
    title: badge.badge_template.name,
    provider: badge.badge_template.issuer.name,
    platform: 'Credly',
    status: 'completed',
    completed_at: badge.issued_at,
    certificate_url: badge.badge_url,
    skills_learned: badge.badge_template.skills || [],
    metadata: {
      credly_badge_id: badge.id,
      credly_template_id: badge.badge_template.id,
      image_url: badge.badge_template.image_url,
      expires_at: badge.expires_at,
    },
  };
}
