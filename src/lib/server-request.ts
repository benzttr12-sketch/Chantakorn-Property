import { jsonResponse } from '@/lib/api-response';

type JsonBodyResult = { data: unknown; error?: never } | { error: Response; data?: never };

/** Limit the bytes read from the stream, including requests with no or misleading length header. */
export async function readJsonBody(request: Request, maxBytes: number): Promise<JsonBodyResult> {
  const tooLarge = () => jsonResponse({ error: 'ข้อมูลคำขอมีขนาดใหญ่เกินกำหนด' }, { status: 413 });
  const declaredLength = request.headers.get('content-length');
  if (declaredLength && /^\d+$/.test(declaredLength) && Number(declaredLength) > maxBytes) {
    return { error: tooLarge() };
  }

  if (!request.body) {
    return { error: jsonResponse({ error: 'ข้อมูล JSON ไม่ถูกต้อง' }, { status: 400 }) };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { error: tooLarge() };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { data: JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)) };
  } catch {
    return { error: jsonResponse({ error: 'ข้อมูล JSON ไม่ถูกต้อง' }, { status: 400 }) };
  } finally {
    reader.releaseLock();
  }
}
