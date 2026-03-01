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
  ZoomIn,
  ZoomOut,
  Maximize2,
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

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [gridSize, setGridSize] = useState(25);
  const [useAnimeImage, setUseAnimeImage] = useState(false);
  const [isTransformingAnime, setIsTransformingAnime] = useState(false);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [isPixelating, setIsPixelating] = useState(false);
  const [beadPatternImage, setBeadPatternImage] = useState<string | null>(null);
  const [beadPatternLegend, setBeadPatternLegend] = useState<MardColor[]>([]);
  const [isGeneratingBeadPattern, setIsGeneratingBeadPattern] = useState(false);
  const [beadPatternZoom, setBeadPatternZoom] = useState(1);
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
        console.error('Failed to load model:', err);
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

  // Handle click on upload area
  const handleUploadClick = useCallback(() => {
    if ((step === 'idle' || step === 'done') && modelLoaded) {
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
  }, [step, modelLoaded]);

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
              multiSegment: false,
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
            
            resolve(removedBgDataUrl);
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
  }, [gridSize]);

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
        // Remove black background (set black pixels to transparent)
        const cleanedImage = await removeBlackBackground(data.imageUrl);
        
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
      const pixelated = await pixelateImage(sourceImage, gridSize);
      setPixelatedImage(pixelated);
    } catch (err) {
      console.error('Pixelate error:', err);
      setError(err instanceof Error ? err.message : '像素化处理失败');
    } finally {
      setIsPixelating(false);
    }
  }, [removedBgImage, animeImage, useAnimeImage, gridSize, isPixelating]);

  // Generate bead pattern from pixelated image
  const handleGenerateBeadPattern = useCallback(async () => {
    if (!pixelatedImage || isGeneratingBeadPattern) return;

    setIsGeneratingBeadPattern(true);
    setError(null);

    try {
      const result = await generateBeadPattern(pixelatedImage, gridSize);
      setBeadPatternImage(result.image);
      setBeadPatternLegend(result.legend);
    } catch (err) {
      console.error('Bead pattern error:', err);
      setError(err instanceof Error ? err.message : '拼豆图纸生成失败');
    } finally {
      setIsGeneratingBeadPattern(false);
    }
  }, [pixelatedImage, gridSize, isGeneratingBeadPattern]);

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
    if (!pixelatedImage) return;

    try {
      // Generate high-resolution bead pattern (3x scale for better readability)
      const result = await generateBeadPatternHD(pixelatedImage, gridSize, 3);
      
      const link = document.createElement('a');
      link.href = result.image;
      link.download = `bead-pattern-hd-${gridSize}x${gridSize}${animeImage ? '-anime' : ''}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('HD download error:', err);
      // Fallback to regular image
      if (beadPatternImage) {
        const link = document.createElement('a');
        link.href = beadPatternImage;
        link.download = `bead-pattern-${gridSize}x${gridSize}${animeImage ? '-anime' : ''}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }
  }, [pixelatedImage, gridSize, animeImage, beadPatternImage]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setRemovedBgImage(null);
    setAnimeImage(null);
    setFinalImage(null);
    setPixelatedImage(null);
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

  const canUpload = modelLoaded && (step === 'idle' || step === 'done');

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
            上传照片，AI 自动识别并抠出主体，转换为动漫风格，然后贴到空白网格纸上
          </p>
          {!modelLoaded && (
            <div className="mt-4 inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">AI 模型加载中...</span>
            </div>
          )}
          {modelLoaded && (
            <div className="mt-4 inline-flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">AI 模型已就绪</span>
            </div>
          )}
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
                <div className="flex items-center gap-2">
                  {/* Zoom Controls */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
                    <Button
                      onClick={() => setBeadPatternZoom(Math.max(0.5, beadPatternZoom - 0.25))}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={beadPatternZoom <= 0.5}
                    >
                      <ZoomOut className="w-4 h-4" />
                    </Button>
                    <span className="text-sm w-12 text-center">{Math.round(beadPatternZoom * 100)}%</span>
                    <Button
                      onClick={() => setBeadPatternZoom(Math.min(4, beadPatternZoom + 0.25))}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      disabled={beadPatternZoom >= 4}
                    >
                      <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => setBeadPatternZoom(1)}
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      title="重置缩放"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Button
                    onClick={handleDownloadBeadPattern}
                    size="sm"
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载高清图纸
                  </Button>
                </div>
              </div>

              <div 
                className="rounded-xl overflow-auto bg-slate-50 dark:bg-slate-900 p-4"
                style={{ maxHeight: '600px' }}
              >
                <div 
                  className="origin-top-left inline-block"
                  style={{ transform: `scale(${beadPatternZoom})`, transformOrigin: 'top left' }}
                >
                  <img
                    src={beadPatternImage}
                    alt="拼豆图纸"
                    className="max-w-none"
                    style={{ width: '800px' }}
                  />
                </div>
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

      // Step 2: Calculate image size (0.9 of grid size)
      const maxImageSize = gridSize * 0.9;
      let imgWidth = img.width;
      let imgHeight = img.height;
      
      if (imgWidth > imgHeight) {
        if (imgWidth > maxImageSize) {
          imgHeight = (imgHeight / imgWidth) * maxImageSize;
          imgWidth = maxImageSize;
        }
      } else {
        if (imgHeight > maxImageSize) {
          imgWidth = (imgWidth / imgHeight) * maxImageSize;
          imgHeight = maxImageSize;
        }
      }

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

async function pixelateImage(imageUrl: string, gridCount: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create a canvas for the original image
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
      
      // Get source image data
      const srcImageData = srcCtx.getImageData(0, 0, imgWidth, imgHeight);
      const srcData = srcImageData.data;

      // Create result canvas with same size as grid (800x800)
      const gridSize = 800;
      const cellSize = gridSize / gridCount;
      
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

      // Calculate image size and position, align to grid lines
      const maxImageSize = gridSize * 0.9;
      let scaledWidth = imgWidth;
      let scaledHeight = imgHeight;
      
      if (scaledWidth > scaledHeight) {
        if (scaledWidth > maxImageSize) {
          scaledHeight = (scaledHeight / scaledWidth) * maxImageSize;
          scaledWidth = maxImageSize;
        }
      } else {
        if (scaledHeight > maxImageSize) {
          scaledWidth = (scaledWidth / scaledHeight) * maxImageSize;
          scaledHeight = maxImageSize;
        }
      }

      // Align size to grid cells
      const alignedWidth = Math.round(scaledWidth / cellSize) * cellSize;
      const alignedHeight = Math.round(scaledHeight / cellSize) * cellSize;
      
      // Align position to grid lines (centered)
      const offsetX = Math.round((gridSize - alignedWidth) / 2 / cellSize) * cellSize;
      const offsetY = Math.round((gridSize - alignedHeight) / 2 / cellSize) * cellSize;

      // Calculate pixel size based on grid
      const actualPixelSize = cellSize;

      // Calculate grid cell counts for subject
      const cellCountX = Math.round(alignedWidth / cellSize);
      const cellCountY = Math.round(alignedHeight / cellSize);

      // Pixelate only the subject area (skip transparent regions)
      for (let gridY = 0; gridY < cellCountY; gridY++) {
        for (let gridX = 0; gridX < cellCountX; gridX++) {
          const canvasX = offsetX + gridX * actualPixelSize;
          const canvasY = offsetY + gridY * actualPixelSize;
          
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
            
            // Only draw pixel block if it's part of the subject (not transparent)
            // Skip transparent pixels (avgA threshold: 25)
            if (avgA > 25) {
              resultCtx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
              resultCtx.fillRect(
                Math.floor(offsetX + gridX * actualPixelSize),
                Math.floor(offsetY + gridY * actualPixelSize),
                Math.ceil(actualPixelSize),
                Math.ceil(actualPixelSize)
              );
            }
            // Transparent cells remain white (already filled as background)
          }
        }
      }

      // Draw grid lines on top (same style as grid result)
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
        
        const majorInterval = 5;
        for (let i = 0; i <= gridCount; i += majorInterval) {
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

      resolve(resultCanvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}

async function removeBlackBackground(imageUrl: string): Promise<string> {
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

      // Remove black/near-black pixels (make them transparent)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check if pixel is black or near-black (threshold: 30)
        if (r < 30 && g < 30 && b < 30) {
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
      
      // Draw the original pixelated image (keep it as is)
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

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

      // Process each pixel block - just get colors and find MARD codes
      for (let gridY = 0; gridY < gridSize; gridY++) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
          // Calculate pixel block boundaries
          const x1 = Math.floor(gridX * pixelSize);
          const y1 = Math.floor(gridY * pixelSize);
          const x2 = Math.min(Math.floor((gridX + 1) * pixelSize), canvas.width);
          const y2 = Math.min(Math.floor((gridY + 1) * pixelSize), canvas.height);

          // Calculate average color for this block
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;

          for (let y = y1; y < y2; y++) {
            for (let x = x1; x < x2; x++) {
              const idx = (y * canvas.width + x) * 4;
              totalR += data[idx];
              totalG += data[idx + 1];
              totalB += data[idx + 2];
              totalA += data[idx + 3];
              pixelCount++;
            }
          }

          if (pixelCount > 0 && totalA / pixelCount > 25) { // Skip transparent pixels
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);

            // Find nearest MARD color
            const nearestColor = findClosestMardColor(avgR, avgG, avgB);
            
            // Track color for legend
            if (!colorMap.has(nearestColor.code)) {
              colorMap.set(nearestColor.code, nearestColor);
            }

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
        }
      }

      // Draw MARD color codes on each block
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
async function generateBeadPatternHD(
  imageUrl: string,
  gridSize: number,
  scale: number = 3
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

      // Create HD canvas (scaled up for better text readability)
      const baseSize = 800;
      const hdSize = baseSize * scale;
      const pixelSize = hdSize / gridSize;
      
      canvas.width = hdSize;
      canvas.height = hdSize;
      
      // Fill white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, hdSize, hdSize);

      // Get source image data
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
      
      // Color tracking for legend
      const colorMap = new Map<string, MardColor>();

      // Calculate font size based on pixel size - larger for HD
      const fontSize = Math.max(12, Math.floor(pixelSize * 0.4));
      
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

      // Process each pixel block
      for (let gridY = 0; gridY < gridSize; gridY++) {
        for (let gridX = 0; gridX < gridSize; gridX++) {
          // Calculate pixel block boundaries in HD canvas
          const x1 = Math.floor(gridX * pixelSize);
          const y1 = Math.floor(gridY * pixelSize);
          const x2 = Math.floor((gridX + 1) * pixelSize);
          const y2 = Math.floor((gridY + 1) * pixelSize);

          // Calculate corresponding source region
          const srcX1 = Math.floor(gridX / gridSize * img.width);
          const srcY1 = Math.floor(gridY / gridSize * img.height);
          const srcX2 = Math.floor((gridX + 1) / gridSize * img.width);
          const srcY2 = Math.floor((gridY + 1) / gridSize * img.height);

          // Calculate average color from source region
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;

          for (let sy = srcY1; sy < srcY2; sy++) {
            for (let sx = srcX1; sx < srcX2; sx++) {
              const idx = (sy * img.width + sx) * 4;
              totalR += srcData[idx];
              totalG += srcData[idx + 1];
              totalB += srcData[idx + 2];
              totalA += srcData[idx + 3];
              pixelCount++;
            }
          }

          if (pixelCount > 0 && totalA / pixelCount > 25) {
            const avgR = Math.round(totalR / pixelCount);
            const avgG = Math.round(totalG / pixelCount);
            const avgB = Math.round(totalB / pixelCount);

            // Find nearest MARD color
            const nearestColor = findClosestMardColor(avgR, avgG, avgB);
            
            // Track color for legend
            if (!colorMap.has(nearestColor.code)) {
              colorMap.set(nearestColor.code, nearestColor);
            }

            // Fill the block with original average color
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
        }
      }

      // Draw MARD color codes on each block
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      for (const block of blocksInfo) {
        const brightness = (block.avgR * 299 + block.avgG * 587 + block.avgB * 114) / 1000;
        ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
        
        ctx.font = `bold ${fontSize}px Arial`;
        const centerX = block.x + block.width / 2;
        const centerY = block.y + block.height / 2;
        ctx.fillText(block.color.code, centerX, centerY);
      }

      // Draw grid lines on top
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = scale;

      for (let i = 0; i <= gridSize; i++) {
        const pos = Math.floor(i * pixelSize);
        
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, hdSize);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(hdSize, pos);
        ctx.stroke();
      }

      // Draw thicker lines every 5 cells for easier counting
      if (gridSize >= 10) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = scale * 2;
        
        for (let i = 0; i <= gridSize; i += 5) {
          const pos = Math.floor(i * pixelSize);
          
          ctx.beginPath();
          ctx.moveTo(pos, 0);
          ctx.lineTo(pos, hdSize);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.moveTo(0, pos);
          ctx.lineTo(hdSize, pos);
          ctx.stroke();
        }
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
