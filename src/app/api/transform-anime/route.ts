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
    // CRITICAL: Preserve white parts of the subject (white clothes, white hair, etc.) - do NOT treat them as background!
    const response = await client.generate({
      prompt: 'Convert ONLY the person/subject in this image to Q-version cute chibi manga cartoon style. STRICT RULES: 1) Keep EXACTLY the same facial expression, emotion, eyes, mouth, and smile - the face must look identical to the original 2) Keep EXACTLY the same body orientation and facing direction - if the original faces left/right/front/back, the result must face the same direction 3) Keep EXACTLY the same hairstyle and hair color - every strand and shape must be preserved 4) Keep EXACTLY the same pose, gesture, posture, and body language 5) Keep ALL accessories in the SAME position - glasses must stay on eyes, hats on head, earrings on ears, necklaces on neck, etc. 6) PRESERVE ALL WHITE PARTS OF THE SUBJECT - white clothes, white hair, white accessories, white skin highlights are part of the character, NOT background 7) The output MUST have TRANSPARENT BACKGROUND - only the area OUTSIDE the character should be transparent 8) Clean kawaii anime vector style with soft pastel colors 9) No watermark, text, signature, border, or frame anywhere',
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
