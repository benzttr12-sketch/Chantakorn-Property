const test = require('node:test');
const assert = require('node:assert/strict');
const loader = require('./load-ts.cjs');

const propertyId = 'c1c00000-0000-4000-8000-000000000001';
const mediaId = 'c1c00000-0000-4000-8000-000000000002';
const firestoreUrl = `https://site.example.invalid/api/properties/${propertyId}/image?media=${mediaId}`;
const cloudflareUrl = `https://api.example.invalid/v1/media/properties/${mediaId}`;
const dataUrl = 'data:image/png;base64,cGhvdG8=';

function load({ backend, photo = { property_id: propertyId, data_url: dataUrl }, database = {}, fetchPhoto, previewPhoto, readPhoto } = {}) {
  const fetches = [], reads = [], previews = [], created = [], revoked = [], timers = [], links = [];
  class DownloadURL extends URL {
    static createObjectURL(blob) { const url = `blob:test-${created.length}`; created.push({ blob, url }); return url; }
    static revokeObjectURL(url) { revoked.push(url); }
  }
  const api = loader({
    '@/lib/firebase/client': { db: database },
    'firebase/firestore': {
      doc: (db, collection, id) => ({ db, collection, id }),
      getDocFromServer: async ref => {
        reads.push(ref);
        const result = readPhoto ? await readPhoto() : photo;
        return { data: () => result };
      },
    },
    '@/lib/cloudflare-property-preview': {
      cloudflarePropertyPreviewUrl: src => src === cloudflareUrl ? 'private-preview' : null,
      fetchStaffPropertyPreview: async (src, id, signal) => {
        previews.push({ src, id, signal });
        return previewPhoto ? previewPhoto(src, id, signal) : new Blob(['private'], { type: 'image/jpeg' });
      },
    },
  }, {
    Blob, URL: DownloadURL,
    process: { env: backend === undefined ? {} : { NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: backend } },
    window: { location: { href: 'https://site.example.invalid/admin/properties' } },
    fetch: async (src, options) => {
      fetches.push({ src, options });
      return fetchPhoto ? fetchPhoto(src, options) : new Response('photo', { headers: { 'Content-Type': 'image/png' } });
    },
    document: {
      createElement: tag => {
        assert.equal(tag, 'a');
        const link = { attached: false, clicks: 0, remove() { this.attached = false; }, click() { assert.equal(this.attached, true); this.clicks++; } };
        links.push(link); return link;
      },
      body: { appendChild(link) { link.attached = true; } },
    },
    setTimeout: (run, delay) => { timers.push({ run, delay }); },
  })('lib/property-photo-download.ts');
  return { api, fetches, reads, previews, created, revoked, timers, links };
}

test('Cloudflare downloads reuse the authenticated parent-scoped preview in the default backend', async () => {
  const { api, previews, fetches, reads } = load();
  const controller = new AbortController();
  const blob = await api.fetchPropertyPhoto(cloudflareUrl, propertyId, controller.signal);
  assert.equal(blob.type, 'image/jpeg'); assert.equal(await blob.text(), 'private');
  assert.equal(previews.length, 1);
  assert.deepEqual(previews[0], { src: cloudflareUrl, id: propertyId, signal: controller.signal });
  assert.equal(fetches.length, 0); assert.equal(reads.length, 0);
});

test('Firestore draft downloads hydrate the matching media document rather than its published-only URL', async () => {
  const { api, reads, fetches, previews } = load({ backend: 'firebase' });
  const blob = await api.fetchPropertyPhoto(firestoreUrl, propertyId);
  assert.equal(blob.type, 'image/png'); assert.equal(await blob.text(), 'photo');
  assert.equal(reads.length, 1); assert.equal(reads[0].collection, 'property_media'); assert.equal(reads[0].id, mediaId);
  assert.equal(fetches.length, 0); assert.equal(previews.length, 0);
});

test('Firestore media rejects missing database, mismatched parent and arbitrary returned URLs', async () => {
  for (const options of [
    { database: null },
    { photo: null },
    { photo: { property_id: 'another-property', data_url: dataUrl } },
    { photo: { property_id: propertyId, data_url: 'https://evil.example.invalid/private' } },
    { photo: { property_id: propertyId, data_url: 'data:image/svg+xml;base64,PHN2Zy8+' } },
  ]) {
    const { api, fetches } = load({ backend: 'firebase', ...options });
    await assert.rejects(api.fetchPropertyPhoto(firestoreUrl, propertyId));
    assert.equal(fetches.length, 0);
  }
});

test('public, relative and Blob photos download without tokens, cookies or referrers', async () => {
  for (const [src, expected] of [
    ['https://images.example.invalid/photo.jpg', 'https://images.example.invalid/photo.jpg'],
    ['http://localhost/photo.png', 'http://localhost/photo.png'],
    ['/photo.png', 'https://site.example.invalid/photo.png'],
    ['blob:https://site.example.invalid/photo', 'blob:https://site.example.invalid/photo'],
  ]) {
    const { api, fetches, previews, reads } = load();
    const controller = new AbortController();
    await api.fetchPropertyPhoto(src, propertyId, controller.signal);
    assert.equal(fetches.length, 1); assert.equal(fetches[0].src, expected);
    assert.equal(fetches[0].options.credentials, 'omit'); assert.equal(fetches[0].options.mode, 'cors');
    assert.equal(fetches[0].options.referrerPolicy, 'no-referrer');
    assert.equal(fetches[0].options.signal, controller.signal);
    assert.equal(fetches[0].options.headers, undefined);
    assert.equal(previews.length, 0); assert.equal(reads.length, 0);
  }
});

test('raster data URLs decode the original binary bytes and MIME locally without a CSP-gated fetch', async () => {
  const original = Buffer.from([0, 128, 255, 65]);
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'IMAGE/PNG']) {
    const { api, fetches, previews, reads } = load({ fetchPhoto: () => { throw Error('Data URLs must not be fetched'); } });
    const blob = await api.fetchPropertyPhoto(`data:${type};base64,${original.toString('base64')}`, propertyId);
    assert.equal(blob.type, type.toLowerCase());
    assert.deepEqual(Buffer.from(await blob.arrayBuffer()), original);
    assert.equal(fetches.length, 0); assert.equal(previews.length, 0); assert.equal(reads.length, 0);
  }
});

test('data URL decoding handles valid base64 padding and rejects malformed or empty payloads without fetching', async () => {
  for (const [encoded, expected] of [['QQ==', 'A'], ['QUI=', 'AB'], ['QUJD', 'ABC'], ['QQ', 'A'], ['QUI', 'AB']]) {
    const { api, fetches } = load();
    const blob = await api.fetchPropertyPhoto(`data:image/png;base64,${encoded}`, propertyId);
    assert.equal(await blob.text(), expected); assert.equal(fetches.length, 0);
  }
  for (const encoded of ['', 'A', 'AA=', 'AA===', '%%%%']) {
    const { api, fetches } = load();
    await assert.rejects(api.fetchPropertyPhoto(`data:image/png;base64,${encoded}`, propertyId));
    assert.equal(fetches.length, 0);
  }
});

test('unsafe URL schemes, embedded credentials and active data URLs fail before fetching', async () => {
  for (const src of [
    'javascript:alert(1)', 'file:///tmp/photo.png', 'https://user:secret@example.invalid/photo.png',
    'data:text/html;base64,PHNjcmlwdD4=', 'data:image/svg+xml;base64,PHN2Zy8+',
  ]) {
    const { api, fetches } = load();
    await assert.rejects(api.fetchPropertyPhoto(src, propertyId));
    assert.equal(fetches.length, 0);
  }
});

test('downloads preserve bytes and MIME for JPEG, PNG, WebP and legacy GIF images', async () => {
  for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
    const { api } = load({ fetchPhoto: () => new Response('original-bytes', { headers: { 'Content-Type': type } }) });
    const blob = await api.fetchPropertyPhoto('https://images.example.invalid/photo', propertyId);
    assert.equal(blob.type, type); assert.equal(await blob.text(), 'original-bytes');
  }
});

test('HTTP errors, empty images, unsupported MIME types and network errors remain failures', async () => {
  for (const response of [
    new Response('missing', { status: 404, headers: { 'Content-Type': 'image/png' } }),
    new Response('', { headers: { 'Content-Type': 'image/png' } }),
    new Response('html', { headers: { 'Content-Type': 'text/html' } }),
    new Response('<svg/>', { headers: { 'Content-Type': 'image/svg+xml' } }),
    new Response('bytes'),
  ]) {
    const { api } = load({ fetchPhoto: () => response });
    await assert.rejects(api.fetchPropertyPhoto('https://images.example.invalid/photo', propertyId));
  }
  const { api } = load({ fetchPhoto: () => { throw new TypeError('CORS blocked'); } });
  await assert.rejects(api.fetchPropertyPhoto('https://images.example.invalid/photo', propertyId), /CORS blocked/);
});

test('already canceled requests do not fetch photos or read media documents', async () => {
  for (const [backend, src] of [['cloudflare', cloudflareUrl], ['firebase', firestoreUrl], ['cloudflare', dataUrl]]) {
    const { api, fetches, reads, previews } = load({ backend });
    const controller = new AbortController(); controller.abort();
    await assert.rejects(api.fetchPropertyPhoto(src, propertyId, controller.signal), { name: 'AbortError' });
    assert.equal(fetches.length, 0); assert.equal(reads.length, 0); assert.equal(previews.length, 0);
  }
});

test('late generic and Cloudflare fetch completions are ignored after cancellation', async () => {
  for (const src of ['https://images.example.invalid/photo', cloudflareUrl]) {
    const controller = new AbortController();
    const { api } = load({
      fetchPhoto: () => { controller.abort(); return new Response('photo', { headers: { 'Content-Type': 'image/png' } }); },
      previewPhoto: () => { controller.abort(); return new Blob(['photo'], { type: 'image/png' }); },
    });
    await assert.rejects(api.fetchPropertyPhoto(src, propertyId, controller.signal), { name: 'AbortError' });
  }
});

test('cancellation during Firestore hydration prevents fetching the returned private data', async () => {
  const controller = new AbortController();
  const { api, fetches } = load({
    backend: 'firebase',
    readPhoto: () => { controller.abort(); return { property_id: propertyId, data_url: dataUrl }; },
  });
  await assert.rejects(api.fetchPropertyPhoto(firestoreUrl, propertyId, controller.signal), { name: 'AbortError' });
  assert.equal(fetches.length, 0);
});

test('cancellation during body download prevents returning a completed Blob', async () => {
  const controller = new AbortController();
  const { api } = load({ fetchPhoto: () => ({
    ok: true,
    headers: new Headers({ 'Content-Type': 'image/png' }),
    blob: async () => { controller.abort(); return new Blob(['photo'], { type: 'image/png' }); },
  }) });
  await assert.rejects(api.fetchPropertyPhoto('https://images.example.invalid/photo', propertyId, controller.signal), { name: 'AbortError' });
});

test('filenames use the property code, cover-first ordering and the actual MIME extension', () => {
  const { api } = load();
  for (const [type, extension] of [['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp'], ['image/gif', 'gif']]) {
    assert.equal(api.propertyPhotoFilename('prop-01', 0, type), `CK-01-facebook-01.${extension}`);
    assert.equal(api.propertyPhotoFilename('ck-ab1234', 11, type), `CK-AB1234-facebook-12.${extension}`);
  }
  assert.equal(api.propertyPhotoFilename('prop-01', 1, 'IMAGE/PNG; charset=binary'), 'CK-01-facebook-02.png');
  assert.match(api.propertyPhotoFilename('../a', 0, 'image/png'), /^[A-Za-z0-9_-]+\.png$/);
  assert.throws(() => api.propertyPhotoFilename('prop-01', 0, 'text/html'));
  assert.throws(() => api.propertyPhotoFilename('prop-01', 0, '__proto__'));
});

test('saving a download clicks an attached anchor, removes it and revokes the Blob URL later', () => {
  const { api, created, links, timers, revoked } = load();
  const blob = new Blob(['original'], { type: 'image/png' });
  api.savePhotoDownload(blob, 'CK-01-facebook-01.png');
  assert.equal(created.length, 1); assert.equal(created[0].blob, blob);
  assert.equal(links.length, 1); assert.equal(links[0].href, created[0].url);
  assert.equal(links[0].download, 'CK-01-facebook-01.png');
  assert.equal(links[0].clicks, 1); assert.equal(links[0].attached, false);
  assert.equal(revoked.length, 0); assert.equal(timers.length, 1); assert.equal(timers[0].delay, 60_000);
  timers[0].run(); assert.deepEqual(revoked, [created[0].url]);
});
