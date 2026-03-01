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
} from 'lucide-react';

type ProcessingStep = 'idle' | 'uploading' | 'loading-model' | 'removing-bg' | 'generating-grid' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: '准备就绪',
  uploading: '正在上传图片...',
  'loading-model': '正在加载 AI 模型...',
  'removing-bg': '正在抠图...',
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
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);
  const [gridSize, setGridSize] = useState(25); // Default 25x25
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
        setFinalImage(null);
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

      // Use the selected grid size
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

  // Regenerate with new grid size
  const handleGridSizeChange = useCallback(async (newGridSize: number) => {
    setGridSize(newGridSize);
    
    if (removedBgImage && (step === 'done' || step === 'generating-grid')) {
      setStep('generating-grid');
      setProgress(90);
      
      try {
        const composedImage = await composeWithGrid(removedBgImage, newGridSize);
        setFinalImage(composedImage);
        setStep('done');
        setProgress(100);
      } catch (err) {
        console.error('Failed to regenerate:', err);
      }
    }
  }, [removedBgImage, step]);

  const handleDownload = useCallback(() => {
    if (!finalImage) return;

    const link = document.createElement('a');
    link.href = finalImage;
    link.download = `subject-on-grid-${gridSize}x${gridSize}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [finalImage, gridSize]);

  const handleReset = useCallback(() => {
    setOriginalImage(null);
    setRemovedBgImage(null);
    setFinalImage(null);
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
            上传照片，AI 自动识别并抠出主体，然后贴到空白网格纸上
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
                  <span className="text-sm">处理完成 - {gridSize}×{gridSize} 网格纸</span>
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
                <div className="mt-6 flex gap-3">
                  <Button
                    onClick={handleDownload}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    下载结果
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleReset}
                  >
                    重新开始
                  </Button>
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
                    ({gridSize}×{gridSize} 网格)
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

              {/* Intermediate Results */}
              {removedBgImage && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                    抠图预览（透明背景）
                  </h3>
                  <div 
                    className="h-32 rounded-lg overflow-hidden"
                    style={{
                      backgroundImage: `
                        linear-gradient(45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(-45deg, #e5e7eb 25%, transparent 25%),
                        linear-gradient(45deg, transparent 75%, #e5e7eb 75%),
                        linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)
                      `,
                      backgroundSize: '20px 20px',
                      backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                      backgroundColor: '#fff',
                    }}
                  >
                    <img
                      src={removedBgImage}
                      alt="抠图结果"
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Instructions */}
        <div className="mt-8 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">使用说明</h3>
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium">选择网格规格</p>
                <p className="text-sm text-slate-500">选择需要的网格纸大小</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium">上传图片</p>
                <p className="text-sm text-slate-500">选择包含人物的照片</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">3</span>
              </div>
              <div>
                <p className="font-medium">AI 自动抠图</p>
                <p className="text-sm text-slate-500">智能识别并移除背景</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">4</span>
              </div>
              <div>
                <p className="font-medium">下载结果</p>
                <p className="text-sm text-slate-500">获取带网格纸背景的图片</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <strong>提示：</strong>图像将居中显示在网格纸上，大小为网格纸的 90%。您可以随时切换网格规格，已抠图的图像会自动重新合成。
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

async function composeWithGrid(removedBgUrl: string, gridCount: number): Promise<string> {
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

      // Calculate canvas size based on grid count
      // Each grid cell is the same size, total grid is gridSize x gridSize pixels
      const gridSize = 800; // Fixed canvas size in pixels
      const cellSize = gridSize / gridCount;

      const width = gridSize;
      const height = gridSize;

      canvas.width = width;
      canvas.height = height;

      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;

      // Draw all grid lines
      for (let i = 0; i <= gridCount; i++) {
        const pos = i * cellSize;
        
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, height);
        ctx.stroke();
        
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(width, pos);
        ctx.stroke();
      }

      // Draw thicker lines every 5 cells (if grid is large enough)
      if (gridCount >= 10) {
        ctx.strokeStyle = '#9ca3af';
        ctx.lineWidth = 2;
        
        const majorInterval = 5;
        for (let i = 0; i <= gridCount; i += majorInterval) {
          const pos = i * cellSize;
          
          // Vertical line
          ctx.beginPath();
          ctx.moveTo(pos, 0);
          ctx.lineTo(pos, height);
          ctx.stroke();
          
          // Horizontal line
          ctx.beginPath();
          ctx.moveTo(0, pos);
          ctx.lineTo(width, pos);
          ctx.stroke();
        }
      }

      // Calculate image size (0.9 of grid size, maintaining aspect ratio)
      const maxImageSize = gridSize * 0.9;
      let imgWidth = img.width;
      let imgHeight = img.height;
      
      // Scale image to fit within 0.9 of grid size
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
      
      ctx.drawImage(img, x, y, imgWidth, imgHeight);

      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = removedBgUrl;
  });
}
