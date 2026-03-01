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
  Palette,
} from 'lucide-react';

// Mard拼豆颜色库
const MARD_COLORS = [
  { id: '01', name: '白色', hex: '#FFFFFF', rgb: [255, 255, 255] },
  { id: '02', name: '奶油色', hex: '#FFF8DC', rgb: [255, 248, 220] },
  { id: '03', name: '黄色', hex: '#FFD700', rgb: [255, 215, 0] },
  { id: '04', name: '橙色', hex: '#FF8C00', rgb: [255, 140, 0] },
  { id: '05', name: '红色', hex: '#DC143C', rgb: [220, 20, 60] },
  { id: '06', name: '深红', hex: '#8B0000', rgb: [139, 0, 0] },
  { id: '07', name: '粉色', hex: '#FFB6C1', rgb: [255, 182, 193] },
  { id: '08', name: '浅粉', hex: '#FFC0CB', rgb: [255, 192, 203] },
  { id: '09', name: '紫色', hex: '#9370DB', rgb: [147, 112, 219] },
  { id: '10', name: '深紫', hex: '#4B0082', rgb: [75, 0, 130] },
  { id: '11', name: '蓝色', hex: '#4169E1', rgb: [65, 105, 225] },
  { id: '12', name: '深蓝', hex: '#00008B', rgb: [0, 0, 139] },
  { id: '13', name: '浅蓝', hex: '#87CEEB', rgb: [135, 206, 235] },
  { id: '14', name: '天蓝', hex: '#00BFFF', rgb: [0, 191, 255] },
  { id: '15', name: '青色', hex: '#00CED1', rgb: [0, 206, 209] },
  { id: '16', name: '绿色', hex: '#228B22', rgb: [34, 139, 34] },
  { id: '17', name: '深绿', hex: '#006400', rgb: [0, 100, 0] },
  { id: '18', name: '浅绿', hex: '#90EE90', rgb: [144, 238, 144] },
  { id: '19', name: '黄绿', hex: '#9ACD32', rgb: [154, 205, 50] },
  { id: '20', name: '棕色', hex: '#8B4513', rgb: [139, 69, 19] },
  { id: '21', name: '深棕', hex: '#654321', rgb: [101, 67, 33] },
  { id: '22', name: '浅棕', hex: '#D2691E', rgb: [210, 105, 30] },
  { id: '23', name: '肤色', hex: '#FFDAB9', rgb: [255, 218, 185] },
  { id: '24', name: '米色', hex: '#F5DEB3', rgb: [245, 222, 179] },
  { id: '25', name: '灰色', hex: '#808080', rgb: [128, 128, 128] },
  { id: '26', name: '深灰', hex: '#404040', rgb: [64, 64, 64] },
  { id: '27', name: '浅灰', hex: '#C0C0C0', rgb: [192, 192, 192] },
  { id: '28', name: '黑色', hex: '#000000', rgb: [0, 0, 0] },
  { id: '29', name: '金色', hex: '#FFD700', rgb: [255, 215, 0] },
  { id: '30', name: '银色', hex: '#C0C0C0', rgb: [192, 192, 192] },
];

// 找到最接近的拼豆颜色
function findClosestMardColor(r: number, g: number, b: number): typeof MARD_COLORS[0] {
  let minDistance = Infinity;
  let closestColor = MARD_COLORS[0];

  for (const color of MARD_COLORS) {
    const distance = Math.sqrt(
      Math.pow(r - color.rgb[0], 2) +
      Math.pow(g - color.rgb[1], 2) +
      Math.pow(b - color.rgb[2], 2)
    );
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return closestColor;
}

type ProcessingStep = 'idle' | 'uploading' | 'loading-model' | 'removing-bg' | 'transforming-anime' | 'generating-grid' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: '准备就绪',
  uploading: '正在上传图片...',
  'loading-model': '正在加载模型...',
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
  const [perlerPattern, setPerlerPattern] = useState<{ image: string; legend: string } | null>(null);
  const [isGeneratingPerler, setIsGeneratingPerler] = useState(false);
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
    const sourceImage = animeImage || removedBgImage;
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
  }, [removedBgImage, animeImage, gridSize, isPixelating]);

  // Generate perler bead pattern
  const handleGeneratePerler = useCallback(async () => {
    const sourceImage = animeImage || removedBgImage;
    if (!sourceImage || isGeneratingPerler) return;

    setIsGeneratingPerler(true);
    setError(null);

    try {
      const pattern = await generatePerlerPattern(sourceImage, gridSize);
      setPerlerPattern(pattern);
    } catch (err) {
      console.error('Perler pattern error:', err);
      setError(err instanceof Error ? err.message : '拼豆图纸生成失败');
    } finally {
      setIsGeneratingPerler(false);
    }
  }, [removedBgImage, animeImage, gridSize, isGeneratingPerler]);

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

  const handleDownloadPerler = useCallback(() => {
    if (!perlerPattern) return;

    // Download pattern image
    const link = document.createElement('a');
    link.href = perlerPattern.image;
    link.download = `perler-pattern-${gridSize}x${gridSize}${animeImage ? '-anime' : ''}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [perlerPattern, gridSize, animeImage]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setRemovedBgImage(null);
    setAnimeImage(null);
    setFinalImage(null);
    setPixelatedImage(null);
    setPerlerPattern(null);
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
              智能抠图工具
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            上传照片，自动识别并抠出主体，转换为动漫风格，然后贴到空白网格纸上
          </p>
          {!modelLoaded && (
            <div className="mt-4 inline-flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">模型加载中...</span>
            </div>
          )}
          {modelLoaded && (
            <div className="mt-4 inline-flex items-center gap-2 text-green-600 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">模型已就绪</span>
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

                  {/* Perler Bead Pattern Button */}
                  <Button
                    onClick={handleGeneratePerler}
                    disabled={isGeneratingPerler || (!removedBgImage && !animeImage)}
                    variant="outline"
                    className="w-full border-pink-300 text-pink-600 hover:bg-pink-50 dark:border-pink-700 dark:text-pink-400 dark:hover:bg-pink-950/20"
                  >
                    {isGeneratingPerler ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        正在生成拼豆图纸...
                      </>
                    ) : perlerPattern ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新生成拼豆图纸
                      </>
                    ) : (
                      <>
                        <Palette className="w-4 h-4 mr-2" />
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

        {/* Perler Bead Pattern Section */}
        {perlerPattern && (
          <Card className="mt-6 overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Palette className="w-5 h-5 text-pink-600" />
                  拼豆图纸
                  <span className="text-sm font-normal text-slate-500 ml-2">
                    ({gridSize}×{gridSize} 像素{animeImage ? ', 动漫风格' : ''})
                  </span>
                </h2>
                <Button
                  onClick={handleDownloadPerler}
                  size="sm"
                  className="bg-pink-600 hover:bg-pink-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  下载拼豆图纸
                </Button>
              </div>

              <div className="space-y-4">
                {/* Pattern Image */}
                <div className="aspect-square bg-white rounded-xl overflow-hidden flex items-center justify-center border border-slate-200">
                  <img
                    src={perlerPattern.image}
                    alt="拼豆图纸"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
                
                {/* Color Legend */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">色号图例</h3>
                  <div 
                    className="flex flex-wrap gap-2"
                    dangerouslySetInnerHTML={{ __html: perlerPattern.legend }}
                  />
                </div>
              </div>
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
                <p className="font-medium">智能抠图</p>
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
            <strong>提示：</strong>图像将居中显示在网格纸上，大小为网格纸的 90%。动漫风格转换可能需要几秒钟时间。
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
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        reject(new Error('无法创建画布'));
        return;
      }

      const imgWidth = img.width;
      const imgHeight = img.height;
      
      tempCanvas.width = imgWidth;
      tempCanvas.height = imgHeight;
      tempCtx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      // Get image data
      const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
      const data = imageData.data;

      // Create a canvas for the pixelated image (same size as original)
      const pixelCanvas = document.createElement('canvas');
      const pixelCtx = pixelCanvas.getContext('2d');
      
      if (!pixelCtx) {
        reject(new Error('无法创建像素画布'));
        return;
      }

      pixelCanvas.width = imgWidth;
      pixelCanvas.height = imgHeight;

      // Calculate pixel size based on image dimensions and grid count
      const smallerDimension = Math.min(imgWidth, imgHeight);
      const pixelSize = Math.floor(smallerDimension / gridCount);

      // Pixelate: iterate through each "pixel" block
      for (let y = 0; y < imgHeight; y += pixelSize) {
        for (let x = 0; x < imgWidth; x += pixelSize) {
          // Calculate the average color for this pixel block
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;
          
          const blockWidth = Math.min(pixelSize, imgWidth - x);
          const blockHeight = Math.min(pixelSize, imgHeight - y);

          for (let by = 0; by < blockHeight; by++) {
            for (let bx = 0; bx < blockWidth; bx++) {
              const idx = ((y + by) * imgWidth + (x + bx)) * 4;
              totalR += data[idx];
              totalG += data[idx + 1];
              totalB += data[idx + 2];
              totalA += data[idx + 3];
              pixelCount++;
            }
          }

          // Calculate average
          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);
          const avgA = Math.round(totalA / pixelCount);

          // Only draw if not fully transparent
          if (avgA > 0) {
            pixelCtx.fillStyle = `rgb(${avgR}, ${avgG}, ${avgB})`;
            pixelCtx.fillRect(x, y, blockWidth, blockHeight);
          }
        }
      }

      // Create the final grid canvas (800x800)
      const gridCanvas = document.createElement('canvas');
      const gridCtx = gridCanvas.getContext('2d');
      
      if (!gridCtx) {
        reject(new Error('无法创建网格画布'));
        return;
      }

      const gridSize = 800;
      gridCanvas.width = gridSize;
      gridCanvas.height = gridSize;

      // Draw white background
      gridCtx.fillStyle = '#ffffff';
      gridCtx.fillRect(0, 0, gridSize, gridSize);

      // Calculate image size (0.9 of grid size)
      const maxImageSize = gridSize * 0.9;
      let finalImgWidth = pixelCanvas.width;
      let finalImgHeight = pixelCanvas.height;
      
      if (finalImgWidth > finalImgHeight) {
        if (finalImgWidth > maxImageSize) {
          finalImgHeight = (finalImgHeight / finalImgWidth) * maxImageSize;
          finalImgWidth = maxImageSize;
        }
      } else {
        if (finalImgHeight > maxImageSize) {
          finalImgWidth = (finalImgWidth / finalImgHeight) * maxImageSize;
          finalImgHeight = maxImageSize;
        }
      }

      // Center the image
      const x = (gridSize - finalImgWidth) / 2;
      const y = (gridSize - finalImgHeight) / 2;
      
      // Draw the pixelated image
      gridCtx.drawImage(pixelCanvas, x, y, finalImgWidth, finalImgHeight);

      // Draw grid lines on top
      const cellSize = gridSize / gridCount;
      
      gridCtx.strokeStyle = '#d1d5db';
      gridCtx.lineWidth = 1;

      for (let i = 0; i <= gridCount; i++) {
        const pos = i * cellSize;
        
        gridCtx.beginPath();
        gridCtx.moveTo(pos, 0);
        gridCtx.lineTo(pos, gridSize);
        gridCtx.stroke();
        
        gridCtx.beginPath();
        gridCtx.moveTo(0, pos);
        gridCtx.lineTo(gridSize, pos);
        gridCtx.stroke();
      }

      // Draw thicker lines every 5 cells
      if (gridCount >= 10) {
        gridCtx.strokeStyle = '#9ca3af';
        gridCtx.lineWidth = 2;
        
        const majorInterval = 5;
        for (let i = 0; i <= gridCount; i += majorInterval) {
          const pos = i * cellSize;
          
          gridCtx.beginPath();
          gridCtx.moveTo(pos, 0);
          gridCtx.lineTo(pos, gridSize);
          gridCtx.stroke();
          
          gridCtx.beginPath();
          gridCtx.moveTo(0, pos);
          gridCtx.lineTo(gridSize, pos);
          gridCtx.stroke();
        }
      }

      resolve(gridCanvas.toDataURL('image/png'));
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

async function generatePerlerPattern(imageUrl: string, gridCount: number): Promise<{ image: string; legend: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create canvas for original image
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        reject(new Error('无法创建画布'));
        return;
      }

      const imgWidth = img.width;
      const imgHeight = img.height;
      
      tempCanvas.width = imgWidth;
      tempCanvas.height = imgHeight;
      tempCtx.drawImage(img, 0, 0, imgWidth, imgHeight);
      
      const imageData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);
      const data = imageData.data;

      // Calculate pixel size based on image dimensions
      const smallerDimension = Math.min(imgWidth, imgHeight);
      const pixelSize = Math.floor(smallerDimension / gridCount);

      // Create pixel data array with Mard colors
      const pixelData: { color: typeof MARD_COLORS[0]; x: number; y: number }[][] = [];
      const usedColors = new Map<string, typeof MARD_COLORS[0]>();

      for (let y = 0; y < imgHeight; y += pixelSize) {
        const row: { color: typeof MARD_COLORS[0]; x: number; y: number }[] = [];
        for (let x = 0; x < imgWidth; x += pixelSize) {
          // Calculate average color for this pixel block
          let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
          let pixelCount = 0;
          
          const blockWidth = Math.min(pixelSize, imgWidth - x);
          const blockHeight = Math.min(pixelSize, imgHeight - y);

          for (let by = 0; by < blockHeight; by++) {
            for (let bx = 0; bx < blockWidth; bx++) {
              const idx = ((y + by) * imgWidth + (x + bx)) * 4;
              totalR += data[idx];
              totalG += data[idx + 1];
              totalB += data[idx + 2];
              totalA += data[idx + 3];
              pixelCount++;
            }
          }

          const avgR = Math.round(totalR / pixelCount);
          const avgG = Math.round(totalG / pixelCount);
          const avgB = Math.round(totalB / pixelCount);
          const avgA = Math.round(totalA / pixelCount);

          // Find closest Mard color or use white for transparent
          let mardColor: typeof MARD_COLORS[0];
          if (avgA < 128) {
            mardColor = MARD_COLORS[0]; // White for transparent
          } else {
            mardColor = findClosestMardColor(avgR, avgG, avgB);
            usedColors.set(mardColor.id, mardColor);
          }
          
          row.push({ color: mardColor, x, y });
        }
        pixelData.push(row);
      }

      // Create the grid canvas (800x800)
      const gridSize = 800;
      const gridCanvas = document.createElement('canvas');
      const gridCtx = gridCanvas.getContext('2d');
      
      if (!gridCtx) {
        reject(new Error('无法创建网格画布'));
        return;
      }

      gridCanvas.width = gridSize;
      gridCanvas.height = gridSize;

      // Draw white background
      gridCtx.fillStyle = '#ffffff';
      gridCtx.fillRect(0, 0, gridSize, gridSize);

      // Calculate cell size and image size (0.9 of grid size)
      const cellSize = gridSize / gridCount;
      const maxImageSize = gridSize * 0.9;
      const scaledPixelSize = (maxImageSize / gridCount);
      
      // Calculate offset to center the image
      const offsetX = (gridSize - maxImageSize) / 2;
      const offsetY = (gridSize - maxImageSize) / 2;

      // Draw each pixel cell with Mard color and color ID
      gridCtx.font = `${Math.max(8, Math.floor(cellSize / 3))}px Arial`;
      gridCtx.textAlign = 'center';
      gridCtx.textBaseline = 'middle';

      const rows = pixelData.length;
      const cols = pixelData[0]?.length || 0;

      for (let row = 0; row < rows && row < gridCount; row++) {
        for (let col = 0; col < cols && col < gridCount; col++) {
          const pixel = pixelData[row][col];
          const x = offsetX + col * scaledPixelSize;
          const y = offsetY + row * scaledPixelSize;
          
          // Fill cell with color
          gridCtx.fillStyle = pixel.color.hex;
          gridCtx.fillRect(x, y, scaledPixelSize, scaledPixelSize);
          
          // Draw color ID text (only if not white)
          if (pixel.color.id !== '01') {
            // Determine text color based on background brightness
            const brightness = (pixel.color.rgb[0] * 299 + pixel.color.rgb[1] * 587 + pixel.color.rgb[2] * 114) / 1000;
            gridCtx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
            gridCtx.fillText(pixel.color.id, x + scaledPixelSize / 2, y + scaledPixelSize / 2);
          }
        }
      }

      // Draw grid lines
      gridCtx.strokeStyle = '#d1d5db';
      gridCtx.lineWidth = 1;

      for (let i = 0; i <= gridCount; i++) {
        const posX = offsetX + i * scaledPixelSize;
        const posY = offsetY + i * scaledPixelSize;
        
        gridCtx.beginPath();
        gridCtx.moveTo(posX, offsetY);
        gridCtx.lineTo(posX, offsetY + maxImageSize);
        gridCtx.stroke();
        
        gridCtx.beginPath();
        gridCtx.moveTo(offsetX, posY);
        gridCtx.lineTo(offsetX + maxImageSize, posY);
        gridCtx.stroke();
      }

      // Generate legend HTML
      const sortedColors = Array.from(usedColors.values()).sort((a, b) => a.id.localeCompare(b.id));
      const legendHtml = sortedColors.map(color => `
        <div class="flex items-center gap-1 px-2 py-1 bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
          <div class="w-4 h-4 rounded" style="background-color: ${color.hex}; border: 1px solid #ccc;"></div>
          <span class="text-xs font-medium">${color.id}</span>
          <span class="text-xs text-slate-500">${color.name}</span>
        </div>
      `).join('');

      resolve({ 
        image: gridCanvas.toDataURL('image/png'),
        legend: legendHtml
      });
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = imageUrl;
  });
}
