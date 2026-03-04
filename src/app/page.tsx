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
import type { BodySegmenter } from '@tensorflow-models/body-segmentation';

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

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [removedBgWithEdge, setRemovedBgWithEdge] = useState<string | null>(null); // 原图抠图带红色边缘线
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [animeWithEdge, setAnimeWithEdge] = useState<string | null>(null); // 动漫图像带红色边缘线
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
  const [beadPatternLegend, setBeadPatternLegend] = useState<Array<MardColor & { count: number }>>([]);
  const [isGeneratingBeadPattern, setIsGeneratingBeadPattern] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [uploadMode, setUploadMode] = useState<'original' | 'pixel'>('original'); // 上传模式：原图或像素图纸
  const [pixelGridSize, setPixelGridSize] = useState<number | null>(null); // 像素图纸检测到的网格数
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelRef = useRef<{
    segmenter: BodySegmenter | null;
    loaded: boolean;
  }>({ segmenter: null, loaded: false });

  // Load TensorFlow model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        const tf = await import('@tensorflow/tfjs');
        const bodySegmentation = await import('@tensorflow-models/body-segmentation');
        
        await tf.ready();
        
        const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
        const segmenter = await bodySegmentation.createSegmenter(model, {
          runtime: 'tfjs',
          modelType: 'general',
        });
        
        modelRef.current = { segmenter, loaded: true };
        setModelLoaded(true);
        console.log('Model loaded successfully');
      } catch (err) {
        console.error('Failed to load MediaPipe model:', err);
        // Try fallback to BodyPix
        try {
          const tf = await import('@tensorflow/tfjs');
          const bodySegmentation = await import('@tensorflow-models/body-segmentation');
          
          await tf.ready();
          
          const model = bodySegmentation.SupportedModels.BodyPix;
          const segmenter = await bodySegmentation.createSegmenter(model, {
            architecture: 'ResNet50',
            outputStride: 16,
            quantBytes: 4,
          });
          
          modelRef.current = { segmenter, loaded: true };
          setModelLoaded(true);
          console.log('Fallback BodyPix model loaded');
        } catch (fallbackErr) {
          console.error('Fallback also failed:', fallbackErr);
        }
      }
    };
    
    loadModel();
  }, []);

  // Reset state when upload mode changes
  useEffect(() => {
    // Reset all state when mode changes
    setOriginalImage(null);
    setRemovedBgImage(null);
    setRemovedBgWithEdge(null);
    setAnimeImage(null);
    setAnimeWithEdge(null);
    setFinalImage(null);
    setUseAnimeImage(false);
    setProgress(0);
    setError(null);
    setStep('idle');
    setPixelatedImage(null);
    setPixelatedSubject(null);
    setBeadPatternImage(null);
    setBeadPatternLegend([]);
    setPixelGridSize(null);
  }, [uploadMode]);

  // Handle click on upload area
  const handleUploadClick = useCallback(() => {
    // Original mode requires model, pixel mode doesn't
    const canProceed = uploadMode === 'pixel' || modelLoaded;
    
    if ((step === 'idle' || step === 'done') && canProceed) {
      if (step === 'done') {
        setOriginalImage(null);
        setRemovedBgImage(null);
        setRemovedBgWithEdge(null);
        setAnimeImage(null);
        setAnimeWithEdge(null);
        setFinalImage(null);
        setUseAnimeImage(false);
        setProgress(0);
        setError(null);
        setPixelatedImage(null);
        setPixelatedSubject(null);
        setBeadPatternImage(null);
        setBeadPatternLegend([]);
        setPixelGridSize(null);
      }
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }
  }, [step, modelLoaded]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setProgress(0);
    setFinalImage(null);
    setRemovedBgImage(null);
    setRemovedBgWithEdge(null);
    setAnimeImage(null);
    setAnimeWithEdge(null);
    setUseAnimeImage(false);
    setPixelatedImage(null);
    setPixelatedSubject(null);
    setBeadPatternImage(null);
    setBeadPatternLegend([]);
    setPixelGridSize(null);

    try {
      setStep('uploading');
      setProgress(10);
      const imageDataUrl = await readFileAsDataURL(file);
      setOriginalImage(imageDataUrl);

      // Pixel art mode: directly process pixel art to bead pattern
      if (uploadMode === 'pixel') {
        setStep('generating-grid');
        setProgress(30);
        
        const result = await processPixelArt(imageDataUrl, 0); // Auto-detect grid size
        
        setPixelGridSize(result.detectedGridSize);
        setGridSize(result.detectedGridSize);
        setBeadPatternImage(result.image);
        setBeadPatternLegend(result.legend);
        setFinalImage(result.image);
        setRemovedBgImage(imageDataUrl); // Keep original as reference
        setRemovedBgWithEdge(imageDataUrl);
        
        setStep('done');
        setProgress(100);
        return;
      }

      // Original mode: AI background removal
      setStep('loading-model');
      setProgress(20);
      
      let segmenter = modelRef.current.segmenter;
      
      if (!segmenter) {
        const tf = await import('@tensorflow/tfjs');
        const bodySegmentation = await import('@tensorflow-models/body-segmentation');
        
        await tf.ready();
        
        const model = bodySegmentation.SupportedModels.MediaPipeSelfieSegmentation;
        segmenter = await bodySegmentation.createSegmenter(model, {
          runtime: 'tfjs',
          modelType: 'general',
        });
        
        modelRef.current = { segmenter, loaded: true };
      }
      setProgress(30);

      setStep('removing-bg');
      setProgress(40);

      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      const result = await new Promise<string>((resolve, reject) => {
        img.onload = async () => {
          try {
            const originalWidth = img.width;
            const originalHeight = img.height;
            
            setProgress(50);
            
            const segmentation = await segmenter!.segmentPeople(img, {
              flipHorizontal: false,
            });
            
            if (!segmentation || segmentation.length === 0) {
              reject(new Error('无法识别图像内容，请尝试其他图片'));
              return;
            }
            
            setProgress(70);
            
            const mask = await segmentation[0].mask.toImageData();
            const removedBgDataUrl = await applyBackgroundRemoval(
              imageDataUrl,
              mask,
              originalWidth,
              originalHeight
            );
            
            setProgress(85);
            resolve(removedBgDataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = () => reject(new Error('无法加载图片'));
        img.src = imageDataUrl;
      });

      setRemovedBgImage(result);

      // Generate preview with red edge outline
      const withEdge = await drawAnimeWithEdge(result);
      setRemovedBgWithEdge(withEdge);
      
      // Set final image to the cutout with edge (no grid)
      setFinalImage(withEdge);

      setStep('done');
      setProgress(100);
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : '处理图片时发生错误');
      setStep('idle');
      setProgress(0);
    }
  }, []);

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
        
        // Generate preview with red edge outline
        const withEdge = await drawAnimeWithEdge(cleanedImage);
        setAnimeWithEdge(withEdge);
        
        // Set final image to anime cutout with edge (no grid)
        setFinalImage(withEdge);
      } else {
        setError(data.error || '动漫风格转换失败');
      }
    } catch (err) {
      console.error('Anime transform error:', err);
      setError(err instanceof Error ? err.message : '动漫风格转换失败');
    } finally {
      setIsTransformingAnime(false);
    }
  }, [removedBgImage, isTransformingAnime]);

  // Regenerate with new grid size (for pixelation only)
  const handleGridSizeChange = useCallback(async (newGridSize: number) => {
    setGridSize(newGridSize);
    // Grid size change only affects pixelation, not the main result
  }, []);

  // Toggle between original and anime image
  const handleToggleImageSource = useCallback(async () => {
    if (!removedBgImage) return;
    
    const newUseAnime = !useAnimeImage;
    setUseAnimeImage(newUseAnime);
    
    // Switch final image between original and anime cutout
    if (newUseAnime && animeWithEdge) {
      setFinalImage(animeWithEdge);
    } else if (removedBgWithEdge) {
      setFinalImage(removedBgWithEdge);
    }
  }, [removedBgImage, animeWithEdge, removedBgWithEdge, useAnimeImage]);

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
    link.download = `cutout${useAnimeImage ? '-anime' : ''}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [finalImage, useAnimeImage]);

  // Download original cutout (without edge outline)
  const handleDownloadOriginal = useCallback(() => {
    const sourceImage = useAnimeImage && animeImage ? animeImage : removedBgImage;
    if (!sourceImage) return;

    const link = document.createElement('a');
    link.href = sourceImage;
    link.download = `cutout-original${useAnimeImage ? '-anime' : ''}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [removedBgImage, animeImage, useAnimeImage]);

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
    // Pixel art mode: download the already generated bead pattern
    if (uploadMode === 'pixel') {
      if (!finalImage) return;
      const link = document.createElement('a');
      link.href = finalImage;
      link.download = `bead-pattern-pixel-${pixelGridSize || gridSize}x${pixelGridSize || gridSize}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    // Original mode: Use pixelated subject (transparent background) directly
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
  }, [pixelatedSubject, gridSize, animeImage, beadPatternImage, useAnimeImage, uploadMode, finalImage, pixelGridSize]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setRemovedBgImage(null);
    setRemovedBgWithEdge(null);
    setAnimeImage(null);
    setAnimeWithEdge(null);
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

  const canUpload = (step === 'idle' || step === 'done') && (uploadMode === 'pixel' || modelLoaded);

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
          <div className="mt-4 inline-flex items-center gap-2">
            {modelLoaded ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-green-600 dark:text-green-400">准备就绪，点击上传照片开始</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-blue-600">正在加载 AI 模型，请稍候...</span>
              </>
            )}
          </div>
        </div>

        {/* Grid Size Selector - Only show for original mode */}
        {uploadMode === 'original' && (
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
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Upload Area */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                上传图片
              </h2>

              {/* Upload Mode Selection */}
              <div className="mb-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">选择上传类型：</p>
                <div className="flex gap-2">
                  <Button
                    variant={uploadMode === 'original' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMode('original')}
                    className={uploadMode === 'original' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                  >
                    <ImageIcon className="w-4 h-4 mr-1" />
                    原图（需抠图）
                  </Button>
                  <Button
                    variant={uploadMode === 'pixel' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUploadMode('pixel')}
                    className={uploadMode === 'pixel' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    <Grid3X3 className="w-4 h-4 mr-1" />
                    像素图纸
                  </Button>
                </div>
                {uploadMode === 'pixel' && (
                  <p className="text-xs text-slate-500 mt-2">
                    上传带有网格线的像素图纸，系统将自动检测网格线并划分网格，对每个网格单元填充MARD色号
                  </p>
                )}
              </div>

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
                  <span className="text-sm">
                    {uploadMode === 'pixel' 
                      ? `像素图纸处理完成 - 检测到 ${pixelGridSize || gridSize}×${pixelGridSize || gridSize} 网格`
                      : `处理完成 - ${gridSize}×{gridSize} 网格纸 ${useAnimeImage ? '(动漫风格)' : ''}`
                    }
                  </span>
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
                  {/* Pixel art mode: show different buttons */}
                  {uploadMode === 'pixel' ? (
                    <>
                      {/* Download and Reset */}
                      <div className="flex gap-3">
                        <Button
                          onClick={handleDownloadBeadPattern}
                          className="flex-1 bg-purple-600 hover:bg-purple-700"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载拼豆图纸
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleReset}
                        >
                          重新开始
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
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
                          下载抠图
                        </Button>
                        <Button
                          onClick={handleDownloadOriginal}
                          variant="outline"
                          className="flex-1 border-blue-600 text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-400"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          下载原图
                        </Button>
                        <Button
                          variant="outline"
                          onClick={handleReset}
                        >
                          重新开始
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right: Preview */}
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <ImageIcon className="w-5 h-5" />
                {uploadMode === 'pixel' ? '拼豆图纸' : '处理结果'}
                {finalImage && uploadMode !== 'pixel' && (
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({useAnimeImage ? '动漫风格' : '原图抠图'}，带边缘线)
                  </span>
                )}
              </h2>

              <div 
                className="aspect-square rounded-xl overflow-hidden flex items-center justify-center"
                style={finalImage ? {
                  backgroundImage: `
                    linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                    linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                    linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                  `,
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#fff',
                } : {
                  backgroundColor: '#f1f5f9',
                }}
              >
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
                {animeWithEdge ? (
                  <img
                    src={animeWithEdge}
                    alt="动漫风格抠图结果（带边缘线）"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : animeImage ? (
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
                        <span className="text-sm text-slate-500">×{color.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    总计: {beadPatternLegend.reduce((sum, c) => sum + c.count, 0)} 颗拼豆
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
      
      // Scale mask to original image size with high quality
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

      // Step 1: Create binary mask with threshold
      const threshold = 128;
      const binaryMask = new Uint8Array(originalWidth * originalHeight);
      const rawMask = new Float32Array(originalWidth * originalHeight);
      
      for (let i = 0; i < maskData.length; i += 4) {
        const idx = i / 4;
        rawMask[idx] = maskData[i] / 255;
        binaryMask[idx] = maskData[i] > threshold ? 1 : 0;
      }

      // Step 2: Morphological operations - Close (dilate then erode) to fill small holes
      const morphClose = (mask: Uint8Array, width: number, height: number, kernelSize: number): Uint8Array => {
        const result = new Uint8Array(mask.length);
        const half = Math.floor(kernelSize / 2);
        
        // Dilate
        const dilated = new Uint8Array(mask.length);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let maxVal = 0;
            for (let ky = -half; ky <= half; ky++) {
              for (let kx = -half; kx <= half; kx++) {
                const nx = Math.min(Math.max(x + kx, 0), width - 1);
                const ny = Math.min(Math.max(y + ky, 0), height - 1);
                maxVal = Math.max(maxVal, mask[ny * width + nx]);
              }
            }
            dilated[y * width + x] = maxVal;
          }
        }
        
        // Erode
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            let minVal = 1;
            for (let ky = -half; ky <= half; ky++) {
              for (let kx = -half; kx <= half; kx++) {
                const nx = Math.min(Math.max(x + kx, 0), width - 1);
                const ny = Math.min(Math.max(y + ky, 0), height - 1);
                minVal = Math.min(minVal, dilated[ny * width + nx]);
              }
            }
            result[y * width + x] = minVal;
          }
        }
        
        return result;
      };

      // Apply morphological close to fill small holes
      const closedMask = morphClose(binaryMask, originalWidth, originalHeight, 3);

      // Step 3: Edge feathering - create smooth transitions at edges
      const edgeDistance = (mask: Uint8Array, width: number, height: number): Float32Array => {
        const distance = new Float32Array(mask.length);
        const maxDist = 8; // Feather distance in pixels
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            if (mask[idx] === 1) {
              // Check distance to nearest background pixel
              let minDist = maxDist;
              for (let dy = -maxDist; dy <= maxDist; dy++) {
                for (let dx = -maxDist; dx <= maxDist; dx++) {
                  const nx = x + dx;
                  const ny = y + dy;
                  if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    if (mask[ny * width + nx] === 0) {
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      minDist = Math.min(minDist, dist);
                    }
                  }
                }
              }
              distance[idx] = Math.min(1, minDist / maxDist);
            } else {
              distance[idx] = 0;
            }
          }
        }
        
        return distance;
      };

      const edgeDist = edgeDistance(closedMask, originalWidth, originalHeight);

      // Step 4: Apply alpha with smooth transitions
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        
        // Use raw mask value for interior, feathered edge for boundary
        const rawValue = rawMask[idx];
        const closedValue = closedMask[idx];
        const edgeValue = edgeDist[idx];
        
        let alpha: number;
        
        if (closedValue === 1) {
          // Inside the mask - use raw value with edge feathering
          alpha = rawValue * edgeValue + rawValue * (1 - edgeValue) * 0.95 + 0.05;
          alpha = Math.max(rawValue, alpha); // Ensure we don't reduce interior values
        } else {
          // Outside the mask - use feathered raw value for soft edges
          alpha = rawValue * 0.3; // Soft edge for pixels just outside
        }
        
        data[i + 3] = Math.min(255, Math.max(0, Math.round(alpha * 255)));
      }

      // Step 5: Apply slight Gaussian blur to alpha channel for smoother edges
      const alphaChannel = new Uint8Array(originalWidth * originalHeight);
      for (let i = 0; i < originalWidth * originalHeight; i++) {
        alphaChannel[i] = data[i * 4 + 3];
      }
      
      // Simple blur (3x3 kernel)
      const blurAlpha = (alpha: Uint8Array, width: number, height: number): Uint8Array => {
        const result = new Uint8Array(alpha.length);
        const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
        const kernelSum = 16;
        
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            let sum = 0;
            let ki = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                sum += alpha[(y + ky) * width + (x + kx)] * kernel[ki++];
              }
            }
            result[y * width + x] = Math.round(sum / kernelSum);
          }
        }
        
        // Copy edges
        for (let x = 0; x < width; x++) {
          result[x] = alpha[x];
          result[(height - 1) * width + x] = alpha[(height - 1) * width + x];
        }
        for (let y = 0; y < height; y++) {
          result[y * width] = alpha[y * width];
          result[y * width + width - 1] = alpha[y * width + width - 1];
        }
        
        return result;
      };
      
      const blurredAlpha = blurAlpha(alphaChannel, originalWidth, originalHeight);
      
      // Apply blurred alpha only to edge regions for smoother transitions
      for (let i = 0; i < originalWidth * originalHeight; i++) {
        const idx = i * 4;
        // Only apply blur effect where there's transition (not solid interior)
        if (data[idx + 3] > 20 && data[idx + 3] < 250) {
          data[idx + 3] = blurredAlpha[i];
        }
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

      // Align to grid cells
      const alignedImgWidth = Math.round(imgWidth / cellSize) * cellSize;
      const alignedImgHeight = Math.round(imgHeight / cellSize) * cellSize;
      
      // Center the image (aligned to grid)
      const offsetX = Math.round((width - alignedImgWidth) / 2 / cellSize) * cellSize;
      const offsetY = Math.round((height - alignedImgHeight) / 2 / cellSize) * cellSize;
      
      // Draw the image
      ctx.drawImage(img, offsetX, offsetY, alignedImgWidth, alignedImgHeight);
      
      // Get image data for edge detection
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      
      // Detect colored cells (alpha > 10 means it's part of subject)
      const coloredCells = new Set<string>();
      const cellCountX = Math.round(alignedImgWidth / cellSize);
      const cellCountY = Math.round(alignedImgHeight / cellSize);
      
      for (let cellY = 0; cellY < cellCountY; cellY++) {
        for (let cellX = 0; cellX < cellCountX; cellX++) {
          // Check center of each cell for alpha
          const centerX = Math.floor(offsetX + (cellX + 0.5) * cellSize);
          const centerY = Math.floor(offsetY + (cellY + 0.5) * cellSize);
          const idx = (centerY * width + centerX) * 4;
          
          if (data[idx + 3] > 10) {  // Alpha channel
            coloredCells.add(`${cellX},${cellY}`);
          }
        }
      }

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
        
        for (let i = 0; i <= gridCount; i += 5) {
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

      // Step 4: Draw red edge lines ONLY on outer boundary (not internal edges)
      // Use flood fill from outside to find cells that touch the outside
      const outsideCells = new Set<string>();
      const floodStack: string[] = [];
      
      // Start from all edge cells of the grid area
      for (let x = 0; x < cellCountX; x++) {
        if (!coloredCells.has(`${x},0`)) floodStack.push(`${x},0`);
        if (!coloredCells.has(`${x},${cellCountY - 1}`)) floodStack.push(`${x},${cellCountY - 1}`);
      }
      for (let y = 0; y < cellCountY; y++) {
        if (!coloredCells.has(`0,${y}`)) floodStack.push(`0,${y}`);
        if (!coloredCells.has(`${cellCountX - 1},${y}`)) floodStack.push(`${cellCountX - 1},${y}`);
      }
      
      // Flood fill to find all cells reachable from outside
      while (floodStack.length > 0) {
        const key = floodStack.pop()!;
        if (outsideCells.has(key)) continue;
        
        const [cx, cy] = key.split(',').map(Number);
        
        // Stop at colored cells (these are the boundary)
        if (coloredCells.has(key)) continue;
        
        outsideCells.add(key);
        
        // Add neighbors
        if (cx > 0) floodStack.push(`${cx - 1},${cy}`);
        if (cx < cellCountX - 1) floodStack.push(`${cx + 1},${cy}`);
        if (cy > 0) floodStack.push(`${cx},${cy - 1}`);
        if (cy < cellCountY - 1) floodStack.push(`${cx},${cy + 1}`);
      }
      
      // Only draw edges where colored cells touch outside cells
      const edgeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      
      for (const key of coloredCells) {
        const [cellX, cellY] = key.split(',').map(Number);
        const x = offsetX + cellX * cellSize;
        const y = offsetY + cellY * cellSize;
        
        // Only draw edge if neighbor is OUTSIDE (not just non-colored)
        // Top edge
        if (outsideCells.has(`${cellX},${cellY - 1}`) || cellY === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
        }
        // Bottom edge
        if (outsideCells.has(`${cellX},${cellY + 1}`) || cellY === cellCountY - 1) {
          edgeLines.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
        // Left edge
        if (outsideCells.has(`${cellX - 1},${cellY}`) || cellX === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
        }
        // Right edge
        if (outsideCells.has(`${cellX + 1},${cellY}`) || cellX === cellCountX - 1) {
          edgeLines.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
      }
      
      // Draw red edge lines
      ctx.strokeStyle = '#ef4444';  // Red color
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      
      for (const line of edgeLines) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

// High-resolution version of composeWithGrid
async function composeWithGridHD(
  imageUrl: string, 
  gridCount: number, 
  scale: number = 3
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const baseGridSize = 800;
      const gridSize = baseGridSize * scale;
      const cellSize = gridSize / gridCount;
      const marginSize = 50 * scale;
      const totalSize = gridSize + marginSize * 2;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      canvas.width = totalSize;
      canvas.height = totalSize;

      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalSize, totalSize);

      // Calculate image size (area = grid size² * 0.9, keep aspect ratio)
      const targetArea = gridSize * gridSize * 0.9;
      const originalArea = img.width * img.height;
      const scaleFactor = Math.sqrt(targetArea / originalArea);
      let imgWidth = img.width * scaleFactor;
      let imgHeight = img.height * scaleFactor;

      // Align to grid cells
      const alignedImgWidth = Math.round(imgWidth / cellSize) * cellSize;
      const alignedImgHeight = Math.round(imgHeight / cellSize) * cellSize;
      
      // Center the image (aligned to grid)
      const offsetX = marginSize + Math.round((gridSize - alignedImgWidth) / 2 / cellSize) * cellSize;
      const offsetY = marginSize + Math.round((gridSize - alignedImgHeight) / 2 / cellSize) * cellSize;
      
      // Draw the image
      ctx.drawImage(img, offsetX, offsetY, alignedImgWidth, alignedImgHeight);
      
      // Get image data for edge detection
      const imageData = ctx.getImageData(0, 0, totalSize, totalSize);
      const data = imageData.data;
      
      // Detect colored cells (alpha > 10 means it's part of subject)
      const coloredCells = new Set<string>();
      const cellCountX = Math.round(alignedImgWidth / cellSize);
      const cellCountY = Math.round(alignedImgHeight / cellSize);
      
      for (let cellY = 0; cellY < cellCountY; cellY++) {
        for (let cellX = 0; cellX < cellCountX; cellX++) {
          const centerX = Math.floor(offsetX + (cellX + 0.5) * cellSize);
          const centerY = Math.floor(offsetY + (cellY + 0.5) * cellSize);
          const idx = (centerY * totalSize + centerX) * 4;
          
          if (data[idx + 3] > 10) {
            coloredCells.add(`${cellX},${cellY}`);
          }
        }
      }

      // Draw grid lines ON TOP
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = Math.max(1, Math.floor(scale * 0.5));

      for (let i = 0; i <= gridCount; i++) {
        const pos = marginSize + i * cellSize;
        
        ctx.beginPath();
        ctx.moveTo(pos, marginSize);
        ctx.lineTo(pos, marginSize + gridSize);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(marginSize, pos);
        ctx.lineTo(marginSize + gridSize, pos);
        ctx.stroke();
      }

      // Draw thicker lines every 5 cells
      if (gridCount >= 10) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = Math.max(1.5, Math.floor(scale * 0.75));
        
        for (let i = 0; i <= gridCount; i += 5) {
          const pos = marginSize + i * cellSize;
          
          ctx.beginPath();
          ctx.moveTo(pos, marginSize);
          ctx.lineTo(pos, marginSize + gridSize);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(marginSize, pos);
          ctx.lineTo(marginSize + gridSize, pos);
          ctx.stroke();
        }
      }

      // Draw red edge lines ONLY on outer boundary
      const outsideCells = new Set<string>();
      const floodStack: string[] = [];
      
      for (let x = 0; x < cellCountX; x++) {
        if (!coloredCells.has(`${x},0`)) floodStack.push(`${x},0`);
        if (!coloredCells.has(`${x},${cellCountY - 1}`)) floodStack.push(`${x},${cellCountY - 1}`);
      }
      for (let y = 0; y < cellCountY; y++) {
        if (!coloredCells.has(`0,${y}`)) floodStack.push(`0,${y}`);
        if (!coloredCells.has(`${cellCountX - 1},${y}`)) floodStack.push(`${cellCountX - 1},${y}`);
      }
      
      while (floodStack.length > 0) {
        const key = floodStack.pop()!;
        if (outsideCells.has(key)) continue;
        
        const [cx, cy] = key.split(',').map(Number);
        
        if (coloredCells.has(key)) continue;
        
        outsideCells.add(key);
        
        if (cx > 0) floodStack.push(`${cx - 1},${cy}`);
        if (cx < cellCountX - 1) floodStack.push(`${cx + 1},${cy}`);
        if (cy > 0) floodStack.push(`${cx},${cy - 1}`);
        if (cy < cellCountY - 1) floodStack.push(`${cx},${cy + 1}`);
      }
      
      const edgeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      
      for (const key of coloredCells) {
        const [cellX, cellY] = key.split(',').map(Number);
        const x = offsetX + cellX * cellSize;
        const y = offsetY + cellY * cellSize;
        
        if (outsideCells.has(`${cellX},${cellY - 1}`) || cellY === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
        }
        if (outsideCells.has(`${cellX},${cellY + 1}`) || cellY === cellCountY - 1) {
          edgeLines.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
        if (outsideCells.has(`${cellX - 1},${cellY}`) || cellX === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
        }
        if (outsideCells.has(`${cellX + 1},${cellY}`) || cellX === cellCountX - 1) {
          edgeLines.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
      }
      
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, Math.floor(scale * 1));
      ctx.lineCap = 'round';
      
      for (const line of edgeLines) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }

      // Draw edge numbers
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numberFontSize = Math.max(14, Math.min(24, marginSize / 2.5));
      ctx.font = `bold ${numberFontSize}px Arial`;

      for (let i = 0; i < gridCount; i++) {
        const xPos = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), xPos, marginSize / 2);
        ctx.fillText(String(i + 1), xPos, totalSize - marginSize / 2);
      }

      for (let i = 0; i < gridCount; i++) {
        const yPos = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), marginSize / 2, yPos);
        ctx.fillText(String(i + 1), totalSize - marginSize / 2, yPos);
      }

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

interface PixelateResult {
  fullImage: string;      // 完整图片（带白色背景和网格线）
  subjectImage: string;   // 单独的像素化主体（透明背景）
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
      
      // Max dimension (width or height) = grid size * 0.9, keep aspect ratio
      const maxDimension = Math.max(imgWidth, imgHeight);
      const targetMaxSize = gridSize * 0.9;
      const scaleFactor = targetMaxSize / maxDimension;
      
      // Align size to grid cells
      const alignedWidth = Math.round(imgWidth * scaleFactor / cellSize) * cellSize;
      const alignedHeight = Math.round(imgHeight * scaleFactor / cellSize) * cellSize;
      
      // Align position to grid lines (centered)
      const offsetX = Math.round((gridSize - alignedWidth) / 2 / cellSize) * cellSize;
      const offsetY = Math.round((gridSize - alignedHeight) / 2 / cellSize) * cellSize;

      // Calculate grid cell counts for subject
      const cellCountX = Math.round(alignedWidth / cellSize);
      const cellCountY = Math.round(alignedHeight / cellSize);

      // Step 3: Pixelate ONLY the subject (on 800x800 canvas, centered)
      const subjectCanvas = document.createElement('canvas');
      const subjectCtx = subjectCanvas.getContext('2d');
      
      if (!subjectCtx) {
        reject(new Error('无法创建主体画布'));
        return;
      }

      // Use 800x800 canvas for subject, so it's already centered
      subjectCanvas.width = gridSize;
      subjectCanvas.height = gridSize;

      // Track colored cells for edge detection
      const coloredCells = new Set<string>();

      // Pixelate each grid cell of the subject
      for (let gridY = 0; gridY < cellCountY; gridY++) {
        for (let gridX = 0; gridX < cellCountX; gridX++) {
          // Calculate corresponding source region
          const srcX1 = Math.floor(gridX / cellCountX * imgWidth);
          const srcY1 = Math.floor(gridY / cellCountY * imgHeight);
          const srcX2 = Math.floor((gridX + 1) / cellCountX * imgWidth);
          const srcY2 = Math.floor((gridY + 1) / cellCountY * imgHeight);
          
          // Calculate average color from source region
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
          
          if (pixelCount > 0) {
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);
            const avgA = Math.round(totalA / pixelCount);
            
            // Only draw if pixel has some opacity (is part of subject)
            if (avgA > 10) {
              // Draw at centered position (offsetX, offsetY) on 800x800 canvas
              subjectCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA / 255})`;
              subjectCtx.fillRect(
                offsetX + gridX * cellSize,
                offsetY + gridY * cellSize,
                cellSize,
                cellSize
              );
              // Track this cell as colored (use grid position relative to subject area)
              coloredCells.add(`${gridX},${gridY}`);
            }
          }
        }
      }

      // Step 3.5: Remove isolated points (small disconnected regions)
      // Find connected components and keep only the largest one(s)
      const removeIsolatedPoints = (cells: Set<string>, minSize: number = 3): Set<string> => {
        if (cells.size === 0) return cells;
        
        const visited = new Set<string>();
        const components: Array<Set<string>> = [];
        
        // Find all connected components using BFS
        for (const cell of cells) {
          if (visited.has(cell)) continue;
          
          const component = new Set<string>();
          const queue = [cell];
          
          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            if (!cells.has(current)) continue;
            
            visited.add(current);
            component.add(current);
            
            const [x, y] = current.split(',').map(Number);
            // Check 8-connected neighbors
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = `${x + dx},${y + dy}`;
                if (cells.has(neighbor) && !visited.has(neighbor)) {
                  queue.push(neighbor);
                }
              }
            }
          }
          
          components.push(component);
        }
        
        // Find the largest component (main subject)
        if (components.length === 0) return cells;
        
        components.sort((a, b) => b.size - a.size);
        const largestSize = components[0].size;
        
        // Keep only components that are at least minSize or at least 10% of the largest
        const threshold = Math.max(minSize, Math.floor(largestSize * 0.1));
        
        const keptCells = new Set<string>();
        for (const component of components) {
          if (component.size >= threshold) {
            for (const cell of component) {
              keptCells.add(cell);
            }
          }
        }
        
        return keptCells;
      };
      
      const filteredCells = removeIsolatedPoints(coloredCells, 3);
      
      // Redraw subjectCanvas with only non-isolated cells
      subjectCtx.clearRect(0, 0, gridSize, gridSize);
      coloredCells.clear();
      
      // We need to re-read colors from source for filtered cells
      for (const key of filteredCells) {
        const [gridX, gridY] = key.split(',').map(Number);
        
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
        
        if (pixelCount > 0) {
          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);
          const avgA = Math.round(totalA / pixelCount);
          
          if (avgA > 10) {
            subjectCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${avgA / 255})`;
            subjectCtx.fillRect(
              offsetX + gridX * cellSize,
              offsetY + gridY * cellSize,
              cellSize,
              cellSize
            );
            coloredCells.add(key);
          }
        }
      }

      // Step 4: Create final canvas with white background
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

      // Step 5: Place pixelated subject on the grid (already centered in subjectCanvas)
      // subjectCanvas is 800x800 with subject centered, so draw at (0, 0)
      resultCtx.drawImage(subjectCanvas, 0, 0);

      // Step 6: Draw grid lines on top
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

      // Step 7: Draw red edge lines ONLY on outer boundary (not internal edges)
      // Use flood fill from outside to find cells that touch the outside
      // Now we need to check the entire 800x800 canvas, not just the subject area
      
      // First, rebuild coloredCells with absolute grid coordinates (0 to gridCount-1)
      const absColoredCells = new Set<string>();
      const subjImageData = subjectCtx.getImageData(0, 0, gridSize, gridSize);
      const subjData = subjImageData.data;
      
      for (let absGridY = 0; absGridY < gridCount; absGridY++) {
        for (let absGridX = 0; absGridX < gridCount; absGridX++) {
          const centerX = Math.floor((absGridX + 0.5) * cellSize);
          const centerY = Math.floor((absGridY + 0.5) * cellSize);
          const idx = (centerY * gridSize + centerX) * 4;
          
          if (subjData[idx + 3] > 10) {
            absColoredCells.add(`${absGridX},${absGridY}`);
          }
        }
      }
      
      // Flood fill from outside
      const outsideCells = new Set<string>();
      const floodStack: string[] = [];
      
      // Start from all edge cells of the entire grid
      for (let x = 0; x < gridCount; x++) {
        if (!absColoredCells.has(`${x},0`)) floodStack.push(`${x},0`);
        if (!absColoredCells.has(`${x},${gridCount - 1}`)) floodStack.push(`${x},${gridCount - 1}`);
      }
      for (let y = 0; y < gridCount; y++) {
        if (!absColoredCells.has(`0,${y}`)) floodStack.push(`0,${y}`);
        if (!absColoredCells.has(`${gridCount - 1},${y}`)) floodStack.push(`${gridCount - 1},${y}`);
      }
      
      // Flood fill to find all cells reachable from outside
      while (floodStack.length > 0) {
        const key = floodStack.pop()!;
        if (outsideCells.has(key)) continue;
        
        const [cx, cy] = key.split(',').map(Number);
        
        // Stop at colored cells (these are the boundary)
        if (absColoredCells.has(key)) continue;
        
        outsideCells.add(key);
        
        // Add neighbors
        if (cx > 0) floodStack.push(`${cx - 1},${cy}`);
        if (cx < gridCount - 1) floodStack.push(`${cx + 1},${cy}`);
        if (cy > 0) floodStack.push(`${cx},${cy - 1}`);
        if (cy < gridCount - 1) floodStack.push(`${cx},${cy + 1}`);
      }
      
      // Only draw edges where colored cells touch outside cells
      const edgeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      
      for (const key of absColoredCells) {
        const [gridX, gridY] = key.split(',').map(Number);
        const x = gridX * cellSize;
        const y = gridY * cellSize;
        
        // Only draw edge if neighbor is OUTSIDE (not just non-colored)
        // Top edge
        if (outsideCells.has(`${gridX},${gridY - 1}`) || gridY === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
        }
        // Bottom edge
        if (outsideCells.has(`${gridX},${gridY + 1}`) || gridY === gridCount - 1) {
          edgeLines.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
        // Left edge
        if (outsideCells.has(`${gridX - 1},${gridY}`) || gridX === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
        }
        // Right edge
        if (outsideCells.has(`${gridX + 1},${gridY}`) || gridX === gridCount - 1) {
          edgeLines.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
      }
      
      // Draw red edge lines
      resultCtx.strokeStyle = '#ef4444';  // Red color
      resultCtx.lineWidth = 2;
      resultCtx.lineCap = 'round';
      
      for (const line of edgeLines) {
        resultCtx.beginPath();
        resultCtx.moveTo(line.x1, line.y1);
        resultCtx.lineTo(line.x2, line.y2);
        resultCtx.stroke();
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

// Draw anime image with red edge outline on transparent background
// Draw anime image with red edge outline on transparent background, centered
async function drawAnimeWithEdge(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // First, get the bounding box of the subject
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      tempCanvas.width = img.width;
      tempCanvas.height = img.height;
      tempCtx.drawImage(img, 0, 0);
      
      const tempImageData = tempCtx.getImageData(0, 0, img.width, img.height);
      const tempData = tempImageData.data;
      
      // Find bounding box of subject
      let minX = img.width, minY = img.height, maxX = 0, maxY = 0;
      for (let y = 0; y < img.height; y++) {
        for (let x = 0; x < img.width; x++) {
          const idx = (y * img.width + x) * 4;
          if (tempData[idx + 3] > 10) {
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      
      // If no subject found, return original
      if (minX > maxX || minY > maxY) {
        resolve(imageUrl);
        return;
      }
      
      // Add padding to bounding box
      const padding = 10;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(img.width - 1, maxX + padding);
      maxY = Math.min(img.height - 1, maxY + padding);
      
      const subjectWidth = maxX - minX + 1;
      const subjectHeight = maxY - minY + 1;
      
      // Create square canvas (800x800)
      const canvasSize = 800;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      canvas.width = canvasSize;
      canvas.height = canvasSize;
      
      // Calculate scale to fit subject in 90% of canvas
      const targetSize = canvasSize * 0.9;
      const scale = Math.min(targetSize / subjectWidth, targetSize / subjectHeight);
      
      const scaledWidth = subjectWidth * scale;
      const scaledHeight = subjectHeight * scale;
      
      // Center the subject
      const offsetX = (canvasSize - scaledWidth) / 2;
      const offsetY = (canvasSize - scaledHeight) / 2;
      
      // Draw the subject centered and scaled
      ctx.drawImage(
        img,
        minX, minY, subjectWidth, subjectHeight,
        offsetX, offsetY, scaledWidth, scaledHeight
      );
      
      const imageData = ctx.getImageData(0, 0, canvasSize, canvasSize);
      const data = imageData.data;
      const width = canvasSize;
      const height = canvasSize;
      
      // Detect subject pixels (alpha > 10)
      const subjectMask = new Uint8Array(width * height).fill(0);
      for (let i = 0; i < width * height; i++) {
        if (data[i * 4 + 3] > 10) {
          subjectMask[i] = 1;
        }
      }
      
      // Remove isolated points (small disconnected regions)
      const removeIsolatedPixels = (mask: Uint8Array, w: number, h: number, minSize: number = 100): Uint8Array => {
        const result = new Uint8Array(mask.length);
        const visited = new Uint8Array(mask.length);
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            if (mask[idx] === 0 || visited[idx]) continue;
            
            // BFS to find connected component
            const component: number[] = [];
            const queue: number[] = [idx];
            
            while (queue.length > 0) {
              const current = queue.shift()!;
              if (visited[current]) continue;
              if (mask[current] === 0) continue;
              
              visited[current] = 1;
              component.push(current);
              
              const cx = current % w;
              const cy = Math.floor(current / w);
              
              // Check 8-connected neighbors
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue;
                  const nx = cx + dx;
                  const ny = cy + dy;
                  if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                    const nIdx = ny * w + nx;
                    if (mask[nIdx] && !visited[nIdx]) {
                      queue.push(nIdx);
                    }
                  }
                }
              }
            }
            
            // Only keep components larger than minSize
            if (component.length >= minSize) {
              for (const cIdx of component) {
                result[cIdx] = 1;
              }
            }
          }
        }
        
        return result;
      };
      
      // Apply isolated pixel removal (minimum 100 pixels to avoid noise)
      const filteredMask = removeIsolatedPixels(subjectMask, width, height, 100);
      
      // Clear pixels that were removed
      for (let i = 0; i < width * height; i++) {
        if (subjectMask[i] && !filteredMask[i]) {
          data[i * 4 + 3] = 0; // Make isolated pixels transparent
        }
      }
      
      // Update subjectMask to filtered version
      for (let i = 0; i < width * height; i++) {
        subjectMask[i] = filteredMask[i];
      }
      
      // Flood fill from edges to find external area
      const externalArea = new Uint8Array(width * height).fill(0);
      const stack: [number, number][] = [];
      
      // Add all edge pixels to stack
      for (let x = 0; x < width; x++) {
        if (subjectMask[x] === 0) stack.push([x, 0]);
        if (subjectMask[(height - 1) * width + x] === 0) stack.push([x, height - 1]);
      }
      for (let y = 0; y < height; y++) {
        if (subjectMask[y * width] === 0) stack.push([0, y]);
        if (subjectMask[y * width + width - 1] === 0) stack.push([width - 1, y]);
      }
      
      // Flood fill
      while (stack.length > 0) {
        const [x, y] = stack.pop()!;
        const idx = y * width + x;
        
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        if (externalArea[idx]) continue;
        if (subjectMask[idx]) continue; // Stop at subject pixels
        
        externalArea[idx] = 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      
      // Find outer edge pixels (subject pixels adjacent to external area)
      const edgePixels = new Uint8Array(width * height).fill(0);
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const idx = y * width + x;
          if (!subjectMask[idx]) continue;
          
          // Check if adjacent to external area
          const neighbors = [
            (y - 1) * width + x,
            (y + 1) * width + x,
            y * width + x - 1,
            y * width + x + 1
          ];
          
          for (const nIdx of neighbors) {
            if (externalArea[nIdx]) {
              edgePixels[idx] = 1;
              break;
            }
          }
        }
      }
      
      // Draw red edge outline
      ctx.putImageData(imageData, 0, 0); // Restore original image
      
      // Draw red dots for each edge pixel
      for (let i = 0; i < width * height; i++) {
        if (edgePixels[i]) {
          const x = i % width;
          const y = Math.floor(i / width);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x - 1, y - 1, 3, 3);
        }
      }
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

// Remove black/white background from edges only (preserve black accessories like glasses)
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
      const width = canvas.width;
      const height = canvas.height;

      // Create mask for pixels to remove (background)
      const toRemove = new Uint8Array(width * height).fill(0);
      
      // Check if pixel is black or white background
      const isBackgroundColor = (r: number, g: number, b: number): boolean => {
        const isBlack = r < 30 && g < 30 && b < 30;
        const isWhite = r > 235 && g > 235 && b > 235;
        return isBlack || isWhite;
      };
      
      // Flood fill from edges to find background regions
      const floodFill = (startX: number, startY: number) => {
        const stack: [number, number][] = [[startX, startY]];
        const visited = new Set<string>();
        
        while (stack.length > 0) {
          const [x, y] = stack.pop()!;
          const key = `${x},${y}`;
          
          if (visited.has(key)) continue;
          if (x < 0 || x >= width || y < 0 || y >= height) continue;
          
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          
          // Only process if it's background color and not already marked
          const pixelIdx = y * width + x;
          if (toRemove[pixelIdx]) continue;
          if (!isBackgroundColor(r, g, b)) continue;
          if (a < 10) continue; // Already transparent
          
          visited.add(key);
          toRemove[pixelIdx] = 1;
          
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      };
      
      // Start flood fill from all edges
      for (let x = 0; x < width; x++) {
        floodFill(x, 0);
        floodFill(x, height - 1);
      }
      for (let y = 0; y < height; y++) {
        floodFill(0, y);
        floodFill(width - 1, y);
      }
      
      // Apply mask - make background pixels transparent
      for (let i = 0; i < width * height; i++) {
        if (toRemove[i]) {
          data[i * 4 + 3] = 0;
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
// Input: pixelated subject image (transparent background)
// Process: read subject colors → fill all cells inside subject outline → place on blank grid
async function generateBeadPatternHD(
  subjectImageUrl: string,
  gridSize: number,
  scale: number = 3
): Promise<{ image: string; legend: Array<MardColor & { count: number }> }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Step 1: Get source image data (pixelated subject with transparent background)
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
      
      // Step 2: Identify colored cells and their colors
      const coloredCells = new Set<string>();
      const cellColors = new Map<string, { avgR: number; avgG: number; avgB: number }>();
      
      for (let cellY = 0; cellY < srcCellCountY; cellY++) {
        for (let cellX = 0; cellX < srcCellCountX; cellX++) {
          const startX = Math.floor(cellX * srcCellSize);
          const startY = Math.floor(cellY * srcCellSize);
          const endX = Math.floor((cellX + 1) * srcCellSize);
          const endY = Math.floor((cellY + 1) * srcCellSize);
          
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;
          
          for (let y = startY; y < endY && y < img.height; y++) {
            for (let x = startX; x < endX && x < img.width; x++) {
              const idx = (y * img.width + x) * 4;
              totalR += srcData[idx];
              totalG += srcData[idx + 1];
              totalB += srcData[idx + 2];
              totalA += srcData[idx + 3];
              pixelCount++;
            }
          }
          
          if (pixelCount > 0) {
            const avgA = Math.round(totalA / pixelCount);
            if (avgA > 10) {
              const key = `${cellX},${cellY}`;
              coloredCells.add(key);
              cellColors.set(key, {
                avgR: Math.round(totalR / pixelCount),
                avgG: Math.round(totalG / pixelCount),
                avgB: Math.round(totalB / pixelCount)
              });
            }
          }
        }
      }
      
      // Step 2.5: Remove isolated points (small disconnected regions)
      const removeIsolatedPoints = (cells: Set<string>, minSize: number = 3): Set<string> => {
        if (cells.size === 0) return cells;
        
        const visited = new Set<string>();
        const components: Array<Set<string>> = [];
        
        // Find all connected components using BFS
        for (const cell of cells) {
          if (visited.has(cell)) continue;
          
          const component = new Set<string>();
          const queue = [cell];
          
          while (queue.length > 0) {
            const current = queue.shift()!;
            if (visited.has(current)) continue;
            if (!cells.has(current)) continue;
            
            visited.add(current);
            component.add(current);
            
            const [x, y] = current.split(',').map(Number);
            // Check 8-connected neighbors
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const neighbor = `${x + dx},${y + dy}`;
                if (cells.has(neighbor) && !visited.has(neighbor)) {
                  queue.push(neighbor);
                }
              }
            }
          }
          
          components.push(component);
        }
        
        // Find the largest component (main subject)
        if (components.length === 0) return cells;
        
        components.sort((a, b) => b.size - a.size);
        const largestSize = components[0].size;
        
        // Keep only components that are at least minSize or at least 10% of the largest
        const threshold = Math.max(minSize, Math.floor(largestSize * 0.1));
        
        const keptCells = new Set<string>();
        for (const component of components) {
          if (component.size >= threshold) {
            for (const cell of component) {
              keptCells.add(cell);
            }
          }
        }
        
        return keptCells;
      };
      
      // Apply isolated point removal
      const filteredCells = removeIsolatedPoints(coloredCells, 3);
      
      // Update coloredCells and remove colors for isolated cells
      for (const key of coloredCells) {
        if (!filteredCells.has(key)) {
          cellColors.delete(key);
        }
      }
      coloredCells.clear();
      for (const key of filteredCells) {
        coloredCells.add(key);
      }
      
      // Step 3: Find outline (edge cells)
      const outlineCells = new Set<string>();
      for (const key of coloredCells) {
        const [x, y] = key.split(',').map(Number);
        if (!coloredCells.has(`${x},${y - 1}`) ||
            !coloredCells.has(`${x},${y + 1}`) ||
            !coloredCells.has(`${x - 1},${y}`) ||
            !coloredCells.has(`${x + 1},${y}`)) {
          outlineCells.add(key);
        }
      }
      
      // Step 4: Fill inside the outline using flood fill from outside
      const allCellsInBounds = new Set<string>();
      for (let y = 0; y < srcCellCountY; y++) {
        for (let x = 0; x < srcCellCountX; x++) {
          allCellsInBounds.add(`${x},${y}`);
        }
      }
      
      const outsideCells = new Set<string>();
      const stack: string[] = [];
      
      for (let x = 0; x < srcCellCountX; x++) {
        const topKey = `${x},0`;
        const bottomKey = `${x},${srcCellCountY - 1}`;
        if (!coloredCells.has(topKey)) stack.push(topKey);
        if (!coloredCells.has(bottomKey)) stack.push(bottomKey);
      }
      for (let y = 0; y < srcCellCountY; y++) {
        const leftKey = `0,${y}`;
        const rightKey = `${srcCellCountX - 1},${y}`;
        if (!coloredCells.has(leftKey)) stack.push(leftKey);
        if (!coloredCells.has(rightKey)) stack.push(rightKey);
      }
      
      while (stack.length > 0) {
        const key = stack.pop()!;
        if (outsideCells.has(key)) continue;
        if (coloredCells.has(key)) continue;
        
        outsideCells.add(key);
        const [x, y] = key.split(',').map(Number);
        
        if (x > 0) stack.push(`${x - 1},${y}`);
        if (x < srcCellCountX - 1) stack.push(`${x + 1},${y}`);
        if (y > 0) stack.push(`${x},${y - 1}`);
        if (y < srcCellCountY - 1) stack.push(`${x},${y + 1}`);
      }
      
      const insideCells = new Set<string>();
      for (const key of allCellsInBounds) {
        if (!outsideCells.has(key)) {
          insideCells.add(key);
        }
      }
      
      // Step 5: Match colors to MARD for colored cells
      const colorUsageCount = new Map<string, number>();
      const mardColorMap = new Map<string, MardColor>();
      
      for (const key of coloredCells) {
        const color = cellColors.get(key)!;
        const mardColor = findClosestMardColor(color.avgR, color.avgG, color.avgB);
        mardColorMap.set(key, mardColor);
        const count = colorUsageCount.get(mardColor.code) || 0;
        colorUsageCount.set(mardColor.code, count + 1);
      }
      
      // Step 6: Limit colors to max 20
      const MAX_COLORS = 20;
      let selectedColors: MardColor[];
      
      if (colorUsageCount.size <= MAX_COLORS) {
        selectedColors = Array.from(colorUsageCount.keys()).map(code => {
          const key = Array.from(mardColorMap.entries()).find(([_, v]) => v.code === code)![0];
          return mardColorMap.get(key)!;
        });
      } else {
        const sortedColors = Array.from(colorUsageCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_COLORS)
          .map(([code]) => {
            const key = Array.from(mardColorMap.entries()).find(([_, v]) => v.code === code)![0];
            return mardColorMap.get(key)!;
          });
        selectedColors = sortedColors;
      }
      
      const selectedColorCodes = new Set(selectedColors.map(c => c.code));
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      
      // Step 7: Create HD canvas with space for legend on the right
      const gridAreaSize = 800 * scale;
      const marginSize = 50 * scale;
      const legendWidth = 200 * scale;  // Space for color legend
      const gridTotalSize = gridAreaSize + marginSize * 2;
      const totalWidth = gridTotalSize + legendWidth;
      const totalHeight = gridTotalSize;
      const cellSize = gridAreaSize / gridSize;
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      
      const offsetX = marginSize + Math.floor((gridSize - srcCellCountX) / 2) * cellSize;
      const offsetY = marginSize + Math.floor((gridSize - srcCellCountY) / 2) * cellSize;
      
      // Step 8: Fill ALL cells inside outline and track final color usage
      const fontSize = Math.max(12, Math.floor(cellSize * 0.4));
      const drawnBlocks: Array<{
        x: number;
        y: number;
        color: MardColor;
        rgbR: number;
        rgbG: number;
        rgbB: number;
      }> = [];
      
      const colorMap = new Map<string, MardColor>();
      const finalColorCount = new Map<string, number>();  // Track final usage count
      const whiteMardColor: MardColor = { code: 'W', hex: '#FFFFFF' };
      
      for (const key of insideCells) {
        const [gridX, gridY] = key.split(',').map(Number);
        const x = offsetX + gridX * cellSize;
        const y = offsetY + gridY * cellSize;
        
        let finalColor: MardColor;
        let finalRgb: { r: number; g: number; b: number };
        
        if (coloredCells.has(key)) {
          let mardColor = mardColorMap.get(key)!;
          
          if (!selectedColorCodes.has(mardColor.code)) {
            const srcColor = cellColors.get(key)!;
            let minDist = Infinity;
            for (const color of selectedColors) {
              const rgb = hexToRgb(color.hex);
              const dist = Math.sqrt(
                Math.pow(srcColor.avgR - rgb.r, 2) +
                Math.pow(srcColor.avgG - rgb.g, 2) +
                Math.pow(srcColor.avgB - rgb.b, 2)
              );
              if (dist < minDist) {
                minDist = dist;
                mardColor = color;
              }
            }
          }
          
          finalColor = mardColor;
          finalRgb = hexToRgb(mardColor.hex);
        } else {
          finalColor = whiteMardColor;
          finalRgb = { r: 255, g: 255, b: 255 };
        }
        
        ctx.fillStyle = finalColor.hex;
        ctx.fillRect(x, y, cellSize, cellSize);
        
        drawnBlocks.push({
          x, y,
          color: finalColor,
          rgbR: finalRgb.r,
          rgbG: finalRgb.g,
          rgbB: finalRgb.b
        });
        
        if (!colorMap.has(finalColor.code)) {
          colorMap.set(finalColor.code, finalColor);
        }
        
        // Count final color usage
        const count = finalColorCount.get(finalColor.code) || 0;
        finalColorCount.set(finalColor.code, count + 1);
      }
      
      // Step 9: Draw MARD color codes
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
      
      // Step 10: Draw red edge lines ONLY on outer boundary
      const edgeLines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
      
      for (const key of outlineCells) {
        const [gridX, gridY] = key.split(',').map(Number);
        const x = offsetX + gridX * cellSize;
        const y = offsetY + gridY * cellSize;
        
        if (outsideCells.has(`${gridX},${gridY - 1}`) || gridY === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x + cellSize, y2: y });
        }
        if (outsideCells.has(`${gridX},${gridY + 1}`) || gridY === srcCellCountY - 1) {
          edgeLines.push({ x1: x, y1: y + cellSize, x2: x + cellSize, y2: y + cellSize });
        }
        if (outsideCells.has(`${gridX - 1},${gridY}`) || gridX === 0) {
          edgeLines.push({ x1: x, y1: y, x2: x, y2: y + cellSize });
        }
        if (outsideCells.has(`${gridX + 1},${gridY}`) || gridX === srcCellCountX - 1) {
          edgeLines.push({ x1: x + cellSize, y1: y, x2: x + cellSize, y2: y + cellSize });
        }
      }
      
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = Math.max(2, Math.floor(scale * 1));
      ctx.lineCap = 'round';
      
      for (const line of edgeLines) {
        ctx.beginPath();
        ctx.moveTo(line.x1, line.y1);
        ctx.lineTo(line.x2, line.y2);
        ctx.stroke();
      }
      
      // Step 11: Draw grid lines
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = Math.max(1, Math.floor(scale * 0.5));

      for (let i = 0; i <= gridSize; i++) {
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

      // Step 12: Draw edge numbers
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const numberFontSize = Math.max(14, Math.min(24, marginSize / 2.5));
      ctx.font = `bold ${numberFontSize}px Arial`;

      for (let i = 0; i < gridSize; i++) {
        const xPos = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), xPos, marginSize / 2);
        ctx.fillText(String(i + 1), xPos, gridTotalSize - marginSize / 2);
      }

      for (let i = 0; i < gridSize; i++) {
        const yPos = marginSize + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), marginSize / 2, yPos);
        ctx.fillText(String(i + 1), gridTotalSize - marginSize / 2, yPos);
      }

      // Step 13: Draw color legend on the right side
      const legendX = gridTotalSize + 20 * scale;
      const legendStartY = marginSize;
      const legendItemHeight = 40 * scale;
      const colorBoxSize = 30 * scale;
      
      // Legend title
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.font = `bold ${16 * scale}px Arial`;
      ctx.fillText('色号图例', legendX, legendStartY - 10 * scale);
      
      // Sort colors by code
      const sortedColors = Array.from(colorMap.entries())
        .sort((a, b) => a[0].localeCompare(b[0]));
      
      ctx.font = `${14 * scale}px Arial`;
      
      sortedColors.forEach(([code, color], index) => {
        const y = legendStartY + index * legendItemHeight;
        const count = finalColorCount.get(code) || 0;
        const rgb = hexToRgb(color.hex);
        
        // Draw color box
        ctx.fillStyle = color.hex;
        ctx.fillRect(legendX, y, colorBoxSize, colorBoxSize);
        
        // Draw border for white
        if (color.hex.toUpperCase() === '#FFFFFF') {
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 1;
          ctx.strokeRect(legendX, y, colorBoxSize, colorBoxSize);
        }
        
        // Draw color code and count
        const textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? '#000000' : '#ffffff';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.font = `bold ${12 * scale}px Arial`;
        ctx.fillText(code, legendX + colorBoxSize / 2, y + colorBoxSize / 2 + 4 * scale);
        
        // Draw count on the right
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        ctx.font = `${14 * scale}px Arial`;
        ctx.fillText(`×${count}`, legendX + colorBoxSize + 10 * scale, y + colorBoxSize / 2 + 5 * scale);
      });
      
      // Total count
      const totalBeads = Array.from(finalColorCount.values()).reduce((a, b) => a + b, 0);
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.font = `bold ${14 * scale}px Arial`;
      ctx.fillText(`总计: ${totalBeads} 颗`, legendX, legendStartY + sortedColors.length * legendItemHeight + 20 * scale);

      // Build legend with counts
      const legend = sortedColors.map(([code, color]) => ({
        ...color,
        count: finalColorCount.get(code) || 0
      }));

      resolve({
        image: canvas.toDataURL('image/png'),
        legend
      });
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = subjectImageUrl;
  });
}

// Detect grid count using visual counting + grid line segment verification
// This method counts grid cells by analyzing the pattern of grid lines
function detectGridCountByVisualCounting(imageData: ImageData): {
  gridCountX: number;
  gridCountY: number;
  cellBoundaries: Array<{ row: number; col: number; x1: number; y1: number; x2: number; y2: number }>;
} {
  const { width, height, data } = imageData;
  
  // Step 1: Detect potential grid lines (rows/columns with dark pixels)
  const detectPotentialLines = (isHorizontal: boolean): number[] => {
    const lines: number[] = [];
    const length = isHorizontal ? height : width;
    const lineLength = isHorizontal ? width : height;
    
    for (let i = 0; i < length; i++) {
      let darkCount = 0;
      for (let j = 0; j < lineLength; j++) {
        const idx = isHorizontal 
          ? (i * width + j) * 4 
          : (j * width + i) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r + g + b) / 3;
        if (brightness < 60) darkCount++;
      }
      // If more than 60% dark, consider it a potential grid line
      if (darkCount / lineLength > 0.6) {
        lines.push(i);
      }
    }
    return lines;
  };
  
  // Step 2: Group consecutive line positions (grid lines can be multiple pixels thick)
  const groupConsecutiveLines = (lines: number[]): number[][] => {
    if (lines.length === 0) return [];
    const groups: number[][] = [];
    let currentGroup = [lines[0]];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i] - lines[i - 1] <= 3) {
        currentGroup.push(lines[i]);
      } else {
        groups.push(currentGroup);
        currentGroup = [lines[i]];
      }
    }
    groups.push(currentGroup);
    return groups;
  };
  
  // Step 3: Calculate representative position for each line group (center of the line)
  const getLinePositions = (groups: number[][]): number[] => {
    return groups.map(group => Math.round(group.reduce((a, b) => a + b, 0) / group.length));
  };
  
  // Step 4: Validate grid lines by checking spacing consistency
  const validateAndCountGrids = (linePositions: number[], totalLength: number): { 
    count: number; 
    validLines: number[] 
  } => {
    if (linePositions.length < 2) return { count: 0, validLines: linePositions };
    
    // Calculate spacings between consecutive lines
    const spacings: number[] = [];
    for (let i = 1; i < linePositions.length; i++) {
      spacings.push(linePositions[i] - linePositions[i - 1]);
    }
    
    // Find the most common spacing (mode)
    const spacingCounts = new Map<number, number>();
    spacings.forEach(s => {
      const rounded = Math.round(s);
      spacingCounts.set(rounded, (spacingCounts.get(rounded) || 0) + 1);
    });
    
    let maxCount = 0;
    let commonSpacing = 0;
    spacingCounts.forEach((count, spacing) => {
      if (count > maxCount) {
        maxCount = count;
        commonSpacing = spacing;
      }
    });
    
    // Allow 10% tolerance for spacing variations
    const tolerance = commonSpacing * 0.1;
    
    // Validate lines: keep lines that form consistent spacing
    const validLines: number[] = [linePositions[0]];
    for (let i = 1; i < linePositions.length; i++) {
      const spacing = linePositions[i] - validLines[validLines.length - 1];
      if (Math.abs(spacing - commonSpacing) <= tolerance || 
          Math.abs(spacing - commonSpacing * 2) <= tolerance) {
        // Accept if spacing matches or is close to double (skipped line)
        validLines.push(linePositions[i]);
      }
    }
    
    // Grid count = number of spaces between lines
    const gridCount = validLines.length > 1 ? validLines.length - 1 : 0;
    
    return { count: gridCount, validLines };
  };
  
  // Process horizontal and vertical lines
  const hPotentialLines = detectPotentialLines(true);
  const vPotentialLines = detectPotentialLines(false);
  
  const hGroups = groupConsecutiveLines(hPotentialLines);
  const vGroups = groupConsecutiveLines(vPotentialLines);
  
  const hLinePositions = getLinePositions(hGroups);
  const vLinePositions = getLinePositions(vGroups);
  
  const hResult = validateAndCountGrids(hLinePositions, height);
  const vResult = validateAndCountGrids(vLinePositions, width);
  
  const gridCountY = hResult.count || 1;
  const gridCountX = vResult.count || 1;
  
  // Step 5: Generate cell boundaries
  const cellBoundaries: Array<{ row: number; col: number; x1: number; y1: number; x2: number; y2: number }> = [];
  
  // If we have valid grid lines, use them to define cells
  if (hResult.validLines.length >= 2 && vResult.validLines.length >= 2) {
    const hLines = hResult.validLines;
    const vLines = vResult.validLines;
    
    for (let row = 0; row < gridCountY; row++) {
      for (let col = 0; col < gridCountX; col++) {
        const x1 = vLines[col] + 1;
        const y1 = hLines[row] + 1;
        const x2 = vLines[col + 1] - 1;
        const y2 = hLines[row + 1] - 1;
        
        if (x2 > x1 && y2 > y1) {
          cellBoundaries.push({ row, col, x1, y1, x2, y2 });
        }
      }
    }
  } else {
    // Fallback: divide image evenly
    const cellW = Math.floor(width / gridCountX);
    const cellH = Math.floor(height / gridCountY);
    
    for (let row = 0; row < gridCountY; row++) {
      for (let col = 0; col < gridCountX; col++) {
        cellBoundaries.push({
          row, col,
          x1: col * cellW,
          y1: row * cellH,
          x2: (col + 1) * cellW - 1,
          y2: (row + 1) * cellH - 1
        });
      }
    }
  }
  
  return { gridCountX, gridCountY, cellBoundaries };
}

// Detect grid lines positions (returns array of line positions)
// Process pixel art image and generate bead pattern
// Uses visual counting + grid line segment verification to detect grid count
// NO background removal, fills ALL cells with MARD colors
async function processPixelArt(
  imageUrl: string,
  _gridSize: number,  // Ignored - auto-detected from image
  scale: number = 3
): Promise<{ image: string; legend: Array<MardColor & { count: number }>; detectedGridSize: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
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
      
      // Use visual counting + grid line segment verification to detect grid count
      const gridInfo = detectGridCountByVisualCounting(srcImageData);
      
      const gridCountX = gridInfo.gridCountX;
      const gridCountY = gridInfo.gridCountY;
      const detectedGridSize = Math.max(gridCountX, gridCountY);
      
      // Use the cell boundaries from detection
      const cellBoundaries = gridInfo.cellBoundaries;
      
      // If no boundaries detected, create evenly divided cells
      if (cellBoundaries.length === 0) {
        const cellW = Math.floor(img.width / gridCountX);
        const cellH = Math.floor(img.height / gridCountY);
        
        for (let row = 0; row < gridCountY; row++) {
          for (let col = 0; col < gridCountX; col++) {
            cellBoundaries.push({
              row, col,
              x1: col * cellW,
              y1: row * cellH,
              x2: (col + 1) * cellW - 1,
              y2: (row + 1) * cellH - 1
            });
          }
        }
      }
      
      // Process ALL cells - NO background removal
      const cellColors = new Map<string, { avgR: number; avgG: number; avgB: number }>();
      
      // Process each cell boundary - fill ALL cells
      cellBoundaries.forEach((boundary) => {
        const { row, col, x1, y1, x2, y2 } = boundary;
        
        let totalR = 0, totalG = 0, totalB = 0;
        let pixelCount = 0;
        
        // Sample pixels from the cell area (excluding grid lines)
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const idx = (y * img.width + x) * 4;
            const r = srcData[idx];
            const g = srcData[idx + 1];
            const b = srcData[idx + 2];
            
            // Count all pixels, including dark ones (no skipping)
            totalR += r;
            totalG += g;
            totalB += b;
            pixelCount++;
          }
        }
        
        // Calculate average color for this cell
        if (pixelCount > 0) {
          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);
          
          const key = `${col},${row}`;
          cellColors.set(key, { avgR, avgG, avgB });
        }
      });
      
      // Match ALL colors to MARD
      const colorUsageCount = new Map<string, number>();
      const mardColorMap = new Map<string, MardColor>();
      
      for (const [key, color] of cellColors) {
        const mardColor = findClosestMardColor(color.avgR, color.avgG, color.avgB);
        mardColorMap.set(key, mardColor);
        const count = colorUsageCount.get(mardColor.code) || 0;
        colorUsageCount.set(mardColor.code, count + 1);
      }
      
      // Limit colors to max 20
      const MAX_COLORS = 20;
      let selectedColors: MardColor[];
      
      if (colorUsageCount.size <= MAX_COLORS) {
        selectedColors = Array.from(colorUsageCount.keys()).map(code => {
          const key = Array.from(mardColorMap.entries()).find(([_, v]) => v.code === code)![0];
          return mardColorMap.get(key)!;
        });
      } else {
        const sortedColors = Array.from(colorUsageCount.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_COLORS)
          .map(([code]) => {
            const key = Array.from(mardColorMap.entries()).find(([_, v]) => v.code === code)![0];
            return mardColorMap.get(key)!;
          });
        selectedColors = sortedColors;
      }
      
      const selectedColorCodes = new Set(selectedColors.map(c => c.code));
      
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      };
      
      // Create HD canvas
      const gridAreaSize = 800 * scale;
      const marginSize = 50 * scale;
      const legendWidth = 200 * scale;
      const gridTotalSize = gridAreaSize + marginSize * 2;
      const totalWidth = gridTotalSize + legendWidth;
      const totalHeight = gridTotalSize;
      const cellSize = gridAreaSize / detectedGridSize;
      
      const canvas = document.createElement('canvas');
      canvas.width = totalWidth;
      canvas.height = totalHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      // Fill with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, totalWidth, totalHeight);
      
      const offsetX = marginSize;
      const offsetY = marginSize;
      
      // Draw ALL cells with MARD colors
      const fontSize = Math.max(12, Math.floor(cellSize * 0.4));
      const drawnBlocks: Array<{
        x: number;
        y: number;
        color: MardColor;
        rgbR: number;
        rgbG: number;
        rgbB: number;
      }> = [];
      
      const finalColorCount = new Map<string, number>();
      const colorMap = new Map<string, MardColor>();
      
      // Process ALL cells
      for (const [key, srcColor] of cellColors) {
        const [gridX, gridY] = key.split(',').map(Number);
        const x = offsetX + gridX * cellSize;
        const y = offsetY + gridY * cellSize;
        
        let mardColor = mardColorMap.get(key)!;
        
        // If color not in selected colors, find closest
        if (!selectedColorCodes.has(mardColor.code)) {
          let minDist = Infinity;
          for (const color of selectedColors) {
            const rgb = hexToRgb(color.hex);
            const dist = Math.sqrt(
              Math.pow(srcColor.avgR - rgb.r, 2) +
              Math.pow(srcColor.avgG - rgb.g, 2) +
              Math.pow(srcColor.avgB - rgb.b, 2)
            );
            if (dist < minDist) {
              minDist = dist;
              mardColor = color;
            }
          }
        }
        
        const finalRgb = hexToRgb(mardColor.hex);
        
        ctx.fillStyle = mardColor.hex;
        ctx.fillRect(x, y, cellSize, cellSize);
        
        drawnBlocks.push({
          x, y,
          color: mardColor,
          rgbR: finalRgb.r,
          rgbG: finalRgb.g,
          rgbB: finalRgb.b
        });
        
        if (!colorMap.has(mardColor.code)) {
          colorMap.set(mardColor.code, mardColor);
        }
        
        const count = finalColorCount.get(mardColor.code) || 0;
        finalColorCount.set(mardColor.code, count + 1);
      }
      
      // Draw grid lines
      ctx.strokeStyle = '#cccccc';
      ctx.lineWidth = 1;
      
      for (let i = 0; i <= detectedGridSize; i++) {
        const pos = Math.floor(offsetX + i * cellSize);
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pos, offsetY);
        ctx.lineTo(pos, offsetY + gridAreaSize);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + i * cellSize);
        ctx.lineTo(offsetX + gridAreaSize, offsetY + i * cellSize);
        ctx.stroke();
      }
      
      // Draw row and column numbers
      ctx.fillStyle = '#666666';
      ctx.font = `bold ${12 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (let i = 0; i < detectedGridSize; i++) {
        // Row numbers (left side)
        const y = offsetY + (i + 0.5) * cellSize;
        ctx.fillText(String(detectedGridSize - i), marginSize / 2, y);
        
        // Column numbers (top)
        const x = offsetX + (i + 0.5) * cellSize;
        ctx.fillText(String(i + 1), x, marginSize / 2);
      }
      
      // Draw MARD color codes
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (const block of drawnBlocks) {
        const brightness = (block.rgbR * 299 + block.rgbG * 587 + block.rgbB * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
        ctx.font = `bold ${fontSize}px Arial`;
        ctx.fillText(block.color.code, block.x + cellSize / 2, block.y + cellSize / 2);
      }
      
      // Draw color legend
      const legendX = gridTotalSize + 20 * scale;
      const legendStartY = marginSize;
      const colorBoxSize = 30 * scale;
      const legendItemHeight = 40 * scale;
      
      ctx.fillStyle = '#333333';
      ctx.font = `bold ${16 * scale}px Arial`;
      ctx.textAlign = 'left';
      ctx.fillText('色号图例', legendX, legendStartY - 10 * scale);
      
      const sortedColors = Array.from(finalColorCount.entries())
        .sort((a, b) => b[1] - a[1]);
      
      sortedColors.forEach(([code, count], index) => {
        const y = legendStartY + index * legendItemHeight;
        const color = colorMap.get(code)!;
        const rgb = hexToRgb(color.hex);
        
        // Draw color box
        ctx.fillStyle = color.hex;
        ctx.fillRect(legendX, y, colorBoxSize, colorBoxSize);
        ctx.strokeStyle = '#cccccc';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, y, colorBoxSize, colorBoxSize);
        
        // Draw color code and count
        const textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? '#000000' : '#ffffff';
        ctx.fillStyle = textColor;
        ctx.textAlign = 'center';
        ctx.font = `bold ${12 * scale}px Arial`;
        ctx.fillText(code, legendX + colorBoxSize / 2, y + colorBoxSize / 2 + 4 * scale);
        
        // Draw count
        ctx.fillStyle = '#333333';
        ctx.textAlign = 'left';
        ctx.font = `${14 * scale}px Arial`;
        ctx.fillText(`×${count}`, legendX + colorBoxSize + 10 * scale, y + colorBoxSize / 2 + 5 * scale);
      });
      
      // Total count
      const totalBeads = Array.from(finalColorCount.values()).reduce((a, b) => a + b, 0);
      ctx.fillStyle = '#333333';
      ctx.textAlign = 'left';
      ctx.font = `bold ${14 * scale}px Arial`;
      ctx.fillText(`总计: ${totalBeads} 颗`, legendX, legendStartY + sortedColors.length * legendItemHeight + 20 * scale);
      
      const legend = sortedColors.map(([code, color]) => ({
        ...colorMap.get(code)!,
        count: finalColorCount.get(code) || 0
      }));
      
      resolve({
        image: canvas.toDataURL('image/png'),
        legend,
        detectedGridSize
      });
    };
    
    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}
