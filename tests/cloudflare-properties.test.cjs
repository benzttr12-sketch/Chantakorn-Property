const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const observed = '2026-10-20T00:00:00.000Z';
const newer = '2026-10-20T00:01:00.000Z';
const imageId = '7537cedc-3fbf-4df9-9741-82757f583628';
const sample = { id: 'ck-123456', title: 'Original', images: [], features: [], updated_at: observed };
const source = ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../src/lib/cloudflare-properties.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

function load(handler, staff = true) {
  const calls = [];
  const module = { exports: {} };
  const context = vm.createContext({
    console, URL, URLSearchParams, Headers, Blob, Uint8Array, atob,
    process: { env: {
      NEXT_PUBLIC_PROPERTY_STORAGE_BACKEND: 'cloudflare',
      NEXT_PUBLIC_CLOUDFLARE_API_ORIGIN: 'https://staging-api.example.invalid',
    } },
    fetch: async (url, options) => {
      const call = { path: new URL(url).pathname, params: new URL(url).searchParams, ...options };
      calls.push(call);
      assert.equal(call.headers.get('Authorization'), staff ? 'Bearer signed-test-token' : null);
      assert.equal(call.cache, staff ? 'no-store' : 'default');
      return handler(call);
    },
  });
  const requireModule = name => {
    if (name !== '@/lib/firebase/client') throw new Error(name);
    return { auth: { authStateReady: async () => {}, currentUser: { getIdToken: async () => 'signed-test-token' } } };
  };
  vm.runInContext(`(function(require,module,exports){${source}\n})`, context)(requireModule, module, module.exports);
  return { adapter: module.exports, calls };
}

const json = (value, status = 200) => Response.json(value, { status });
const uploadSessionId = '7537cedc-3fbf-4df9-9741-82757f5836aa';
const isSessionCall = call => call.method === 'POST' && call.path.endsWith('/sessions');
const sessionResponse = (ownerId, uploads) => json({
  session_id: uploadSessionId, owner_id: ownerId,
  expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), max_uploads: uploads,
}, 201);

test('compatibility catalog rejects malformed pagination rather than returning incomplete results', async () => {
  for (const admin of [false, true]) {
    for (const body of [
      { data: [sample] }, { data: [sample], next_cursor: '' },
      { data: [sample], next_cursor: false }, { data: [sample], next_cursor: 'x'.repeat(513) },
      { data: Array(admin ? 81 : 31).fill(sample), next_cursor: null },
    ]) {
      const { adapter, calls } = load(() => json(body), admin);
      await assert.rejects(adapter.cloudflareListProperties(admin), /หน้าถัดไป/);
      assert.equal(calls.length, 1);
    }
  }
});

test('compatibility catalog follows pages and stops only at explicit null', async () => {
  for (const admin of [false, true]) {
    const { adapter, calls } = load(call => {
      assert.equal(call.params.get('limit'), admin ? '80' : '30');
      return json({ data: [sample], next_cursor: call.params.has('cursor') ? null : 'next' });
    }, admin);
    assert.equal((await adapter.cloudflareListProperties(admin)).length, 2);
    assert.equal(calls.length, 2);
  }
});

test('compatibility catalog stops cursor cycles and rejects catalogs beyond ten pages', async () => {
  for (const admin of [false, true]) {
    const cyclic = load(() => json({ data: [sample], next_cursor: 'repeat' }), admin);
    await assert.rejects(cyclic.adapter.cloudflareListProperties(admin), /cursor ซ้ำ/);
    assert.equal(cyclic.calls.length, 2);
    let n = 0;
    const large = load(() => json({ data: [sample], next_cursor: `next-${++n}` }), admin);
    await assert.rejects(large.adapter.cloudflareListProperties(admin), /Pagination/);
    assert.equal(large.calls.length, 10);
  }
});

test('an old editor cannot overwrite a newer listing or upload images before detecting the conflict', async () => {
  const { adapter, calls } = load(call => {
    assert.equal(call.method, undefined);
    return json({ data: { ...sample, title: 'Saved by another staff member', updated_at: newer } });
  });
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    title: 'Old form', images: ['data:image/jpeg;base64,/9j/'],
  }, observed), /ประกาศมีการแก้ไขแล้ว/);
  assert.equal(calls.length, 1);
});

test('updates and deletes require an observed canonical revision before accessing the API', async () => {
  const { adapter, calls } = load(() => { throw new Error('Unexpected request'); });
  for (const revision of [undefined, '', 'invalid', '2026-10-20']) {
    await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, { price: 100 }, revision), /โหลดประกาศใหม่/);
    await assert.rejects(adapter.cloudflareDeleteProperty(sample.id, revision), /โหลดประกาศใหม่/);
  }
  assert.equal(calls.length, 0);
});

test('a successful edit sends the revision originally observed by the caller', async () => {
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    assert.equal(call.method, 'PATCH');
    assert.deepEqual(JSON.parse(call.body), { updates: { price: 900000 }, expected_updated_at: observed });
    return json({ data: { ...sample, price: 900000, updated_at: newer } });
  });
  const result = await adapter.cloudflareUpdateProperty(sample.id, { price: 900000 }, observed);
  assert.equal(result.price, 900000);
  assert.equal(result.updated_at, newer);
  assert.equal(calls.length, 2);
});

test('an edit racing with an image upload keeps its old revision and surfaces 409 without retrying', async () => {
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    if (isSessionCall(call)) return sessionResponse(sample.id, 1);
    if (call.method === 'POST') {
      assert.equal(call.path, '/v1/media/properties/' + sample.id);
      return json({ media_id: imageId, media_path: '/v1/media/properties/' + imageId }, 201);
    }
    assert.equal(call.method, 'PATCH');
    assert.equal(JSON.parse(call.body).expected_updated_at, observed);
    return json({ error: 'This listing has changed; reload before editing' }, 409);
  });
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    title: 'Old form', images: ['data:image/jpeg;base64,/9j/'],
  }, observed), /listing has changed/);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'POST', 'PATCH']);
});

test('the complete photo batch is validated before creating a draft or uploading the first image', async () => {
  const good = 'data:image/jpeg;base64,/9j/';
  for (const bad of [
    'https://unrelated.example.invalid/photo.jpg',
    'data:image/jpeg;base64,A',
    'data:image/jpeg;base64,AA=A',
    'data:image/png;base64,' + Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64'),
  ]) {
    const updating = load(call => {
      assert.equal(call.method, undefined);
      return json({ data: sample });
    });
    await assert.rejects(updating.adapter.cloudflareUpdateProperty(sample.id, { images: [good, bad] }, observed), /รูป/);
    assert.deepEqual(updating.calls.map(call => call.method || 'GET'), ['GET']);
    const creating = load(() => { throw new Error('Unexpected request'); });
    await assert.rejects(creating.adapter.cloudflareCreateProperty({ ...sample, images: [good, bad] }), /รูป/);
    assert.equal(creating.calls.length, 0);
  }
});

test('an unrelated cover is rejected before uploading valid new photos', async () => {
  for (const cover of [
    'data:image/png;base64,aGVsbG8=',
    'https://staging-api.example.invalid/v1/media/properties/' + imageId,
    'https://unrelated.example.invalid/cover.jpg',
  ]) {
    const { adapter, calls } = load(call => {
      assert.equal(call.method, undefined);
      return json({ data: sample });
    });
    await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
      images: ['data:image/jpeg;base64,/9j/'], cover_image: cover,
    }, observed), /รูปปก/);
    assert.equal(calls.length, 1);
  }
});

test('new photos require a separately saved unpublished listing before upload', async () => {
  for (const extra of [{}, { published: false }]) {
    const { adapter, calls } = load(call => {
      assert.equal(call.method, undefined);
      return json({ data: { ...sample, published: true } });
    });
    await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
      ...extra, images: ['data:image/jpeg;base64,/9j/'],
    }, observed), /ยกเลิกการเผยแพร่ประกาศและโหลดใหม่/);
    assert.equal(calls.length, 1);
  }
});

test('images-only edits deduplicate uploads and return refreshed media instead of stale detail', async () => {
  const photo = 'data:image/jpeg;base64,/9j/';
  let uploaded = false;
  const { adapter, calls } = load(call => {
    if (!call.method) {
      return json({ data: { ...sample, images: uploaded ? ['/v1/media/properties/' + imageId] : [] } });
    }
    if (isSessionCall(call)) return sessionResponse(sample.id, 1);
    if (call.method === 'POST') {
      uploaded = true;
      return json({ media_id: imageId, media_path: '/v1/media/properties/' + imageId }, 201);
    }
    throw new Error('Unexpected request');
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, { images: [photo, photo] }, observed);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'POST', 'GET']);
  assert.equal(saved.images.length, 1);
  assert.equal(saved.images[0], 'https://staging-api.example.invalid/v1/media/properties/' + imageId);
});

test('deduplicated uploads keep the selected cover and observed revision in the final patch', async () => {
  const first = 'data:image/jpeg;base64,/9j/', second = 'data:image/png;base64,aGVsbG8=';
  const secondId = '7537cedc-3fbf-4df9-9741-82757f583629';
  let uploaded = 0;
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    if (isSessionCall(call)) {
      assert.equal(call.params.get('uploads'), '2');
      return sessionResponse(sample.id, 2);
    }
    if (call.method === 'POST') {
      const id = ++uploaded === 1 ? imageId : secondId;
      return json({ media_id: id, media_path: '/v1/media/properties/' + id }, 201);
    }
    assert.equal(call.method, 'PATCH');
    assert.deepEqual(JSON.parse(call.body), {
      updates: { price: 900000 }, expected_updated_at: observed, cover_media_id: secondId,
    });
    return json({ data: { ...sample, cover_image: '/v1/media/properties/' + secondId, updated_at: newer } });
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, {
    price: 900000, images: [first, first, second], cover_image: second,
  }, observed);
  assert.equal(uploaded, 2);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'POST', 'POST', 'PATCH']);
  assert.equal(saved.cover_image, 'https://staging-api.example.invalid/v1/media/properties/' + secondId);
});

test('existing R2 photos may remain or become the cover without uploading them again', async () => {
  const path = '/v1/media/properties/' + imageId;
  const imageUrl = 'https://staging-api.example.invalid' + path;
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: { ...sample, images: [path], published: true } });
    assert.equal(call.method, 'PATCH');
    assert.deepEqual(JSON.parse(call.body), { updates: {}, expected_updated_at: observed, cover_media_id: imageId });
    return json({ data: { ...sample, images: [path], cover_image: path, updated_at: newer } });
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, { images: [imageUrl], cover_image: imageUrl }, observed);
  assert.equal(saved.cover_image, imageUrl);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'PATCH']);
});

test('removing saved photos patches the new cover before deleting only the removed media', async () => {
  const origin = 'https://staging-api.example.invalid';
  const coverId = imageId, removedId = '7537cedc-3fbf-4df9-9741-82757f583629';
  const removedPath = '/v1/media/properties/' + removedId;
  let deleted = false;
  const { adapter, calls } = load(call => {
    if (!call.method) {
      return json({ data: deleted
        ? { ...sample, images: ['/v1/media/properties/' + coverId], cover_image: '/v1/media/properties/' + coverId, updated_at: newer }
        : { ...sample, images: ['/v1/media/properties/' + coverId, removedPath],
          cover_image: '/v1/media/properties/' + coverId } });
    }
    if (call.method === 'PATCH') {
      assert.deepEqual(JSON.parse(call.body), {
        updates: { price: 800000 }, expected_updated_at: observed, cover_media_id: coverId,
      });
      return json({ data: { ...sample, images: ['/v1/media/properties/' + coverId, removedPath],
        cover_image: '/v1/media/properties/' + coverId, updated_at: newer } });
    }
    assert.equal(call.method, 'DELETE');
    assert.equal(call.path, '/v1/media/properties/' + sample.id + '/' + removedId);
    deleted = true;
    return json({ ok: true, media_id: removedId, object_deleted: true });
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, {
    price: 800000, images: [origin + '/v1/media/properties/' + coverId],
    cover_image: origin + '/v1/media/properties/' + coverId,
  }, observed);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'PATCH', 'DELETE', 'GET']);
  assert.equal(saved.images.length, 1);
  assert.equal(saved.cover_image, origin + '/v1/media/properties/' + coverId);
});

test('removal-only saves delete media without a redundant patch or upload', async () => {
  const origin = 'https://staging-api.example.invalid';
  const keptId = imageId, removedId = '7537cedc-3fbf-4df9-9741-82757f583629';
  let deleted = false;
  const { adapter, calls } = load(call => {
    if (!call.method) {
      return json({ data: deleted
        ? { ...sample, images: ['/v1/media/properties/' + keptId], cover_image: '/v1/media/properties/' + keptId, updated_at: newer }
        : { ...sample, images: ['/v1/media/properties/' + keptId, '/v1/media/properties/' + removedId],
          cover_image: '/v1/media/properties/' + keptId } });
    }
    assert.equal(call.method, 'DELETE');
    deleted = true;
    return json({ ok: true, media_id: removedId, object_deleted: true });
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, {
    images: [origin + '/v1/media/properties/' + keptId],
  }, observed);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'DELETE', 'GET']);
  assert.equal(saved.images.length, 1);
});

test('adding and removing photos in one save uploads first, patches, then deletes', async () => {
  const origin = 'https://staging-api.example.invalid';
  const removedId = imageId;
  const newPhoto = 'data:image/jpeg;base64,/9j/';
  const uploadedId = '7537cedc-3fbf-4df9-9741-82757f583630';
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: { ...sample, images: ['/v1/media/properties/' + removedId] } });
    if (isSessionCall(call)) return sessionResponse(sample.id, 1);
    if (call.method === 'POST') {
      return json({ media_id: uploadedId, media_path: '/v1/media/properties/' + uploadedId }, 201);
    }
    if (call.method === 'PATCH') {
      assert.deepEqual(JSON.parse(call.body), {
        updates: {}, expected_updated_at: observed, cover_media_id: uploadedId,
      });
      return json({ data: { ...sample, images: ['/v1/media/properties/' + uploadedId],
        cover_image: '/v1/media/properties/' + uploadedId, updated_at: newer } });
    }
    assert.equal(call.method, 'DELETE');
    assert.equal(call.path, '/v1/media/properties/' + sample.id + '/' + removedId);
    return json({ ok: true, media_id: removedId, object_deleted: true });
  });
  const saved = await adapter.cloudflareUpdateProperty(sample.id, {
    images: [newPhoto], cover_image: newPhoto,
  }, observed);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'POST', 'POST', 'PATCH', 'DELETE', 'GET']);
  assert.equal(saved.images.length, 1);
});

test('uploads request one bounded session and send its header on every file', async () => {
  const first = 'data:image/jpeg;base64,/9j/', second = 'data:image/png;base64,aGVsbG8=';
  const secondId = '7537cedc-3fbf-4df9-9741-82757f583629';
  let uploads = 0;
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: sample });
    if (isSessionCall(call)) {
      assert.equal(call.path, '/v1/media/properties/' + sample.id + '/sessions');
      assert.equal(call.params.get('uploads'), '2');
      return sessionResponse(sample.id, 2);
    }
    if (call.method === 'POST') {
      assert.equal(call.headers.get('X-Upload-Session'), uploadSessionId);
      const id = ++uploads === 1 ? imageId : secondId;
      return json({ media_id: id, media_path: '/v1/media/properties/' + id }, 201);
    }
    assert.equal(call.method, 'PATCH');
    return json({ data: { ...sample, cover_image: '/v1/media/properties/' + secondId, updated_at: newer } });
  });
  await adapter.cloudflareUpdateProperty(sample.id, { images: [first, second], cover_image: second }, observed);
  assert.equal(calls.filter(isSessionCall).length, 1);
  assert.equal(calls.filter(call => call.method === 'POST' && !isSessionCall(call)).length, 2);
  assert.equal(uploads, 2);
});

test('a rejected or malformed upload session stops the batch before any upload', async () => {
  for (const [body, pattern] of [
    [{ error: 'Only 0 image slots remain' }, /image slots/],
    [{ session_id: uploadSessionId, owner_id: 'other-property', expires_at: new Date(Date.now() + 600000).toISOString(), max_uploads: 1 }, /upload session ไม่ถูกต้อง/],
    [{ session_id: uploadSessionId, owner_id: sample.id, expires_at: '2000-01-01T00:00:00.000Z', max_uploads: 1 }, /upload session ไม่ถูกต้อง/],
  ]) {
    const { adapter, calls } = load(call => {
      if (!call.method) return json({ data: sample });
      assert.ok(isSessionCall(call));
      return body.error ? json(body, 400) : json(body, 201);
    });
    await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
      images: ['data:image/jpeg;base64,/9j/'],
    }, observed), pattern);
    assert.equal(calls.filter(call => call.method === 'POST' && !isSessionCall(call)).length, 0);
  }
});

test('removing photos from a published listing fails before uploading replacements', async () => {
  const path = '/v1/media/properties/' + imageId;
  const { adapter, calls } = load(() => json({ data: {
    ...sample, images: [path], cover_image: path, published: true,
  } }));
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    images: ['data:image/jpeg;base64,/9j/'],
  }, observed), /ยกเลิกการเผยแพร่ประกาศและโหลดใหม่ก่อนเพิ่มหรือลบรูปภาพ/);
  assert.equal(calls.length, 1);
});

test('removing the photo that stays selected as cover is rejected before any write', async () => {
  const origin = 'https://staging-api.example.invalid';
  const path = '/v1/media/properties/' + imageId;
  const { adapter, calls } = load(() => json({ data: { ...sample, images: [path], cover_image: path } }));
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    images: [], cover_image: origin + path,
  }, observed), /รูปปกต้องไม่ใช่รูปที่จะลบ/);
  assert.equal(calls.length, 1);
});

test('a failed media delete reports that the listing itself was already saved', async () => {
  const path = '/v1/media/properties/' + imageId;
  const { adapter, calls } = load(call => {
    if (!call.method) return json({ data: { ...sample, images: [path], cover_image: path } });
    if (call.method === 'PATCH') return json({ data: { ...sample, images: [path], cover_image: '', updated_at: newer } });
    assert.equal(call.method, 'DELETE');
    return json({ error: 'Listing changed; reload before removing photos' }, 409);
  });
  await assert.rejects(adapter.cloudflareUpdateProperty(sample.id, {
    images: [], cover_image: '',
  }, observed), /บันทึกข้อมูลแล้ว แต่ลบรูปภาพไม่สำเร็จ/);
  assert.deepEqual(calls.map(call => call.method || 'GET'), ['GET', 'PATCH', 'DELETE']);
});

test('a stale delete sends the observed revision directly and never refreshes it to bypass a conflict', async () => {
  const { adapter, calls } = load(call => {
    assert.equal(call.method, 'DELETE');
    assert.deepEqual(JSON.parse(call.body), { expected_updated_at: observed });
    return json({ error: 'Property not found or revision changed' }, 409);
  });
  await assert.rejects(adapter.cloudflareDeleteProperty(sample.id, observed), /revision changed/);
  assert.equal(calls.length, 1);
});

test('public page makes one bounded anonymous request with filters and cancellation', async () => {
  const controller = new AbortController();
  const { adapter, calls } = load(call => {
    assert.equal(call.params.get('limit'), '24');
    assert.equal(call.params.get('cursor'), 'page-two');
    assert.equal(call.params.get('sortBy'), 'price_asc');
    assert.equal(call.params.get('type'), null);
    assert.equal(call.params.get('bedrooms'), null);
    assert.equal(call.params.get('featured'), 'false');
    assert.deepEqual(JSON.parse(call.params.get('features')), ['สวน']);
    assert.equal(call.signal, controller.signal);
    return json({ data: [sample], next_cursor: 'page-three' });
  }, false);
  const page = await adapter.cloudflarePropertyPage({ type: 'all', bedrooms: 'any', featured: false,
    sortBy: 'price_asc', features: ['สวน'] }, 'page-two', controller.signal);
  assert.equal(calls.length, 1); assert.equal(page.nextCursor, 'page-three');
});

test('public page rejects repeated cursors and oversized pages without fetching more', async () => {
  for (const body of [{ data: [sample], next_cursor: 'same' }, { data: Array(25).fill(sample), next_cursor: null }]) {
    const { adapter, calls } = load(() => json(body), false);
    await assert.rejects(adapter.cloudflarePropertyPage({}, 'same'), /หน้าถัดไป/);
    assert.equal(calls.length, 1);
  }
});

test('Admin page adapter forwards server filters, counts and a single bounded request', async () => {
  const counts = { all: 3, sale: 2, rent: 1, featured: 1, draft: 2, published: 1 };
  const { adapter, calls } = load(call => {
    assert.equal(call.path, '/v1/admin/properties');
    assert.equal(call.method, undefined);
    assert.equal(call.params.get('limit'), '50');
    assert.equal(call.params.get('searchQuery'), 'วิลล่า');
    assert.equal(call.params.get('filter'), 'draft');
    assert.equal(call.params.get('type'), 'house');
    assert.equal(call.params.get('district'), 'หาดใหญ่');
    assert.equal(call.params.get('sortBy'), 'price_desc');
    assert.equal(call.params.get('cursor'), null);
    return json({ data: [sample], total: 3, next_cursor: 'next-page', counts });
  });
  const page = await adapter.cloudflareAdminPropertyPage({
    searchQuery: ' วิลล่า ', filter: 'draft', type: 'house', district: 'หาดใหญ่', sortBy: 'price_desc',
  });
  assert.equal(page.total, 3);
  assert.equal(page.nextCursor, 'next-page');
  assert.deepEqual(page.counts, counts);
  assert.equal(page.data.length, 1);
  assert.equal(calls.length, 1);
});

test('Admin page adapter rejects malformed totals, counts, cursors and oversized pages', async () => {
  const counts = { all: 1, sale: 1, rent: 0, featured: 0, draft: 1, published: 0 };
  for (const body of [
    { data: [sample], total: 1, next_cursor: null },
    { data: [sample], total: 2, next_cursor: null, counts },
    { data: [sample], total: 1, next_cursor: '', counts },
    { data: [sample], total: 1, next_cursor: 'x'.repeat(513), counts },
    { data: Array(51).fill(sample), total: 51, next_cursor: null, counts: { ...counts, all: 51 } },
    { data: [sample], total: -1, next_cursor: null, counts: { ...counts, all: -1 } },
    { data: 'not an array', total: 1, next_cursor: null, counts },
    { data: [sample], total: 1, next_cursor: null, counts: { ...counts, featured: '1' } },
  ]) {
    const { adapter } = load(() => json(body));
    await assert.rejects(adapter.cloudflareAdminPropertyPage(), /หน้าถัดไป/);
  }
});

test('Admin page adapter supports a bounded custom page size for whole-catalog iteration', async () => {
  const counts = { all: 1, sale: 1, rent: 0, featured: 0, draft: 1, published: 0 };
  const { adapter, calls } = load(call => {
    assert.equal(call.params.get('limit'), '100');
    return json({ data: [sample], total: 1, next_cursor: null, counts });
  });
  const page = await adapter.cloudflareAdminPropertyPage({}, null, 100);
  assert.equal(page.data.length, 1);
  assert.equal(calls.length, 1);
  for (const size of [0, 101, 2.5, '50']) {
    await assert.rejects(adapter.cloudflareAdminPropertyPage({}, null, size), /ขนาดหน้า/);
  }
  const oversize = load(() => json({
    data: Array(101).fill(sample), total: 101, next_cursor: null, counts: { ...counts, all: 101 },
  }));
  await assert.rejects(oversize.adapter.cloudflareAdminPropertyPage({}, null, 100), /หน้าถัดไป/);
});
