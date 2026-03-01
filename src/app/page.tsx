'use client';

import { useCallback, useRef, useState } from 'react';
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
} from 'lucide-react';

type ProcessingStep = 'idle' | 'uploading' | 'removing-bg' | 'generating-grid' | 'composing' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: '准备就绪',
  uploading: '正在上传图片...',
  'removing-bg': '正在抠图（首次加载模型需要较长时间）...',
  'generating-grid': '正在生成网格纸...',
  composing: '正在合成图片...',
  done: '处理完成',
};

export default function Home() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setProgress(0);
    setFinalImage(null);

    try {
      // Step 1: Read file
      setStep('uploading');
      setProgress(10);
      const imageDataUrl = await readFileAsDataURL(file);
      setOriginalImage(imageDataUrl);

      // Step 2: Remove background (dynamic import for client-side only)
      setStep('removing-bg');
      setProgress(20);

      // Dynamically import the library to ensure it's only loaded on the client
      // The library uses default export
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bgRemovalModule = await import('@imgly/background-removal') as any;
      const removeBackgroundFn = bgRemovalModule.default;

      const blob = await removeBackgroundFn(file, {
        progress: (key: string, current: number, total: number) => {
          if (total > 0) {
            const percent = Math.round((current / total) * 60) + 20;
            setProgress(Math.min(percent, 80));
          }
        },
      });

      const removedBgUrl = URL.createObjectURL(blob);
      setRemovedBgImage(removedBgUrl);
      setProgress(85);

      // Step 3: Generate grid and compose
      setStep('generating-grid');
      setProgress(90);

      await new Promise((resolve) => setTimeout(resolve, 100));
      const composedImage = await composeWithGrid(removedBgUrl);
      setFinalImage(composedImage);

      // Step 4: Done
      setStep('composing');
      setProgress(95);
      await new Promise((resolve) => setTimeout(resolve, 200));

      setStep('done');
      setProgress(100);
    } catch (err) {
      console.error('Processing error:', err);
      setError(err instanceof Error ? err.message : '处理图片时发生错误');
      setStep('idle');
      setProgress(0);
    }
  }, []);

  const handleDownload = useCallback(() => {
    if (!finalImage) return;

    const link = document.createElement('a');
    link.href = finalImage;
    link.download = 'subject-on-grid.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [finalImage]);

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
        </div>

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
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                  ${step === 'idle' ? 'border-slate-300 dark:border-slate-700 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800'}
                `}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  disabled={step !== 'idle'}
                />

                {originalImage ? (
                  <div className="space-y-4">
                    <img
                      src={originalImage}
                      alt="原图"
                      className="max-h-64 mx-auto rounded-lg shadow-md"
                    />
                    <p className="text-sm text-slate-500">点击重新上传</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center">
                      <ImageIcon className="w-8 h-8 text-slate-400" />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      点击或拖拽图片到此处
                    </p>
                    <p className="text-sm text-slate-400">
                      支持 JPG、PNG、WebP 格式
                    </p>
                  </div>
                )}
              </div>

              {/* Progress */}
              {step !== 'idle' && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      {step === 'done' ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      )}
                      {STEP_LABELS[step]}
                    </span>
                    <span className="text-slate-500">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
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
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">1</span>
              </div>
              <div>
                <p className="font-medium">上传图片</p>
                <p className="text-sm text-slate-500">选择包含主体的照片</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">2</span>
              </div>
              <div>
                <p className="font-medium">AI 自动抠图</p>
                <p className="text-sm text-slate-500">智能识别并移除背景</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">3</span>
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
            <strong>提示：</strong>首次使用时，AI 模型需要下载到浏览器中（约 30-50MB），请耐心等待。之后再次使用会快很多。
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

async function composeWithGrid(removedBgUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Create canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }

      // Set canvas size (use image size or max 800px)
      const maxSize = 800;
      let width = img.width;
      let height = img.height;
      
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = (height / width) * maxSize;
          width = maxSize;
        } else {
          width = (width / height) * maxSize;
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;

      // Draw grid background
      const gridSize = 20;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Draw grid lines
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw thicker lines every 100px
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      const majorGridSize = 100;

      // Major vertical lines
      for (let x = 0; x <= width; x += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Major horizontal lines
      for (let y = 0; y <= height; y += majorGridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw the subject image (centered)
      const imgWidth = img.width;
      const imgHeight = img.height;
      const x = (width - imgWidth) / 2;
      const y = (height - imgHeight) / 2;
      
      ctx.drawImage(img, x, y, imgWidth, imgHeight);

      // Convert to data URL
      resolve(canvas.toDataURL('image/png'));
    };

    img.onerror = () => reject(new Error('无法加载图片'));
    img.src = removedBgUrl;
  });
}
