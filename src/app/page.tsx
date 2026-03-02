'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Upload,
  Download,
  Scissors,
  Image as ImageIcon,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Grid3X3,
  Sparkles,
  RefreshCw,
  Grid2X2,
  Beaker,
  Wand2,
} from 'lucide-react';
import { findClosestMardColor, MardColor } from '@/lib/mardColors';

type ProcessingStep = 'idle' | 'uploading' | 'loading-model' | 'removing-bg' | 'transforming-anime' | 'generating-grid' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: '准备就绪',
  uploading: '正在上传图片...',
  'loading-model': '正在加载 AI 模型...',
  'removing-bg': '正在抠图...',
  'transforming-anime': '正在转换为动漫风格...',
  'generating-grid': '正在生成网格纸...',
  done: '处理完成',
};

// Grid size options
const GRID_OPTIONS = [
  { value: 15, label: '15 × 15' },
  { value: 25, label: '25 × 25' },
  { value: 32, label: '32 × 32' },
  { value: 40, label: '40 × 40' },
  { value: 52, label: '52 × 52' },
  { value: 100, label: '100 × 100' },
];

// Advanced background removal with improved accuracy
// Uses edge sampling, color clustering, and async processing to avoid UI blocking
const removeBackgroundSimple = async (
  imageData: ImageData,
  tolerance: number = 30,
  onProgress?: (progress: number) => void
): Promise<ImageData> => {
  const { width, height, data } = imageData;
  const result = new ImageData(width, height);
  const resultData = result.data;
  
  // Helper to yield to main thread
  const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));
  
  // Get pixel color at position
  const getPixel = (x: number, y: number): [number, number, number] => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  
  // Step 1: Sample background colors from edges (fast)
  onProgress?.(5);
  const bgColors: [number, number, number][] = [];
  const edgeStep = Math.max(1, Math.floor(Math.min(width, height) / 15));
  
  for (let x = 0; x < width; x += edgeStep) {
    for (const color of [getPixel(x, 0), getPixel(x, height - 1)]) {
      let isUnique = true;
      for (const existing of bgColors) {
        const dr = Math.abs(color[0] - existing[0]);
        const dg = Math.abs(color[1] - existing[1]);
        const db = Math.abs(color[2] - existing[2]);
        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
          isUnique = false;
          break;
        }
      }
      if (isUnique) bgColors.push(color);
    }
  }
  for (let y = 0; y < height; y += edgeStep) {
    for (const color of [getPixel(0, y), getPixel(width - 1, y)]) {
      let isUnique = true;
      for (const existing of bgColors) {
        const dr = Math.abs(color[0] - existing[0]);
        const dg = Math.abs(color[1] - existing[1]);
        const db = Math.abs(color[2] - existing[2]);
        if (dr <= tolerance && dg <= tolerance && db <= tolerance) {
          isUnique = false;
          break;
        }
      }
      if (isUnique) bgColors.push(color);
    }
  }
  
  // Step 2: Check if pixel is background
  const isBackground = (r: number, g: number, b: number): boolean => {
    for (const bg of bgColors) {
      const dr = Math.abs(r - bg[0]);
      const dg = Math.abs(g - bg[1]);
      const db = Math.abs(b - bg[2]);
      const dist = Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);
      if (dist <= tolerance * 1.5) return true;
    }
    return false;
  };
  
  // Step 3: Scanline flood fill (more efficient than stack-based)
  onProgress?.(10);
  const alphaMask = new Uint8Array(width * height).fill(255);
  const visited = new Uint8Array(width * height);
  
  // Scanline flood fill - much more efficient
  const scanlineFill = async (startX: number, startY: number) => {
    if (startX < 0 || startX >= width || startY < 0 || startY >= height) return;
    
    const stack: [number, number, number, number][] = []; // [y, xLeft, xRight, direction]
    
    // Find scanline range at start
    const idx0 = startY * width + startX;
    if (visited[idx0] || !isBackground(data[idx0 * 4], data[idx0 * 4 + 1], data[idx0 * 4 + 2])) return;
    
    // Find leftmost background pixel on this scanline
    let left = startX;
    while (left > 0) {
      const idx = startY * width + (left - 1);
      if (visited[idx]) break;
      if (!isBackground(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2])) break;
      left--;
    }
    
    // Find rightmost background pixel on this scanline
    let right = startX;
    while (right < width - 1) {
      const idx = startY * width + (right + 1);
      if (visited[idx]) break;
      if (!isBackground(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2])) break;
      right++;
    }
    
    stack.push([startY, left, right, 1]);  // direction 1 = down, -1 = up
    stack.push([startY, left, right, -1]);
    
    let iterations = 0;
    const maxIterationsPerYield = 50000;
    
    while (stack.length > 0) {
      iterations++;
      if (iterations % maxIterationsPerYield === 0) {
        onProgress?.(10 + Math.min(40, iterations / 100000));
        await yieldToMain();
      }
      
      const [y, xLeft, xRight, dir] = stack.pop()!;
      
      // Mark this scanline as background
      for (let x = xLeft; x <= xRight; x++) {
        const idx = y * width + x;
        if (!visited[idx]) {
          visited[idx] = 1;
          alphaMask[idx] = 0;
        }
      }
      
      // Check scanlines above and below
      for (const newY of [y + dir, y - dir]) {
        if (newY < 0 || newY >= height) continue;
        
        let newLeft = -1;
        for (let x = xLeft; x <= xRight; x++) {
          const idx = newY * width + x;
          if (!visited[idx] && isBackground(data[idx * 4], data[idx * 4 + 1], data[idx * 4 + 2])) {
            if (newLeft === -1) newLeft = x;
          } else if (newLeft !== -1) {
            // End of run, push to stack
            stack.push([newY, newLeft, x - 1, dir]);
            newLeft = -1;
          }
        }
        if (newLeft !== -1) {
          stack.push([newY, newLeft, xRight, dir]);
        }
      }
    }
  };
  
  // Start flood fill from edges
  const step = Math.max(1, Math.floor(Math.min(width, height) / 10));
  for (let x = 0; x < width; x += step) {
    await scanlineFill(x, 0);
    await scanlineFill(x, height - 1);
  }
  for (let y = 0; y < height; y += step) {
    await scanlineFill(0, y);
    await scanlineFill(width - 1, y);
  }
  
  // Step 4: Fill small holes (async)
  onProgress?.(60);
  await yieldToMain();
  
  const tempMask = new Uint8Array(alphaMask);
  const holeFillSize = 3;
  let row = 0;
  for (let y = holeFillSize; y < height - holeFillSize; y++) {
    row++;
    if (row % 100 === 0) {
      onProgress?.(60 + (row / height) * 15);
      await yieldToMain();
    }
    
    for (let x = holeFillSize; x < width - holeFillSize; x++) {
      const idx = y * width + x;
      if (alphaMask[idx] === 0) {
        let fgCount = 0;
        for (let ky = -holeFillSize; ky <= holeFillSize; ky++) {
          for (let kx = -holeFillSize; kx <= holeFillSize; kx++) {
            if (alphaMask[(y + ky) * width + (x + kx)] === 255) fgCount++;
          }
        }
        if (fgCount >= 20) tempMask[idx] = 255;
      }
    }
  }
  
  // Step 5: Apply mask (fast)
  onProgress?.(80);
  for (let i = 0; i < width * height; i++) {
    const srcI = i * 4;
    resultData[srcI] = data[srcI];
    resultData[srcI + 1] = data[srcI + 1];
    resultData[srcI + 2] = data[srcI + 2];
    resultData[srcI + 3] = tempMask[i];
  }
  
  // Step 6: Edge smoothing (async)
  await yieldToMain();
  const smoothedAlpha = new Uint8Array(width * height);
  row = 0;
  
  for (let y = 2; y < height - 2; y++) {
    row++;
    if (row % 100 === 0) {
      onProgress?.(80 + (row / height) * 15);
      await yieldToMain();
    }
    
    for (let x = 2; x < width - 2; x++) {
      // Simple 3x3 box blur for speed
      let sum = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          sum += tempMask[(y + ky) * width + (x + kx)];
        }
      }
      smoothedAlpha[y * width + x] = Math.round(sum / 9);
    }
  }
  
  // Apply smoothed alpha
  for (let i = 0; i < width * height; i++) {
    resultData[i * 4 + 3] = smoothedAlpha[i];
  }
  
  onProgress?.(100);
  return result;
};

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gridSize, setGridSize] = useState(25);
  const [useAnimeImage, setUseAnimeImage] = useState(false);
  const [isTransformingAnime, setIsTransformingAnime] = useState(false);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [pixelatedSubject, setPixelatedSubject] = useState<string | null>(null); // 单独的像素化主体（透明背景）
  const [isPixelating, setIsPixelating] = useState(false);
  const [beadPatternImage, setBeadPatternImage] = useState<string | null>(null);
  const [beadPatternLegend, setBeadPatternLegend] = useState<MardColor[]>([]);
  const [isGeneratingBeadPattern, setIsGeneratingBeadPattern] = useState(false);
  const [bgTolerance, setBgTolerance] = useState(30);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle click on upload area
  const handleUploadClick = useCallback(() => {
    if (step === 'idle' || step === 'done') {
      if (step === 'done') {
        setOriginalImage(null);
        setRemovedBgImage(null);
        setAnimeImage(null);
        setFinalImage(null);
        setUseAnimeImage(false);
        setProgress(0);
        setError(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }
  }, [step]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setProgress(0);
    setFinalImage(null);
    setRemovedBgImage(null);
    setAnimeImage(null);
    setUseAnimeImage(false);

    try {
      setStep('uploading');
      setProgress(10);
      const imageDataUrl = await readFileAsDataURL(file);
      setOriginalImage(imageDataUrl);

      setStep('removing-bg');
      setProgress(20);

      // Use async background removal with progress updates
      const result = await new Promise<string>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              reject(new Error('无法创建 Canvas'));
              return;
            }
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            // Pass progress callback for real-time updates
            const processedData = await removeBackgroundSimple(imageData, bgTolerance, (p) => {
              setProgress(20 + Math.round(p * 0.6)); // 20-80%
            });
            
            ctx.putImageData(processedData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('无法加载图片'));
        img.src = imageDataUrl;
      });

      setRemovedBgImage(result);
      setProgress(85);

      setStep('generating-grid');
      setProgress(90);

      const composedImage = await composeWithGrid(result, gridSize);
      setFinalImage(composedImage);

      setStep('done');
      setProgress(100);
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : '处理图片时发生错误');
      setStep('idle');
      setProgress(0);
    }
  }, [gridSize, bgTolerance]);

  // Transform to anime style
  const handleTransformAnime = useCallback(async () => {
    if (!removedBgImage || isTransformingAnime) return;

    setIsTransformingAnime(true);
    setError(null);

    try {
      // Extract base64 data from data URL
      const base64Data = removedBgImage.split(',')[1] || removedBgImage;

      const response = await fetch('/api/transform-anime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: `data:image/png;base64,${base64Data}` }),
      });

      const data = await response.json();

      if (data.success && data.imageUrl) {
        // Remove black/white background (set black/white pixels to transparent)
        // This ensures only the subject remains with transparent background
        const cleanedImage = await removeBackgroundColors(data.imageUrl);
        
        setAnimeImage(cleanedImage);
        setUseAnimeImage(true);
        
        // Regenerate grid with anime image
        const composedImage = await composeWithGrid(cleanedImage, gridSize);
        setFinalImage(composedImage);
      } else {
        setError(data.error || '动漫风格转换失败');
      }
    } catch (err) {
      console.error('Anime transform error:', err);
      setError(err instanceof Error ? err.message : '动漫风格转换失败');
    } finally {
      setIsTransformingAnime(false);
    }
  }, [removedBgImage, isTransformingAnime, gridSize]);

  // Regenerate with new grid size
  const handleGridSizeChange = useCallback(async (newGridSize: number) => {
    setGridSize(newGridSize);
    
    const sourceImage = useAnimeImage && animeImage ? animeImage : removedBgImage;
    
    if (sourceImage && (step === 'done' || step === 'generating-grid')) {
      setStep('generating-grid');
      setProgress(90);
      
      try {
        const composedImage = await composeWithGrid(sourceImage, newGridSize);
        setFinalImage(composedImage);
        setStep('done');
        setProgress(100);
      } catch (err) {
        console.error('Failed to regenerate:', err);
      }
    }
  }, [removedBgImage, animeImage, useAnimeImage, step]);

  // Toggle between original and anime image
  const handleToggleImageSource = useCallback(async () => {
    if (!removedBgImage) return;
    
    const newUseAnime = !useAnimeImage;
    setUseAnimeImage(newUseAnime);
    
    const sourceImage = newUseAnime && animeImage ? animeImage : removedBgImage;
    
    if (sourceImage) {
      setStep('generating-grid');
      setProgress(90);
      
      try {
        const composedImage = await composeWithGrid(sourceImage, gridSize);
        setFinalImage(composedImage);
        setStep('done');
        setProgress(100);
      } catch (err) {
        console.error('Failed to regenerate:', err);
      }
    }
  }, [removedBgImage, animeImage, useAnimeImage, gridSize]);

  // Pixelate image - pixelate the anime or original cutout image
  const handlePixelate = useCallback(async () => {
    const sourceImage = useAnimeImage && animeImage ? animeImage : removedBgImage;
    if (!sourceImage || isPixelating) return;

    setIsPixelating(true);
    setError(null);

    try {
      const result = await pixelateImage(sourceImage, gridSize);
      setPixelatedImage(result.fullImage);        // 完整图片（带网格线）
      setPixelatedSubject(result.subjectImage);   // 单独的主体（透明背景）
    } catch (err) {
      console.error('Pixelate error:', err);
      setError(err instanceof Error ? err.message : '像素化处理失败');
    } finally {
      setIsPixelating(false);
    }
  }, [removedBgImage, animeImage, useAnimeImage, gridSize, isPixelating]);

  // Generate bead pattern from pixelated subject
  const handleGenerateBeadPattern = useCallback(async () => {
    // Use pixelated subject (transparent background) directly
    if (!pixelatedSubject || isGeneratingBeadPattern) return;

    setIsGeneratingBeadPattern(true);
    setError(null);

    try {
      const result = await generateBeadPatternHD(pixelatedSubject, gridSize, 1);
      setBeadPatternImage(result.image);
      setBeadPatternLegend(result.legend);
    } catch (err) {
      console.error('Bead pattern error:', err);
      setError(err instanceof Error ? err.message : '拼豆图纸生成失败');
    } finally {
      setIsGeneratingBeadPattern(false);
    }
  }, [pixelatedSubject, gridSize, isGeneratingBeadPattern]);

  const handleDownload = useCallback(() => {
    if (!finalImage) return;

    const link = document.createElement('a');
    link.href = finalImage;
    link.download = `subject-on-grid-${gridSize}x${gridSize}${useAnimeImage ? '-anime' : ''}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [finalImage, gridSize, useAnimeImage]);

  const handleDownloadPixelated = useCallback(() => {
    if (!pixelatedImage) return;

    const link = document.createElement('a');
    link.href = pixelatedImage;
    link.download = `pixelated-${gridSize}x${gridSize}${animeImage ? '-anime' : ''}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pixelatedImage, gridSize, animeImage]);

  const handleDownloadBeadPattern = useCallback(async () => {
    // Use pixelated subject (transparent background) directly
    if (!pixelatedSubject) return;

    try {
      // Generate high-resolution bead pattern (3x scale for better readability)
      const result = await generateBeadPatternHD(pixelatedSubject, gridSize, 3);
      
      const link = document.createElement('a');
      link.href = result.image;
      link.download = `bead-pattern-hd-${gridSize}x${gridSize}${useAnimeImage ? '-anime' : ''}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('HD download error:', err);
      // Fallback to regular image
      if (beadPatternImage) {
        const link = document.createElement('a');
        link.href = beadPatternImage;
        link.download = `bead-pattern-${gridSize}x${gridSize}${useAnimeImage ? '-anime' : ''}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [pixelatedSubject, gridSize, animeImage, beadPatternImage, useAnimeImage]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setRemovedBgImage(null);
    setAnimeImage(null);
    setFinalImage(null);
    setPixelatedImage(null);
    setPixelatedSubject(null);
    setBeadPatternImage(null);
    setBeadPatternLegend([]);
    setUseAnimeImage(false);
    setStep('idle');
    setProgress(0);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const canUpload = step === 'idle' || step === 'done';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <Scissors className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              AI 抠图工具
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            上传照片，自动抠出主体，转换为动漫风格，然后贴到空白网格纸上
          </p>
          <div className="mt-4 inline-flex items-center gap-2 text-green-600 dark:text-green-400">
            <CheckCircle2 className="w-4 h-4" />
            <span className="text-sm">准备就绪，点击上传照片开始</span>
          </div>
        </div>

        {/* Grid Size Selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-slate-700 dark:text-slate-300">网格纸规格：</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {GRID_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={gridSize === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleGridSizeChange(option.value)}
                    className={`min-w-[80px] ${
                      gridSize === option.value 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : ''
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Background Removal Tolerance */}
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Wand2 className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-slate-700 dark:text-slate-300">抠图精度：</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-500">精细</span>
                  <input
                    type="range"
                    min="10"
                    max="60"
                    value={bgTolerance}
                    onChange={(e) => setBgTolerance(parseInt(e.target.value))}
                    className="w-32 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                  />
                  <span className="text-xs text-slate-500">宽松</span>
                  <span className="text-sm text-blue-600 font-medium w-8">{bgTolerance}</span>
                </div>
              </div>
              <p className="text-xs text-slate-500 text-center mt-2">
                背景色差异较大时调高数值，主体边缘被误删时调低数值
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Upload Area */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                上传图片
              </h2>

              {/* Upload Zone */}
              <div
                onClick={handleUploadClick}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all
                  ${canUpload 
                    ? 'cursor-pointer border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20' 
                    : 'cursor-not-allowed border-slate-200 dark:border-slate-800 opacity-60'
                  }
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />

                {originalImage ? (
                  <div className="space-y-4">
                    <img
                      src={originalImage}
                      alt="原图"
                      className="max-h-64 mx-auto rounded-lg shadow-md"
                    />
                    {step === 'done' && (
                      <p className="text-sm text-blue-500">点击重新上传</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      点击上传图片
                    </p>
                    <p className="text-sm text-slate-400">
                      支持 JPG、PNG、WebP 格式
                    </p>
                  </div>
                )}
              </div>

              {/* Progress */}
              {step !== 'idle' && step !== 'done' && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      {STEP_LABELS[step]}
                    </span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}

              {/* Done Status */}
              {step === 'done' && (
                <div className="mt-6 flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm">处理完成 - {gridSize}×{gridSize} 网格纸 {useAnimeImage ? '(动漫风格)' : ''}</span>
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-950/20 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-700 dark:text-red-400 font-medium">处理失败</p>
                    <p className="text-sm text-red-600 dark:text-red-300">{error}</p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {step === 'done' && (
                <div className="mt-6 space-y-3">
                  {/* Anime Transform Button */}
                  <Button
                    onClick={handleTransformAnime}
                    disabled={isTransformingAnime || !removedBgImage}
                    variant="outline"
                    className="w-full border-purple-300 text-purple-600 hover:bg-purple-50 dark:border-purple-700 dark:text-purple-400 dark:hover:bg-purple-950/20"
                  >
                    {isTransformingAnime ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在转换为动漫风格...
                      </>
                    ) : animeImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成动漫风格
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        转换为动漫风格
                      </>
                    )}
                  </Button>

                  {/* Pixelate Button */}
                  <Button
                    onClick={handlePixelate}
                    disabled={isPixelating || (!removedBgImage && !animeImage)}
                    variant="outline"
                    className="w-full border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/20"
                  >
                    {isPixelating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在像素化处理...
                      </>
                    ) : pixelatedImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成像素化
                      </>
                    ) : (
                      <>
                        <Grid2X2 className="w-4 h-4 mr-2" />
                        像素化处理
                      </>
                    )}
                  </Button>

                  {/* Bead Pattern Button */}
                  <Button
                    onClick={handleGenerateBeadPattern}
                    disabled={isGeneratingBeadPattern || !pixelatedImage}
                    variant="outline"
                    className="w-full border-orange-300 text-orange-600 hover:bg-orange-50 dark:border-orange-700 dark:text-orange-400 dark:hover:bg-orange-950/20"
                  >
                    {isGeneratingBeadPattern ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在生成拼豆图纸...
                      </>
                    ) : beadPatternImage ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成拼豆图纸
                      </>
                    ) : (
                      <>
                        <Beaker className="w-4 h-4 mr-2" />
                        生成拼豆图纸
                      </>
                    )}
                  </Button>

                  {/* Download and Reset */}
                  <div className="flex gap-3">
                    <Button
                      onClick={handleDownload}
                      className="flex-1 bg-blue-600 hover:bg-blue-700"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      下载网格
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleReset}
                    >
                      重新开始
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Preview */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                处理结果
                {finalImage && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({gridSize}×{gridSize} 网格{useAnimeImage ? ', 动漫风格' : ''})
                  </span>
                )}
              </h2>

              <div className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center">
                {finalImage ? (
                  <img
                    src={finalImage}
                    alt="处理结果"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <div className="text-center p-8">
                    <div className="w-20 h-20 mx-auto bg-slate-200 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
                      <ImageIcon className="w-10 h-10 text-slate-400 dark:text-slate-500" />
                    </div>
                    <p className="text-slate-500 dark:text-slate-400">
                      上传图片后，处理结果将显示在这里
                    </p>
                  </div>
                )}
              </div>

              {/* Image Source Toggle */}
              {animeImage && (
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-purple-700 dark:text-purple-300">
                      当前使用：<strong>{useAnimeImage ? '动漫风格' : '原图'}</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleToggleImageSource}
                      className="border-purple-300 text-purple-600 hover:bg-purple-100 dark:border-purple-700 dark:text-purple-400"
                    >
                      切换为{useAnimeImage ? '原图' : '动漫风格'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Original Cutout Preview */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                抠图预览（透明背景）
              </h3>
              <div 
                className="h-40 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                style={removedBgImage ? {
                  backgroundImage: `
                    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#fff',
                } : {}}
              >
                {removedBgImage ? (
                  <img
                    src={removedBgImage}
                    alt="抠图结果"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-slate-400 text-sm">等待抠图...</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Anime Preview */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                动漫抠图预览
              </h3>
              <div 
                className="h-40 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                style={animeImage ? {
                  backgroundImage: `
                    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#fff',
                } : {}}
              >
                {animeImage ? (
                  <img
                    src={animeImage}
                    alt="动漫风格抠图结果"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-slate-400 text-sm">
                    {removedBgImage ? '点击"转换为动漫风格"按钮' : '等待抠图...'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pixelated Result Section */}
        {pixelatedImage && (
          <Card className="mt-6 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Grid2X2 className="w-5 h-5 text-green-600" />
                  像素化结果
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({gridSize}×{gridSize} 像素{animeImage ? ', 动漫风格' : ''})
                  </span>
                </h2>
                <Button
                  onClick={handleDownloadPixelated}
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载像素化
                </Button>
              </div>

              <div 
                className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center"
              >
                <img
                  src={pixelatedImage}
                  alt="像素化结果"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Bead Pattern Result Section */}
        {beadPatternImage && (
          <Card className="mt-6 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Beaker className="w-5 h-5 text-orange-600" />
                  拼豆图纸
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({gridSize}×{gridSize} 格{animeImage ? ', 动漫风格' : ''})
                  </span>
                </h2>
                <Button
                  onClick={handleDownloadBeadPattern}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载高清图纸
                </Button>
              </div>

              <div 
                className="aspect-square bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden flex items-center justify-center"
              >
                <img
                  src={beadPatternImage}
                  alt="拼豆图纸"
                  className="max-w-full max-h-full object-contain"
                />
              </div>

              {/* Color Legend */}
              {beadPatternLegend.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-md font-semibold mb-3">颜色图例</h3>
                  <div className="flex flex-wrap gap-3">
                    {beadPatternLegend.map((color, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div 
                          className="w-6 h-6 rounded border border-slate-300"
                          style={{ backgroundColor: color.hex }}
                        />
                        <span className="text-sm font-medium">{color.code}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Instructions */}
        <div className="mt-8 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">使用说明</h3>
          <div className="grid sm:grid-cols-5 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium">选择网格</p>
                <p className="text-sm text-slate-500">选择网格规格</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium">上传图片</p>
                <p className="text-sm text-slate-500">选择人物照片</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">3</span>
              </div>
              <div>
                <p className="font-medium">AI 抠图</p>
                <p className="text-sm text-slate-500">自动移除背景</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">4</span>
              </div>
              <div>
                <p className="font-medium">动漫转换</p>
                <p className="text-sm text-slate-500">可选动漫风格</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">5</span>
              </div>
              <div>
                <p className="font-medium">下载结果</p>
                <p className="text-sm text-slate-500">获取网格图片</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>提示：</strong>图像将居中显示在网格纸上，大小为网格纸的 90%。动漫风格转换需要调用 AI 服务，可能需要几秒钟时间。
          </p>
        </div>
      </div>
    </div>
  );
}

// Type for body segmentation
interface BodySegmenter {
  segmentPeople: (image: HTMLImageElement, config: { flipHorizontal: boolean; multiSegment: boolean }) => Promise<Array<{ mask: { toImageData: () => Promise<ImageData> } }>>;
  dispose: () => void;
}

// Helper functions
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function applyBackgroundRemoval(
  imageSrc: string, 
  mask: ImageData,
  originalWidth: number,
  originalHeight: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      canvas.width = originalWidth;
      canvas.height = originalHeight;

      ctx.drawImage(img, 0, 0, originalWidth, originalHeight);
      
      const imageData = ctx.getImageData(0, 0, originalWidth, originalHeight);
      const data = imageData.data;
      
      const maskCanvas = document.createElement('canvas');
      const maskCtx = maskCanvas.getContext('2d');
      if (!maskCtx) {
        reject(new Error('无法创建遮罩画布'));
        return;
      }
      
      maskCanvas.width = originalWidth;
      maskCanvas.height = originalHeight;
      
      const tempMaskCanvas = document.createElement('canvas');
      tempMaskCanvas.width = mask.width;
      tempMaskCanvas.height = mask.height;
      const tempMaskCtx = tempMaskCanvas.getContext('2d');
      if (!tempMaskCtx) {
        reject(new Error('无法创建临时遮罩画布'));
        return;
      }
      tempMaskCtx.putImageData(mask, 0, 0);
      
      maskCtx.imageSmoothingEnabled = true;
      maskCtx.imageSmoothingQuality = 'high';
      maskCtx.drawImage(tempMaskCanvas, 0, 0, mask.width, mask.height, 0, 0, originalWidth, originalHeight);
      const scaledMaskData = maskCtx.getImageData(0, 0, originalWidth, originalHeight);
      const maskData = scaledMaskData.data;

      for (let i = 0; i < data.length; i += 4) {
        const maskValue = maskData[i];
        let alpha = Math.min(255, Math.max(0, maskValue));
        data[i + 3] = alpha;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageSrc;
  });
}

async function composeWithGrid(imageUrl: string, gridCount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      const gridSize = 800;
      const cellSize = gridSize / gridCount;

      const width = gridSize;
      const height = gridSize;

      canvas.width = width;
      canvas.height = height;

      // Step 1: Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Step 2: Calculate image size (area = grid size² * 0.9, keep aspect ratio)
      const targetArea = gridSize * gridSize * 0.9;
      const originalArea = img.width * img.height;
      const scaleFactor = Math.sqrt(targetArea / originalArea);
      let imgWidth = img.width * scaleFactor;
      let imgHeight = img.height * scaleFactor;

      // Center the image
      const x = (width - imgWidth) / 2;
      const y = (height - imgHeight) / 2;
      
      // Draw the image
      ctx.drawImage(img, x, y, imgWidth, imgHeight);

      // Step 3: Draw grid lines ON TOP
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;

      for (let i = 0; i <= gridCount; i++) {
        const pos = i * cellSize;
        
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, height);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(width, pos);
        ctx.stroke();
      }

      // Draw thicker lines every 5 cells
      if (gridCount >= 10) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        
        const majorInterval = 5;
        for (let i = 0; i <= gridCount; i += majorInterval) {
          const pos = i * cellSize;
          
          ctx.beginPath();
          ctx.moveTo(pos, 0);
          ctx.lineTo(pos, height);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, pos);
          ctx.lineTo(width, pos);
          ctx.stroke();
        }
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

interface PixelateResult {
  fullImage: string;      // 完整图片（带白色背景和网格线）
  subjectImage: string;   // 单独的像素化主体（白色背景填充透明区域）
  subjectInfo: {
    cellCountX: number;   // 主体宽度（网格数）
    cellCountY: number;   // 主体高度（网格数）
    offsetX: number;      // 在800×800画布上的X偏移（像素）
    offsetY: number;      // 在800×800画布上的Y偏移（像素）
    cellSize: number;     // 每个网格单元的像素大小
  };
}

async function pixelateImage(imageUrl: string, gridCount: number): Promise<PixelateResult> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Step 1: Load source image
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d');
      
      if (!srcCtx) {
        reject(new Error('无法创建画布'));
        return;
      }

      const imgWidth = img.width;
      const imgHeight = img.height;
      
      srcCanvas.width = imgWidth;
      srcCanvas.height = imgHeight;
      srcCtx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      const srcImageData = srcCtx.getImageData(0, 0, imgWidth, imgHeight);
      const srcData = srcImageData.data;

      // Step 2: Calculate subject size and position on grid
      const gridSize = 800;
      const cellSize = gridSize / gridCount;
      
      // Area = grid size² * 0.9, keep aspect ratio
      const targetArea = gridSize * gridSize * 0.9;
      const originalArea = imgWidth * imgHeight;
      const scaleFactor = Math.sqrt(targetArea / originalArea);
      
      // Align size to grid cells
      const alignedWidth = Math.round(imgWidth * scaleFactor / cellSize) * cellSize;
      const alignedHeight = Math.round(imgHeight * scaleFactor / cellSize) * cellSize;
      
      // Align position to grid lines (centered)
      const offsetX = Math.round((gridSize - alignedWidth) / 2 / cellSize) * cellSize;
      const offsetY = Math.round((gridSize - alignedHeight) / 2 / cellSize) * cellSize;

      // Calculate grid cell counts for subject
      const cellCountX = Math.round(alignedWidth / cellSize);
      const cellCountY = Math.round(alignedHeight / cellSize);

      // Step 3: First pass - collect cell data and find subject bounds
      const cellData: Array<{
        gridX: number;
        gridY: number;
        avgR: number;
        avgG: number;
        avgB: number;
        avgA: number;
        hasContent: boolean;
      }> = [];
      
      let minContentX = cellCountX, maxContentX = -1;
      let minContentY = cellCountY, maxContentY = -1;

      for (let gridY = 0; gridY < cellCountY; gridY++) {
        for (let gridX = 0; gridX < cellCountX; gridX++) {
          const srcX1 = Math.floor(gridX / cellCountX * imgWidth);
          const srcY1 = Math.floor(gridY / cellCountY * imgHeight);
          const srcX2 = Math.floor((gridX + 1) / cellCountX * imgWidth);
          const srcY2 = Math.floor((gridY + 1) / cellCountY * imgHeight);
          
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;
          
          for (let sy = srcY1; sy < srcY2; sy++) {
            for (let sx = srcX1; sx < srcX2; sx++) {
              const idx = (sy * imgWidth + sx) * 4;
              totalR += srcData[idx];
              totalG += srcData[idx + 1];
              totalB += srcData[idx + 2];
              totalA += srcData[idx + 3];
              pixelCount++;
            }
          }
          
          const avgR = pixelCount > 0 ? Math.round(totalR / pixelCount) : 255;
          const avgG = pixelCount > 0 ? Math.round(totalG / pixelCount) : 255;
          const avgB = pixelCount > 0 ? Math.round(totalB / pixelCount) : 255;
          const avgA = pixelCount > 0 ? Math.round(totalA / pixelCount) : 0;
          const hasContent = avgA > 10;
          
          cellData.push({ gridX, gridY, avgR, avgG, avgB, avgA, hasContent });
          
          // Update bounds
          if (hasContent) {
            minContentX = Math.min(minContentX, gridX);
            maxContentX = Math.max(maxContentX, gridX);
            minContentY = Math.min(minContentY, gridY);
            maxContentY = Math.max(maxContentY, gridY);
          }
        }
      }

      // Step 4: Create subject canvas - fill ALL cells within subject bounds
      const subjectCanvas = document.createElement('canvas');
      const subjectCtx = subjectCanvas.getContext('2d');
      
      if (!subjectCtx) {
        reject(new Error('无法创建主体画布'));
        return;
      }

      subjectCanvas.width = alignedWidth;
      subjectCanvas.height = alignedHeight;

      // Fill subject area with white background first
      subjectCtx.fillStyle = '#ffffff';
      subjectCtx.fillRect(0, 0, alignedWidth, alignedHeight);

      // Draw each cell - fill with color or white if transparent
      for (const cell of cellData) {
        const x = cell.gridX * cellSize;
        const y = cell.gridY * cellSize;
        
        // Check if cell is within subject bounds
        const inBoundsX = cell.gridX >= minContentX && cell.gridX <= maxContentX;
        const inBoundsY = cell.gridY >= minContentY && cell.gridY <= maxContentY;
        
        if (cell.hasContent) {
          // Has color - use actual color
          subjectCtx.fillStyle = `rgba(${cell.avgR}, ${cell.avgG}, ${cell.avgB}, ${cell.avgA / 255})`;
          subjectCtx.fillRect(x, y, cellSize, cellSize);
        } else if (inBoundsX && inBoundsY) {
          // Within subject bounds but transparent - fill with white
          subjectCtx.fillStyle = '#ffffff';
          subjectCtx.fillRect(x, y, cellSize, cellSize);
        }
        // Outside bounds - leave as white (already filled)
      }

      // Step 5: Create final canvas with white background
      const resultCanvas = document.createElement('canvas');
      const resultCtx = resultCanvas.getContext('2d');
      
      if (!resultCtx) {
        reject(new Error('无法创建结果画布'));
        return;
      }

      resultCanvas.width = gridSize;
      resultCanvas.height = gridSize;

      // Fill with white background
      resultCtx.fillStyle = '#ffffff';
      resultCtx.fillRect(0, 0, gridSize, gridSize);

      // Step 6: Place pixelated subject on the grid (centered)
      resultCtx.drawImage(subjectCanvas, offsetX, offsetY);

      // Step 7: Draw grid lines on top
      resultCtx.strokeStyle = '#d1d5db';
      resultCtx.lineWidth = 1;

      for (let i = 0; i <= gridCount; i++) {
        const pos = i * cellSize;
        
        resultCtx.beginPath();
        resultCtx.moveTo(pos, 0);
        resultCtx.lineTo(pos, gridSize);
        resultCtx.stroke();
        
        resultCtx.beginPath();
        resultCtx.moveTo(0, pos);
        resultCtx.lineTo(gridSize, pos);
        resultCtx.stroke();
      }

      // Draw thicker lines every 5 cells
      if (gridCount >= 10) {
        resultCtx.strokeStyle = '#9ca3af';
        resultCtx.lineWidth = 2;
        
        for (let i = 0; i <= gridCount; i += 5) {
          const pos = i * cellSize;
          
          resultCtx.beginPath();
          resultCtx.moveTo(pos, 0);
          resultCtx.lineTo(pos, gridSize);
          resultCtx.stroke();
          
          resultCtx.beginPath();
          resultCtx.moveTo(0, pos);
          resultCtx.lineTo(gridSize, pos);
          resultCtx.stroke();
        }
      }

      // Return both full image and subject image
      resolve({
        fullImage: resultCanvas.toDataURL('image/png'),
        subjectImage: subjectCanvas.toDataURL('image/png'),
        subjectInfo: {
          cellCountX,
          cellCountY,
          offsetX,
          offsetY,
          cellSize
        }
      });
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

async function removeBackgroundColors(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Remove black/near-black and white/near-white pixels (make them transparent)
      // This ensures we only keep the subject, with transparent background
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if pixel is black or near-black (threshold: 30)
        const isBlack = r < 30 && g < 30 && b < 30;
        
        // Check if pixel is white or near-white (threshold: 225)
        const isWhite = r > 225 && g > 225 && b > 225;
        
        if (isBlack || isWhite) {
          data[i + 3] = 0; // Set alpha to 0 (transparent)
        }
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

// Generate bead pattern with MARD color codes (based on pixelated image)
async function generateBeadPattern(
  imageUrl: string,
  gridSize: number
): Promise<{ image: string; legend: MardColor[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      // Set canvas size to image size (should be 800x800 from pixelateImage)
      canvas.width = img.width;
      canvas.height = img.height;
      
      // Fill with white background first
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Get source image data for processing
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) {
        reject(new Error('无法创建源画布'));
        return;
      }
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      srcCtx.drawImage(img, 0, 0);
      
      const srcImageData = srcCtx.getImageData(0, 0, srcCanvas.width, srcCanvas.height);
      const srcData = srcImageData.data;

      // Calculate pixel size - the pixelated image is 800x800, divided by grid count
      const canvasSize = 800; // Fixed size from pixelateImage
      const pixelSize = canvasSize / gridSize;
      
      // Color tracking for legend
      const colorMap = new Map<string, MardColor>();

      // Calculate font size based on pixel size - text should fit within the grid cell
      // Use smaller font for smaller grids to ensure text doesn't overflow
      const fontSize = Math.max(5, Math.floor(pixelSize * 0.35));
      
      // Store blocks info for drawing text later
      const blocksInfo: Array<{
        x: number;
        y: number;
        width: number;
        height: number;
        color: MardColor;
        avgR: number;
        avgG: number;
        avgB: number;
      }> = [];

      // Process each pixel block - fill subject area with colors, leave background white
      for (let gridY = 0; gridY < gridSize; gridY++) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
          // Calculate pixel block boundaries
          const x1 = Math.floor(gridX * pixelSize);
          const y1 = Math.floor(gridY * pixelSize);
          const x2 = Math.min(Math.floor((gridX + 1) * pixelSize), canvas.width);
          const y2 = Math.min(Math.floor((gridY + 1) * pixelSize), canvas.height);

          // Calculate average color for this block from source
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;

          for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
              const idx = (y * srcCanvas.width + x) * 4;
              totalR += srcData[idx];
              totalG += srcData[idx + 1];
              totalB += srcData[idx + 2];
              totalA += srcData[idx + 3];
              pixelCount++;
            }
          }

          // Only process subject area (non-transparent pixels)
          // Background (transparent) stays white with no color code
          if (pixelCount > 0 && totalA / pixelCount > 25) {
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);

            // Find nearest MARD color for the legend
            const nearestColor = findClosestMardColor(avgR, avgG, avgB);
            
            // Track color for legend
            if (!colorMap.has(nearestColor.code)) {
              colorMap.set(nearestColor.code, nearestColor);
            }

            // Fill the block with original average color (keep pixelated look)
            ctx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
            ctx.fillRect(x1, y1, x2 - x1, y2 - y1);

            // Store block info for text drawing
            blocksInfo.push({
              x: x1,
              y: y1,
              width: x2 - x1,
              height: y2 - y1,
              color: nearestColor,
              avgR,
              avgG,
              avgB
            });
          }
          // Else: transparent/background area stays white, no color code
        }
      }

      // Draw MARD color codes only on subject blocks
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (const block of blocksInfo) {
        // Determine text color based on background brightness
        const brightness = (block.avgR * 299 + block.avgG * 587 + block.avgB * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
        
        ctx.font = `bold ${fontSize}px Arial`;
        const centerX = block.x + block.width / 2;
        const centerY = block.y + block.height / 2;
        ctx.fillText(block.color.code, centerX, centerY);
      }

      // Draw grid lines on top
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;

      for (let i = 0; i <= gridSize; i++) {
        const pos = Math.floor(i * pixelSize);
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, canvas.height);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(canvas.width, pos);
        ctx.stroke();
      }

      // Convert color map to legend array
      const legend = Array.from(colorMap.values()).sort((a, b) => a.code.localeCompare(b.code));

      resolve({
        image: canvas.toDataURL('image/png'),
        legend
      });
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

// Generate high-definition bead pattern for download
// Input: pixelated subject image (white background with subject filled)
// Process: read all colors → match MARD colors → place on blank grid with numbers
async function generateBeadPatternHD(
  subjectImageUrl: string,
  gridSize: number,
  scale: number = 3
): Promise<{ image: string; legend: MardColor[] }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Step 1: Get source image data
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) {
        reject(new Error('无法创建源画布'));
        return;
      }
      
      srcCanvas.width = img.width;
      srcCanvas.height = img.height;
      srcCtx.drawImage(img, 0, 0);
      
      const srcImageData = srcCtx.getImageData(0, 0, img.width, img.height);
      const srcData = srcImageData.data;
      
      // Calculate cell size in source image
      const srcCellSize = 800 / gridSize;
      const srcCellCountX = Math.round(img.width / srcCellSize);
      const srcCellCountY = Math.round(img.height / srcCellSize);
      
      // Step 2: Read colors from ALL cells (subject is now on white background)
      const blocksInfo: Array<{
        gridX: number;
        gridY: number;
        avgR: number;
        avgG: number;
        avgB: number;
        nearestColor: MardColor;
      }> = [];
      
      const colorUsageCount = new Map<string, number>();
      
      for (let cellY = 0; cellY < srcCellCountY; cellY++) {
        for (let cellX = 0; cellX < srcCellCountX; cellX++) {
          // Calculate average color for this cell
          let totalR = 0, totalG = 0, totalB = 0;
          let pixelCount = 0;
          
          const startX = Math.floor(cellX * srcCellSize);
          const startY = Math.floor(cellY * srcCellSize);
          const endX = Math.floor((cellX + 1) * srcCellSize);
          const endY = Math.floor((cellY + 1) * srcCellSize);
          
          for (let y = startY; y < endY && y < img.height; y++) {
            for (let x = startX; x < endX && x < img.width; x++) {
              const idx = (y * img.width + x) * 4;
              totalR += srcData[idx];
              totalG += srcData[idx + 1];
              totalB += srcData[idx + 2];
              pixelCount++;
            }
          }
          
          if (pixelCount > 0) {
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);
            
            // Find nearest MARD color for ALL cells (including white)
            const nearestColor = findClosestMardColor(avgR, avgG, avgB);
            
            blocksInfo.push({
              gridX: cellX,
              gridY: cellY,
              avgR, avgG, avgB,
              nearestColor
            });
            
            // Count color usage
            const count = colorUsageCount.get(nearestColor.code) || 0;
            colorUsageCount.set(nearestColor.code, count + 1);
          }
        }
      }
      
      // Step 3: Limit colors to max 20 (keep most frequently used)
      const MAX_COLORS = 20;
      let selectedColors: MardColor[];
      
      if (colorUsageCount.size <= MAX_COLORS) {
        selectedColors = Array.from(colorUsageCount.keys()).map(code => {
          const block = blocksInfo.find(b => b.nearestColor.code === code)!;
          return block.nearestColor;
        });
      } else {
        const sortedColors = Array.from(colorUsageCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_COLORS)
          .map(([code]) => {
            const block = blocksInfo.find(b => b.nearestColor.code === code)!;
            return block.nearestColor;
          });
        selectedColors = sortedColors;
      }
      
      const selectedColorCodes = new Set(selectedColors.map(c => c.code));
      
      // Step 4: Create HD canvas with margin for edge numbers
      const gridAreaSize = 800 * scale;
      const marginSize = 50 * scale;
      const totalSize = gridAreaSize + marginSize * 2;
      const cellSize = gridAreaSize / gridSize;
      
      const canvas = document.createElement('canvas');
      canvas.width = totalSize;
      canvas.height = totalSize;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalSize, totalSize);
      
      // Step 5: Calculate subject position on target canvas
      // Subject area = 0.9 of grid, centered
      const subjectCellCountX = srcCellCountX;
      const subjectCellCountY = srcCellCountY;
      const offsetX = marginSize + Math.floor((gridSize - subjectCellCountX) / 2) * cellSize;
      const offsetY = marginSize + Math.floor((gridSize - subjectCellCountY) / 2) * cellSize;
      
      // Helper function to parse hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      // Color tracking for legend
      const colorMap = new Map<string, MardColor>();
      
      // Step 6: Draw subject blocks with MARD colors
      const fontSize = Math.max(12, Math.floor(cellSize * 0.4));
      const drawnBlocks: Array<{
        x: number;
        y: number;
        color: MardColor;
        rgbR: number;
        rgbG: number;
        rgbB: number;
      }> = [];
      
      for (const block of blocksInfo) {
        let finalColor = block.nearestColor;
        
        // If color not in selected colors, find closest from selected
        if (!selectedColorCodes.has(block.nearestColor.code)) {
          let minDist = Infinity;
          for (const color of selectedColors) {
            const rgb = hexToRgb(color.hex);
            const dist = Math.sqrt(
              Math.pow(block.avgR - rgb.r, 2) +
              Math.pow(block.avgG - rgb.g, 2) +
              Math.pow(block.avgB - rgb.b, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              finalColor = color;
            }
          }
        }
        
        // Get RGB values for the final color
        const finalRgb = hexToRgb(finalColor.hex);
        
        // Calculate position on target canvas
        const x = offsetX + block.gridX * cellSize;
        const y = offsetY + block.gridY * cellSize;
        
        // Fill the block with the final color
        ctx.fillStyle = finalColor.hex;
        ctx.fillRect(x, y, cellSize, cellSize);
        
        // Track for text drawing
        drawnBlocks.push({
          x, y,
          color: finalColor,
          rgbR: finalRgb.r,
          rgbG: finalRgb.g,
          rgbB: finalRgb.b
        });
        
        // Track color for legend
        if (!colorMap.has(finalColor.code)) {
          colorMap.set(finalColor.code, finalColor);
        }
      }
      
      // Step 7: Draw MARD color codes on blocks
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (const block of drawnBlocks) {
        const brightness = (block.rgbR * 299 + block.rgbG * 587 + block.rgbB * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
        
        ctx.font = `bold ${fontSize}px Arial`;
        const centerX = block.x + cellSize / 2;
        const centerY = block.y + cellSize / 2;
        ctx.fillText(block.color.code, centerX, centerY);
      }
      
      // Step 8: Draw grid lines
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = Math.max(1, Math.floor(scale * 0.5));

      for (let i = 0; i <= gridSize; i++) {
        const pos = marginSize + i * cellSize;
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pos, marginSize);
        ctx.lineTo(pos, marginSize + gridAreaSize);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(marginSize, pos);
        ctx.lineTo(marginSize + gridAreaSize, pos);
        ctx.stroke();
      }

      // Draw thicker lines every 5 cells
      if (gridSize >= 10) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = Math.max(1.5, Math.floor(scale * 0.75));
        
        for (let i = 0; i <= gridSize; i += 5) {
          const pos = marginSize + i * cellSize;
          
          ctx.beginPath();
          ctx.moveTo(pos, marginSize);
          ctx.lineTo(pos, marginSize + gridAreaSize);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(marginSize, pos);
          ctx.lineTo(marginSize + gridAreaSize, pos);
          ctx.stroke();
        }
      }

      // Step 9: Draw edge numbers (1,2,3... for both axes)
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numberFontSize = Math.max(14, Math.min(24, marginSize / 2.5));
      ctx.font = `bold ${numberFontSize}px Arial`;

      // Top edge numbers
      for (let i = 0; i < gridSize; i++) {
        const x = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), x, marginSize / 2);
      }

      // Bottom edge numbers
      for (let i = 0; i < gridSize; i++) {
        const x = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), x, totalSize - marginSize / 2);
      }

      // Left edge numbers
      ctx.textAlign = 'center';
      for (let i = 0; i < gridSize; i++) {
        const y = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), marginSize / 2, y);
      }

      // Right edge numbers
      for (let i = 0; i < gridSize; i++) {
        const y = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), totalSize - marginSize / 2, y);
      }

      // Convert color map to legend array
      const legend = Array.from(colorMap.values()).sort((a, b) => a.code.localeCompare(b.code));

      resolve({
        image: canvas.toDataURL('image/png'),
        legend
      });
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = subjectImageUrl;
  });
}
