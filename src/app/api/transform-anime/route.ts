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

    // Use image-to-image transformation with pixel-art inspired cute chibi anime style
    // Style reference: Clean, soft-colored chibi anime with clear color blocks and simple features
    const response = await client.generate({
      prompt: 'Transform this image into cute chibi anime art style. STYLE SPECIFICATIONS: 1) CHIBI PROPORTIONS - Large head (about 2/3 of image), small body, adorable Q-version character design 2) SOFT PASTEL COLORS - Fresh, gentle low-saturation color palette, clear color boundaries without gradients, harmonious color blocks 3) BIG EXPRESSIVE EYES - Large sparkling anime eyes with highlights, simplified nose (tiny or no nose), soft gentle mouth, maintain original facial expression 4) CLEAN OUTLINES - Clear defined edges, smooth vector-like lines, neat color separation between different areas 5) KEY FEATURES PRESERVED - Same hairstyle, same clothing, same accessories, same iconic items, same pose and body orientation 6) FACE DETAILS - Keep identical expression, identical eye direction, identical mouth shape and opening 7) ACCESSORIES MATCH - Glasses, hats, earrings in EXACT same positions 8) WHITE AREAS STAY WHITE - White clothes/hair/accessories remain solid white pixels, NOT transparent 9) TRANSPARENT BACKGROUND - Only areas outside character silhouette should be transparent 10) SIMPLE CUTE STYLE - No complex shading, no heavy shadows, flat color with minimal depth, kawaii aesthetic 11) NO extra elements - No watermark, text, signature, border, background fill, or canvas extension. Output only the character tightly cropped.',
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
