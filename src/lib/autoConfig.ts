export interface AutoConfigLink {
  url: string;
  token: string;
  user: 'Nina' | 'Nando' | null;
}

// Parses the partner auto-config link (…?scriptUrl=…&token=…&user=…).
export function parseAutoConfigLink(link: string): AutoConfigLink | null {
  try {
    const params = new URL(link.trim()).searchParams;
    const url = params.get('scriptUrl');
    const token = params.get('token');
    if (!url || !token) return null;
    const user = params.get('user');
    return { url, token, user: user === 'Nina' || user === 'Nando' ? user : null };
  } catch {
    return null;
  }
}
