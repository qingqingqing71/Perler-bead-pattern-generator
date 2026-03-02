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
      prompt: 'Convert ONLY the person/subject in this image to Q-version cute chibi manga cartoon style. STRICT RULES: 1) Keep EXACTLY the same facial expression, emotion, and mood - eyes, mouth, smile must be identical to original 2) Keep EXACTLY the same body orientation, facing direction, pose, gesture, and posture 3) Keep the same hairstyle and hair color 4) PRESERVE ALL WHITE PARTS OF THE SUBJECT - white clothes, white hair, white accessories, white skin highlights, and any white elements that are part of the character MUST be kept as part of the character, NOT treated as background 5) The output MUST have TRANSPARENT BACKGROUND - only the area OUTSIDE the character should be transparent 6) Only output the character/subject itself, no background elements at all 7) The character should be isolated on a fully transparent alpha channel 8) Clean kawaii anime vector style with soft pastel colors 9) No watermark, text, signature, border, or frame anywhere',
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
