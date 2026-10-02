export const OFFICIAL_LINE_OA_URL = 'https://lin.ee/NMSe28T3';
export const OFFICIAL_LINE_BASIC_ID = '@930xzcyi';
export const OFFICIAL_LINE_DISPLAY_NAME = 'Chantakorn Property';

export const DEFAULT_LINE_CHANNEL_ID = '2011760874';
export const DEFAULT_LINE_CHANNEL_SECRET = 'f0bf93dfa53dfdb33c7a81b0b2a80a44';

interface OAuthTokenCache {
  accessToken: string;
  expiresAt: number;
}

let cachedOAuthToken: OAuthTokenCache | null = null;

/**
 * Resolves a valid working LINE Channel Access Token.
 * If a valid long-lived token is provided (> 60 chars), it is used.
 * If the provided token is numeric (Channel ID) or missing, it automatically
 * exchanges the Channel ID + Channel Secret for a fresh valid Bearer token via LINE OAuth API.
 */
export async function resolveWorkingChannelAccessToken(options?: {
  explicitToken?: string;
  channelId?: string;
  channelSecret?: string;
}): Promise<string> {
  const tokenCandidate = (options?.explicitToken || process.env.LINE_CHANNEL_ACCESS_TOKEN || '').trim();

  // If token is a valid long-lived bearer token (not numeric Channel ID)
  if (tokenCandidate.length > 50 && !/^\d+$/.test(tokenCandidate)) {
    return tokenCandidate;
  }

  // Check in-memory cache
  const now = Date.now();
  if (cachedOAuthToken && cachedOAuthToken.expiresAt > now + 60000) {
    return cachedOAuthToken.accessToken;
  }

  // Resolve Channel ID and Channel Secret
  const channelId = (
    options?.channelId ||
    process.env.LINE_CHANNEL_ID ||
    (/^\d+$/.test(tokenCandidate) ? tokenCandidate : '') ||
    DEFAULT_LINE_CHANNEL_ID
  ).trim();

  const channelSecret = (
    options?.channelSecret ||
    process.env.LINE_CHANNEL_SECRET ||
    DEFAULT_LINE_CHANNEL_SECRET
  ).trim();

  if (!channelId || !channelSecret) {
    return tokenCandidate;
  }

  try {
    const res = await fetch('https://api.line.me/v2/oauth/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: channelId,
        client_secret: channelSecret,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.access_token) {
        cachedOAuthToken = {
          accessToken: data.access_token,
          expiresAt: now + (Number(data.expires_in) || 2592000) * 1000,
        };
        return data.access_token;
      }
    } else {
      const errText = await res.text();
      console.warn('[LINE Auth] Failed to exchange Channel ID/Secret for token:', errText);
    }
  } catch (err) {
    console.warn('[LINE Auth] Error requesting access token:', err);
  }

  return tokenCandidate;
}

export function invalidateChannelAccessToken(): void {
  cachedOAuthToken = null;
}

