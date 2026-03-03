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
    // Input: transparent background subject from AI segmentation (irregular edges)
    // Output: anime-style subject ONLY, edges follow subject contour (irregular, NOT rectangular canvas)
    const response = await client.generate({
      prompt: 'Style transfer ONLY - convert this transparent-background subject to Q-version cute chibi manga style. ABSOLUTE REQUIREMENTS: 1) OUTPUT EDGES MUST FOLLOW SUBJECT CONTOUR - the result should have IRREGULAR edges matching the subject shape, NEVER output a rectangular 4:3 or any standard canvas 2) CANVAS SIZE = SUBJECT SIZE - do NOT extend, pad, or fill to standard dimensions 3) ALL AREAS OUTSIDE SUBJECT = TRANSPARENT - no white fill, no background, no canvas extension 4) Keep same pose, orientation, hairstyle, hair color 5) Same facial expression, eye direction, mouth shape 6) Accessories in identical positions 7) Clean kawaii anime style with soft pastel colors 8) No watermark, text, border. The input is a cutout subject with irregular edges on transparent background - output MUST be the same, just styled differently.',
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
