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
    // Input: transparent background subject from AI segmentation
    // Output: anime-style subject with similar size, NO canvas extension or padding
    const response = await client.generate({
      prompt: 'Convert this transparent-background subject to Q-version cute chibi manga cartoon style. CRITICAL RULES: 1) Output ONLY the subject, keep SAME SIZE and DIMENSIONS as input - do NOT extend canvas, do NOT add padding, do NOT resize to standard sizes 2) Keep EXACTLY the same body orientation and facing direction 3) Keep EXACTLY the same hairstyle and hair color 4) Keep EXACTLY the same pose, gesture, posture 5) FACIAL EXPRESSION must be IDENTICAL - same eyes shape, eye direction, eyebrow position 6) MOUTH must be EXACTLY the same - if original mouth is open/closed/smiling, the result MUST be identical 7) ACCESSORIES POSITION MUST MATCH - glasses, hats, earrings in identical positions 8) Maintain TRANSPARENT BACKGROUND - only output the anime-style subject, no background 9) Clean kawaii anime vector style with soft pastel colors 10) No watermark, text, signature, border, or frame anywhere',
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
