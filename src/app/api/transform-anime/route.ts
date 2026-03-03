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

    // Use image-to-image transformation with semi-realistic cartoon anime style
    // Style: Clean anime art with realistic proportions, soft colors, clear outlines
    const response = await client.generate({
      prompt: 'Transform this image into semi-realistic cartoon anime art style. STYLE SPECIFICATIONS: 1) REALISTIC PROPORTIONS - Keep normal human body proportions, NOT chibi or super-deformed, natural head-to-body ratio 2) SOFT PASTEL COLORS - Fresh, gentle color palette with clear color areas, minimal gradients, harmonious tones 3) EXPRESSIVE ANIME EYES - Moderately sized anime-style eyes with highlights and depth, realistic nose shape, natural mouth, maintain original facial expression 4) CLEAN ANIME OUTLINES - Smooth defined edges, clean line art style, neat color separation 5) KEY FEATURES PRESERVED - Same hairstyle, same clothing, same accessories, same iconic items, same pose and body orientation 6) FACE DETAILS - Keep identical expression, identical eye direction, identical mouth shape, realistic facial structure 7) MOUTH CONTENT PRESERVED - If mouth is holding something (lollipop, food, cigarette, straw, pen, etc.), it MUST be kept in EXACT same position and shape, do NOT remove or alter anything in or near the mouth 8) ACCESSORIES COMPLETE AND CLEAR - Glasses MUST have complete frames with clear outlines, both lenses visible, temples in correct position, no missing parts; hats, earrings, necklaces, headbands must all have crisp defined edges and be in EXACT same positions as original 9) WHITE AREAS STAY WHITE - White clothes/hair/accessories remain solid white pixels, NOT transparent 10) TRANSPARENT BACKGROUND - Only areas outside character silhouette should be transparent 11) CLEAN FLAT STYLE - Simple shading, soft shadows, flat color aesthetic, modern anime illustration style 12) NO extra elements - No watermark, text, signature, border, background fill, or canvas extension. Output only the character tightly cropped.',
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
