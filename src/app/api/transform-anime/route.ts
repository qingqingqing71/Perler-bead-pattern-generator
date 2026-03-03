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

    // 动漫主体风格化要求：
    // 1. 只处理AI抠图出的主体，不改变形状大小
    // 2. 不添加任何背景
    // 3. 不填充白色、黑色
    // 4. 不扩展画布，不变4:3
    // 5. 保持透明背景
    // 6. 只输出主体图片，不要多余内容
    const response = await client.generate({
      prompt: 'Anime style transfer on transparent subject. STRICT RULES: 1) Process ONLY the existing subject - do NOT change shape or size 2) NO background - keep transparent 3) NO white or black fill anywhere 4) NO canvas extension or 4:3 cropping - keep original dimensions 5) Maintain transparent background outside subject 6) Output ONLY the styled subject, nothing extra. Convert to cute chibi manga style with same pose, expression, accessories position. Input has irregular edges on transparent background - output must be identical in shape and size.',
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
