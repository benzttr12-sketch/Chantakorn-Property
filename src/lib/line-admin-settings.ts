export interface LinePreferences {
  autoNotifyNewProperty: boolean;
  autoNotifyConsignment: boolean;
}

type StaffRequest = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

/** Saved preferences are acknowledged only after the server confirms persistence. */
export async function saveLinePreferences(request: StaffRequest, preferences: LinePreferences): Promise<void> {
  const response = await request('/api/line/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'save_settings', ...preferences }),
  });
  const result = await response.json();
  if (!response.ok || result.success !== true) {
    throw new Error(result.error || 'บันทึกการตั้งค่าไม่สำเร็จ กรุณาลองอีกครั้ง');
  }
}
