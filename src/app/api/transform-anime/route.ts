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

    // 动漫风格化输入：蒙版抠出的主体（有颜色细节，透明背景）
    // 要求：只对有颜色的主体区域动漫化，透明背景不是主体，不要生成
    const response = await client.generate({
      prompt: 'Convert this cutout subject to anime style. The input has a subject with color and details on TRANSPARENT background. CRITICAL: 1) Animate ONLY the colored subject area 2) Transparent pixels are NOT subject - do NOT convert them to any color or shape 3) Do NOT change subject outline/contour 4) Do NOT extend canvas 5) Keep transparent background 6) Output PNG with same transparency. Same pose, expression, accessories.',
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
