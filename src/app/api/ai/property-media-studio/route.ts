import { jsonResponse } from '@/lib/api-response';
import { getGeminiClient } from '@/lib/gemini';
import { requireStaff } from '@/lib/server-auth';

export async function POST(req: Request) {
  const denied = await requireStaff(req);
  if (denied) return denied;

  try {
    const body = await req.json().catch(() => ({}));
    const { action, prompt, imageUrl, aspectRatio = '16:9', editStyle } = body;

    const ai = getGeminiClient();

    if (action === 'generate_video') {
      // Action: Veo 3.1 Fast Video Generation
      const finalPrompt = prompt || 'Cinematic luxury real estate video walkthrough showing interior and exterior with smooth camera panning, natural lighting, and high-end staging.';
      const selectedAspect = aspectRatio === '9:16' ? '9:16' : '16:9';

      if (ai) {
        try {
          // Attempt call with veo-3.1-fast-generate-preview
          const response = await (ai.models as any).generateVideos({
            model: 'veo-3.1-fast-generate-preview',
            prompt: finalPrompt,
            config: {
              aspectRatio: selectedAspect,
              numberOfVideos: 1,
            },
          }).catch(() => null);

          if (response?.generatedVideos?.[0]?.videoUri) {
            return jsonResponse({
              success: true,
              videoUrl: response.generatedVideos[0].videoUri,
              modelUsed: 'veo-3.1-fast-generate-preview',
              aspectRatio: selectedAspect,
              prompt: finalPrompt,
              message: 'วิดีโอถูกสร้างด้วย Veo 3.1 สำเร็จเรียบร้อยแล้ว',
            });
          }
        } catch (veoErr) {
          console.info('Veo generation failed');
        }
      }

      return jsonResponse({ success: false, error: 'บริการสร้างวิดีโอไม่ส่งผลลัพธ์กลับมา กรุณาตรวจสิทธิ์และโควตาโมเดล' }, { status: 503 });
    }

    if (action === 'edit_image') {
      // Action: Gemini 3.1 Flash Image Staging / Edit
      const finalPrompt = prompt || 'Modern luxury interior virtual home staging with warm natural sunlight, wooden furniture, and elegant decorations.';

      if (ai) {
        try {
          // Attempt image generation / edit with gemini-3.1-flash-image-preview
          const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image-preview',
            contents: [
              {
                text: `คุณคือซอฟต์แวร์ AI Virtual Staging สำหรับตกแต่งรูปภาพบ้านและอสังหาริมทรัพย์ระดับไฮเอนด์
โจทย์การตกแต่ง: "${finalPrompt}"
สไตล์ที่เลือก: "${editStyle || 'Modern Luxury'}"`
              }
            ],
          }).catch(() => null);

          const generatedImage = response?.candidates?.[0]?.content?.parts?.find(part => part.inlineData?.mimeType?.startsWith('image/'))?.inlineData;
          if (generatedImage?.data) {
            return jsonResponse({ success: true, imageUrl: `data:${generatedImage.mimeType};base64,${generatedImage.data}`, modelUsed: 'gemini-3.1-flash-image-preview', message: 'สร้างภาพสำเร็จแล้ว' });
          }
        } catch (imgErr) {
          console.info('Gemini image generation failed');
        }
      }

      return jsonResponse({ success: false, error: 'บริการสร้างภาพไม่ส่งผลลัพธ์กลับมา กรุณาตรวจสิทธิ์และโควตาโมเดล' }, { status: 503 });
    }

    return jsonResponse({ error: 'Invalid action provided' }, { status: 400 });
  } catch (err: any) {
    return jsonResponse({ error: err.message || 'Server error' }, { status: 500 });
  }
}
