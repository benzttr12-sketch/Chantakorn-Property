import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_MEDIA_BYTES, mediaExtension, readBoundedImage,
  sniffImage, validBrowserOrigin, validMediaId, validOwnerId,
} from '../src/media-validation.ts';

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0,0,0,0,0,0,0,0,0,0,0xff,0xd9]);
const png = new Uint8Array(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lE8AAAAASUVORK5CYII=', 'base64'));

const webp = new Uint8Array([
  82,73,70,70,12,0,0,0,87,69,66,80,86,80,56,32,0,0,0,0,
]);

function request(bytes: Uint8Array, contentType = 'image/jpeg', length = bytes.byteLength) {
  return new Request('https://example.test/upload', {
    method: 'POST', headers: { 'Content-Type': contentType, 'Content-Length': String(length) },
    body: bytes as unknown as BodyInit,
  });
}

test('rejects disallowed extensions and guesses type from bytes, not user claims', () => {
  assert.equal(sniffImage(jpeg), 'image/jpeg');
  assert.equal(sniffImage(png), 'image/png');
  assert.equal(sniffImage(webp), 'image/webp');
  assert.equal(sniffImage(new TextEncoder().encode('<svg><script>alert(1)</script></svg>')), null);
  assert.equal(sniffImage(new TextEncoder().encode('<html>not an image</html>')), null);
  assert.equal(mediaExtension('image/webp'), 'webp');
});

test('strict media identifiers and tenant-safe R2 prefixes', () => {
  assert.equal(validMediaId('7537cedc-3fbf-4df9-9741-82757f583628'), true);
  assert.equal(validMediaId('not-a-media-id'), false);
  assert.equal(validOwnerId('property_ABC-123'), true);
  for (const candidate of ['../customer', 'bad/uri', 'a'.repeat(100), '', '   ', '%2f']) {
    assert.equal(validOwnerId(candidate), false);
  }
});

test('only explicitly allowed browser origin can upload; origin is not auth', () => {
  assert.equal(validBrowserOrigin('http://localhost:3000', 'http://localhost:3000'), true);
  assert.equal(validBrowserOrigin('https://attacker.example', 'https://chantakornproperty.com'), false);
  assert.equal(validBrowserOrigin(null, 'https://chantakornproperty.com'), false);
  assert.equal(validBrowserOrigin('https://chantakornproperty.com.evil.test', 'https://chantakornproperty.com'), false);
});

test('bounds image streams and rejects type forgery', async () => {
  const good = await readBoundedImage(request(jpeg));
  assert.equal(good.ok, true);
  const forged = await readBoundedImage(request(jpeg, 'image/png'));
  assert.deepEqual(forged.ok, false);
  assert.equal(forged.ok ? 0 : forged.status, 415);
  const invalid = await readBoundedImage(request(new TextEncoder().encode('x'.repeat(30))));
  assert.equal(invalid.ok, false);
  const mismatch = await readBoundedImage(request(jpeg, 'image/jpeg', jpeg.length + 1));
  assert.equal(mismatch.ok, false);
  const tooLarge = await readBoundedImage(request(jpeg, 'image/jpeg', MAX_MEDIA_BYTES + 1));
  assert.equal(tooLarge.ok, false);
  assert.equal(tooLarge.ok ? 0 : tooLarge.status, 413);
  const missingLength = new Request('https://example.test/upload', {
    method: 'POST', headers: { 'Content-Type': 'image/jpeg' }, body: jpeg as unknown as BodyInit,
  });
  assert.equal((await readBoundedImage(missingLength)).ok, false);
});
