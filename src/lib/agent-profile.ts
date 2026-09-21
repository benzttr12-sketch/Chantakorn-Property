import { Agent, UserProfile } from '@/lib/types';

/**
 * Public contact data saved with a listing. It deliberately excludes the
 * account email, because profile documents are private.
 */
export function agentFromProfile(profile: UserProfile): Agent {
  if (profile.role !== 'AGENT') {
    throw new Error('เฉพาะสมาชิกบทบาทนายหน้าเท่านั้นที่ลงประกาศได้');
  }

  return {
    id: profile.id,
    name: profile.full_name,
    title: 'นายหน้าผู้รับผิดชอบทรัพย์',
    phone: profile.phone || '',
    line_id: profile.line_id || '',
    photo_url: profile.avatar_url || '',
    bio: profile.bio || '',
  };
}
