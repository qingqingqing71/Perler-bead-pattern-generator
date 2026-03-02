import { NextRequest, NextResponse } from 'next/server';
import { ImageGenerationClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64 } = await request.json();
    
    if (!imageBase64) {
      return NextResponse.json({ error: '缺少图像数据' }, { status: 400 });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new ImageGenerationClient(config, customHeaders);

    // Convert base64 to data URL if needed
    const imageUrl = imageBase64.startsWith('data:') 
      ? imageBase64 
      : `data:image/png;base64,${imageBase64}`;

    // Use image-to-image transformation with Q-version cute manga style prompt
    // IMPORTANT: Only transform the subject style, keep transparent background
    // CRITICAL: Preserve white parts of the subject as WHITE PIXELS, not transparent!
    const response = await client.generate({
      prompt: 'Convert ONLY the person/subject in this image to Q-version cute chibi manga cartoon style. STRICT RULES: 1) FACIAL EXPRESSION must be IDENTICAL - same eyes shape, eye size, eye direction, eyebrow position 2) MOUTH must be EXACTLY the same - if original mouth is open/closed/smiling/pouting, the result MUST be identical, same mouth opening size and shape 3) Keep EXACTLY the same body orientation and facing direction 4) Keep EXACTLY the same hairstyle and hair color 5) Keep EXACTLY the same pose, gesture, posture 6) ALL ACCESSORIES MUST BE IN IDENTICAL POSITION AND SHAPE - glasses, ski goggles, sunglasses, hats, caps, helmets, earrings, necklaces, watches, bags, scarves, any wearable items must appear at the EXACT same position with the EXACT same shape and size relative to the face/body 7) WHITE PIXELS MUST STAY WHITE - white clothes, white hair, white skin highlights, white accessories must remain as SOLID WHITE PIXELS, NEVER convert white areas to transparent 8) The output MUST have TRANSPARENT BACKGROUND - only areas OUTSIDE the character silhouette should be transparent, everything INSIDE the character including white parts must be solid colored pixels 9) Clean kawaii anime vector style with soft pastel colors 10) No watermark, text, signature, border, or frame anywhere',
      image: imageUrl,
      size: '2K',
    });

    const helper = client.getResponseHelper(response);

    if (helper.success && helper.imageUrls.length > 0) {
      return NextResponse.json({ 
        success: true, 
        imageUrl: helper.imageUrls[0] 
      });
    } else {
      return NextResponse.json({ 
        error: helper.errorMessages.join(', ') || '动漫风格转换失败' 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Anime transform error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '动漫风格转换失败' 
    }, { status: 500 });
  }
}
