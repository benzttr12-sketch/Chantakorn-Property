import { auth, storage } from '@/lib/firebase/client';
import { dataBackend } from '@/lib/backend';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export const isImageUploadEnabled = dataBackend === 'firebase' && Boolean(storage);

export async function uploadImage(dataUrl: string, kind: 'property' | 'avatar'): Promise<string> {
  if (!isImageUploadEnabled || !storage || !auth) {
    throw new Error('ยังไม่เปิดอัปโหลดไฟล์ กรุณาใช้ลิงก์รูปภาพ HTTPS');
  }
  await auth.authStateReady();
  if (!auth.currentUser) throw new Error('กรุณาเข้าสู่ระบบก่อนอัปโหลดรูปภาพ');
  if (!/^data:image\/(jpeg|png|webp);base64,/.test(dataUrl) || dataUrl.length > 6_500_000) {
    throw new Error('รองรับรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
  }
  const file = ref(storage, `${kind}/${auth.currentUser.uid}/${crypto.randomUUID()}`);
  await uploadString(file, dataUrl, 'data_url');
  return getDownloadURL(file);
}

export async function preparePropertyImages(images: string[], cover: string) {
  const urls = new Map<string, string>();
  for (const image of Array.from(new Set([...images, cover]))) {
    if (image.startsWith('data:')) urls.set(image, await uploadImage(image, 'property'));
    else if (image.startsWith('https://') || (process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS === 'true' && image.startsWith('http://127.0.0.1:9199/'))) urls.set(image, image);
    else throw new Error('รูปภาพต้องเป็นไฟล์ที่อัปโหลดหรือ URL HTTPS');
  }
  return { images: images.map(image => urls.get(image)!), cover_image: urls.get(cover)! };
}
