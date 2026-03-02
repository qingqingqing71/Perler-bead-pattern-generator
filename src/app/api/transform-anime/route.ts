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
    // Key requirements: keep pose/expression, transparent background, subject only
    const response = await client.generate({
      prompt: 'Transform this person into Q-version cute manga chibi style. CRITICAL REQUIREMENTS: 1) Keep exactly the same pose, posture, gesture, body language, facial expression and emotion as the original image 2) Maintain the same hairstyle and hair color 3) Output ONLY the character subject with COMPLETELY TRANSPARENT BACKGROUND - no white background, no solid background, no gradient background 4) The subject must be isolated on transparent/alpha channel background 5) No background elements, no scenery, no environment 6) Clean vector art style with soft pastel colors 7) No watermark, no text, no signature, no border',
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
