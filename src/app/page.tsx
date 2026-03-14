'use client';

import { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Key,
  LogOut,
  ZoomIn,
} from 'lucide-react';
import { findClosestMardColor, MardColor, ColorMatchAccuracy } from '@/lib/mardColors';

type ProcessingStep = 'idle' | 'uploading' | 'generating-grid' | 'done';

const STEP_LABELS: Record<ProcessingStep, string> = {
  idle: '准备就绪',
  uploading: '正在上传图片...',
  'generating-grid': '正在生成网格纸...',
  done: '处理完成',
};

// Grid size options (预设规格)
const GRID_OPTIONS = [
  { value: 25, label: '25 × 25' },
  { value: 52, label: '52 × 52' },
  { value: 100, label: '100 × 100' },
];

export default function Home() {
  // 用户认证状态
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [userId, setUserId] = useState<number | null>(null);
  const [userName, setUserName] = useState('');
  const [usageCount, setUsageCount] = useState(0);
  const [usageLimit, setUsageLimit] = useState(0);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [removedBgImage, setRemovedBgImage] = useState<string | null>(null);
  const [removedBgWithEdge, setRemovedBgWithEdge] = useState<string | null>(null); // 原图抠图带红色边缘线
  const [animeImage, setAnimeImage] = useState<string | null>(null);
  const [animeWithEdge, setAnimeWithEdge] = useState<string | null>(null); // 动漫图像带红色边缘线
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [step, setStep] = useState<ProcessingStep>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(25);  // 网格宽度（列数）
  const [gridHeight, setGridHeight] = useState(25); // 网格高度（行数）
  const [gridWidthInput, setGridWidthInput] = useState('25'); // 宽度输入框的值
  const [gridHeightInput, setGridHeightInput] = useState('25'); // 高度输入框的值
  const [effectiveGridCols, setEffectiveGridCols] = useState(25); // 实际使用的网格列数（考虑放大倍数）
  const [effectiveGridRows, setEffectiveGridRows] = useState(25); // 实际使用的网格行数（考虑放大倍数）
  const [colorMatchAccuracy, setColorMatchAccuracy] = useState<'standard' | 'enhanced'>('enhanced'); // 颜色匹配精度
  const [useAnimeImage, setUseAnimeImage] = useState(false);
  const [isAlreadyAnime, setIsAlreadyAnime] = useState(false); // 用户标记原图已是动漫风格
  const [upscaleFactor, setUpscaleFactor] = useState<1 | 2>(1); // 放大倍数：1倍或2倍
  const [upscaledImage, setUpscaledImage] = useState<string | null>(null); // 放大后的图片
  const [isTransformingAnime, setIsTransformingAnime] = useState(false);
  const [pixelatedImage, setPixelatedImage] = useState<string | null>(null);
  const [pixelatedSubject, setPixelatedSubject] = useState<string | null>(null); // 单独的像素化主体（透明背景）
  const [isPixelating, setIsPixelating] = useState(false);
  const [beadPatternImage, setBeadPatternImage] = useState<string | null>(null);
  const [beadPatternLegend, setBeadPatternLegend] = useState<Array<MardColor & { count: number }>>([]);
  const [isGeneratingBeadPattern, setIsGeneratingBeadPattern] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 用户认证函数
  const handleAuth = async () => {
    if (!apiKey.trim()) {
      setAuthError('请输入访问密钥');
      return;
    }

    setIsAuthenticating(true);
    setAuthError(null);

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey }),
      });

      const data = await response.json();

      if (data.success) {
        setIsAuthenticated(true);
        setUserId(data.user.id);
        setUserName(data.user.name);
        setUsageCount(data.user.usageCount);
        setUsageLimit(data.user.usageLimit);
        localStorage.setItem('apiKey', apiKey);
      } else {
        setAuthError(data.error || '认证失败');
      }
    } catch {
      setAuthError('认证失败，请重试');
    } finally {
      setIsAuthenticating(false);
    }
  };

  // 登出函数
  const handleLogout = () => {
    setIsAuthenticated(false);
    setApiKey('');
    setUserId(null);
    setUserName('');
    setUsageCount(0);
    setUsageLimit(0);
    localStorage.removeItem('apiKey');
  };

  // 记录使用次数
  const recordUsage = async (action: string, gridSize?: number, upscaleFactor?: number) => {
    if (!userId) return;

    try {
      await fetch('/api/usage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, gridSize, upscaleFactor }),
      });

      // 更新本地使用计数
      setUsageCount(prev => prev + 1);
    } catch (error) {
      console.error('Failed to record usage:', error);
    }
  };

  // 检查本地存储的 API Key
  useEffect(() => {
    const savedApiKey = localStorage.getItem('apiKey');
    if (savedApiKey) {
      setApiKey(savedApiKey);
      // 自动尝试认证
      const autoAuth = async () => {
        try {
          const response = await fetch('/api/auth', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: savedApiKey }),
          });

          const data = await response.json();

          if (data.success) {
            setIsAuthenticated(true);
            setUserId(data.user.id);
            setUserName(data.user.name);
            setUsageCount(data.user.usageCount);
            setUsageLimit(data.user.usageLimit);
          } else {
            localStorage.removeItem('apiKey');
          }
        } catch {
          localStorage.removeItem('apiKey');
        }
      };
      autoAuth();
    }
  }, []);

  // Handle click on upload area
  const handleUploadClick = useCallback(() => {
    if (step === 'idle' || step === 'done') {
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
    setRemovedBgWithEdge(null);
    setAnimeImage(null);
    setAnimeWithEdge(null);
    setUseAnimeImage(false);
    setIsAlreadyAnime(false);
    setUpscaleFactor(1);
    setUpscaledImage(null);
    setPixelatedImage(null);
    setPixelatedSubject(null);
    setBeadPatternImage(null);
    setBeadPatternLegend([]);

    try {
      setStep('uploading');
      setProgress(50);
      const imageDataUrl = await readFileAsDataURL(file);
      setOriginalImage(imageDataUrl);

      setProgress(100);
      setFinalImage(imageDataUrl);
      setStep('done');
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

  // Handle grid size selection (preset options)
  const handleGridSizeChange = useCallback(async (newGridSize: number) => {
    setGridWidth(newGridSize);
    setGridHeight(newGridSize);
    setGridWidthInput(String(newGridSize));
    setGridHeightInput(String(newGridSize));
    // Grid size change only affects pixelation, not the main result
  }, []);

  // Handle custom grid width input change
  const handleGridWidthInputChange = useCallback((value: string) => {
    setGridWidthInput(value);
  }, []);

  // Handle custom grid height input change
  const handleGridHeightInputChange = useCallback((value: string) => {
    setGridHeightInput(value);
  }, []);

  // Handle grid width input blur - validate and clamp
  const handleGridWidthBlur = useCallback(() => {
    const numValue = parseInt(gridWidthInput) || 1;
    const clampedValue = Math.max(1, Math.min(200, numValue));
    setGridWidth(clampedValue);
    setGridWidthInput(String(clampedValue));
  }, [gridWidthInput]);

  // Handle grid height input blur - validate and clamp
  const handleGridHeightBlur = useCallback(() => {
    const numValue = parseInt(gridHeightInput) || 1;
    const clampedValue = Math.max(1, Math.min(200, numValue));
    setGridHeight(clampedValue);
    setGridHeightInput(String(clampedValue));
  }, [gridHeightInput]);

  // Handle upscale factor change
  const handleUpscaleFactorChange = useCallback((factor: 1 | 2) => {
    setUpscaleFactor(factor);
  }, []);

  // Upscale image function
  const upscaleImage = useCallback(async (imageSrc: string, factor: number): Promise<string> => {
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
        
        canvas.width = img.width * factor;
        canvas.height = img.height * factor;
        
        // Use high-quality scaling
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => reject(new Error('图片加载失败'));
      img.src = imageSrc;
    });
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

  // Pixelate image - pixelate the original image
  const handlePixelate = useCallback(async () => {
    if (!originalImage || isPixelating) return;

    setIsPixelating(true);
    setError(null);

    try {
      // 如果选择2倍放大，先放大图片
      let sourceImage = originalImage;
      if (upscaleFactor === 2) {
        sourceImage = await upscaleImage(originalImage, 2);
        setUpscaledImage(sourceImage);
      }

      // 2倍放大时：图片放大2倍，占比变成1.5倍（0.9 * 1.5 = 1.35）
      // 使用较大的网格数进行像素化（保持正方形网格）
      const maxGridSize = Math.max(gridWidth, gridHeight);
      setEffectiveGridCols(gridWidth);
      setEffectiveGridRows(gridHeight);
      const scaleRatio = upscaleFactor === 2 ? 0.9 * 1.5 : 0.9;
      
      const result = await pixelateImage(sourceImage, maxGridSize, false, scaleRatio);
      setPixelatedImage(result.fullImage);        // 完整图片（带网格线）
      setPixelatedSubject(result.subjectImage);   // 单独的主体（透明背景）
      
      // 记录使用次数
      recordUsage('pixelate', maxGridSize, upscaleFactor);
    } catch (err) {
      console.error('Pixelate error:', err);
      setError(err instanceof Error ? err.message : '像素化处理失败');
    } finally {
      setIsPixelating(false);
    }
  }, [originalImage, gridWidth, gridHeight, isPixelating, upscaleFactor, upscaleImage]);

  // Generate bead pattern from pixelated subject
  const handleGenerateBeadPattern = useCallback(async () => {
    // Use pixelated subject (transparent background) directly
    if (!pixelatedSubject || isGeneratingBeadPattern) return;

    setIsGeneratingBeadPattern(true);
    setError(null);

    try {
      // 生成不带色号的图纸用于显示在"处理结果"窗口
      const displayResult = await generateBeadPatternHD(pixelatedSubject, effectiveGridCols, effectiveGridRows, 1, false, colorMatchAccuracy);
      setFinalImage(displayResult.image);
      
      // 生成带色号的图纸用于显示在"拼豆图纸"区域
      const withCodeResult = await generateBeadPatternHD(pixelatedSubject, effectiveGridCols, effectiveGridRows, 1, true, colorMatchAccuracy);
      setBeadPatternImage(withCodeResult.image);
      
      // 保存配色方案
      setBeadPatternLegend(displayResult.legend);
      
      // 记录使用次数
      recordUsage('bead_pattern', Math.max(effectiveGridCols, effectiveGridRows));
    } catch (err) {
      console.error('Bead pattern error:', err);
      setError(err instanceof Error ? err.message : '拼豆图纸生成失败');
    } finally {
      setIsGeneratingBeadPattern(false);
    }
  }, [pixelatedSubject, effectiveGridCols, effectiveGridRows, isGeneratingBeadPattern, colorMatchAccuracy]);

  const handleDownload = useCallback(() => {
    if (!originalImage) return;

    const link = document.createElement('a');
    link.href = originalImage;
    link.download = 'original-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [originalImage]);

  const handleDownloadPixelated = useCallback(() => {
    if (!pixelatedImage) return;

    const link = document.createElement('a');
    link.href = pixelatedImage;
    link.download = `pixelated-${effectiveGridCols}x${effectiveGridRows}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [pixelatedImage, effectiveGridCols, effectiveGridRows]);

  const handleDownloadBeadPattern = useCallback(async () => {
    if (!pixelatedSubject) return;

    try {
      // 生成带色号的高清图纸用于下载
      const result = await generateBeadPatternHD(pixelatedSubject, effectiveGridCols, effectiveGridRows, 3, true, colorMatchAccuracy);
      
      const link = document.createElement('a');
      link.href = result.image;
      link.download = `bead-pattern-hd-${effectiveGridCols}x${effectiveGridRows}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('HD download error:', err);
      setError('下载拼豆图纸失败');
    }
  }, [pixelatedSubject, effectiveGridCols, effectiveGridRows, colorMatchAccuracy]);

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
    setIsAlreadyAnime(false);
    setUpscaleFactor(1);
    setUpscaledImage(null);
    setEffectiveGridCols(25);
    setEffectiveGridRows(25);
    setGridWidth(25);
    setGridHeight(25);
    setGridWidthInput('25');
    setGridHeightInput('25');
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
              自助拼豆图纸生成器
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
            上传照片，自动像素化处理，生成拼豆图纸
          </p>

          {/* 用户信息和使用次数 */}
          {isAuthenticated && (
            <div className="mt-4 flex items-center justify-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
                <span>欢迎，{userName}</span>
                <span className="text-slate-300">|</span>
                <span>今日使用：{usageCount} / {usageLimit}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-slate-500 hover:text-slate-700"
              >
                <LogOut className="w-4 h-4 mr-1" />
                登出
              </Button>
            </div>
          )}
        </div>

        {/* 未认证时的登录界面 */}
        {!isAuthenticated && (
          <Card className="max-w-md mx-auto mb-6">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="text-center">
                  <Key className="w-12 h-12 mx-auto text-blue-600 mb-2" />
                  <h2 className="text-xl font-semibold">请输入访问密钥</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    您需要访问密钥才能使用此工具
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">访问密钥</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="请输入您的访问密钥"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAuth()}
                      className="pl-10"
                    />
                  </div>
                  {authError && (
                    <p className="text-sm text-red-500">{authError}</p>
                  )}
                </div>
                <Button
                  className="w-full"
                  onClick={handleAuth}
                  disabled={isAuthenticating}
                >
                  {isAuthenticating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      验证中...
                    </>
                  ) : (
                    '验证并开始使用'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 认证后才显示主功能 */}
        {isAuthenticated && (
          <>

        {/* Instructions */}
        <div className="mb-6 p-6 bg-white dark:bg-slate-800 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4 text-center">使用说明</h3>
          <div className="grid sm:grid-cols-5 gap-4">
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">1</span>
              </div>
              <div>
                <p className="font-medium">选择网格</p>
                <p className="text-sm text-slate-500">选择网格规格和图片大小</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 dark:text-blue-400 font-semibold text-lg">2</span>
              </div>
              <div>
                <p className="font-medium">上传图片</p>
                <p className="text-sm text-slate-500">选择要处理的图片</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 dark:text-green-400 font-semibold text-lg">3</span>
              </div>
              <div>
                <p className="font-medium">像素化处理</p>
                <p className="text-sm text-slate-500">生成像素化图片</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 dark:text-orange-400 font-semibold text-lg">4</span>
              </div>
              <div>
                <p className="font-medium">生成拼豆图纸</p>
                <p className="text-sm text-slate-500">获取拼豆配色方案</p>
              </div>
            </div>
            <div className="flex flex-col items-center text-center gap-2">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-purple-600 dark:text-purple-400 font-semibold text-lg">5</span>
              </div>
              <div>
                <p className="font-medium">下载结果</p>
                <p className="text-sm text-slate-500">保存拼豆图纸</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grid Size Selector */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-center gap-6 flex-wrap">
              <div className="flex items-center gap-2">
                <Grid3X3 className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-slate-700 dark:text-slate-300">网格纸规格：</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {GRID_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={gridWidth === option.value && gridHeight === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleGridSizeChange(option.value)}
                    className={`min-w-[80px] ${
                      gridWidth === option.value && gridHeight === option.value 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : ''
                    }`}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
              
              {/* Custom Grid Size Input */}
              <div className="flex items-center gap-2 ml-4">
                <span className="text-sm text-slate-500">自定义：</span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={gridWidthInput}
                    onChange={(e) => handleGridWidthInputChange(e.target.value)}
                    onBlur={handleGridWidthBlur}
                    className="w-16 h-8 text-center"
                  />
                  <span className="text-slate-500">×</span>
                  <Input
                    type="number"
                    min={1}
                    max={200}
                    value={gridHeightInput}
                    onChange={(e) => handleGridHeightInputChange(e.target.value)}
                    onBlur={handleGridHeightBlur}
                    className="w-16 h-8 text-center"
                  />
                </div>
              </div>
              
              {/* Divider */}
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
              
              {/* Upscale Factor Selector */}
              <div className="flex items-center gap-2">
                <ZoomIn className="w-5 h-5 text-purple-600" />
                <span className="font-medium text-slate-700 dark:text-slate-300">图片大小：</span>
                <div className="flex gap-2">
                  <Button
                    variant={upscaleFactor === 1 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpscaleFactorChange(1)}
                    className={upscaleFactor === 1 ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    标准 (1×)
                  </Button>
                  <Button
                    variant={upscaleFactor === 2 ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handleUpscaleFactorChange(2)}
                    className={upscaleFactor === 2 ? 'bg-purple-600 hover:bg-purple-700' : ''}
                  >
                    大图 (2×)
                  </Button>
                </div>
              </div>
              
              {/* Divider */}
              <div className="w-px h-8 bg-slate-200 dark:bg-slate-700 hidden md:block"></div>
              
              {/* Color Match Accuracy Selector */}
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-slate-700 dark:text-slate-300">颜色匹配：</span>
                <div className="flex gap-2">
                  <Button
                    variant={colorMatchAccuracy === 'standard' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorMatchAccuracy('standard')}
                    className={colorMatchAccuracy === 'standard' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    标准
                  </Button>
                  <Button
                    variant={colorMatchAccuracy === 'enhanced' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setColorMatchAccuracy('enhanced')}
                    className={colorMatchAccuracy === 'enhanced' ? 'bg-amber-600 hover:bg-amber-700' : ''}
                  >
                    增强
                  </Button>
                </div>
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
                  <span className="text-sm">图片上传成功 - {gridWidth}×{gridHeight} 网格纸</span>
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
                  {/* Pixelate Button */}
                  <Button
                    onClick={handlePixelate}
                    disabled={isPixelating || !originalImage}
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
                      下载图片
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
                {beadPatternLegend.length > 0 ? (
                  <>
                    <Beaker className="w-5 h-5 text-orange-600" />
                    拼豆图纸
                    <span className="text-sm font-normal text-slate-500 ml-2">
                      ({effectiveGridCols}×{effectiveGridRows} 格)
                    </span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5" />
                    处理结果
                    {finalImage && (
                      <span className="text-sm font-normal text-slate-500 ml-2">
                        (原图)
                      </span>
                    )}
                  </>
                )}
              </h2>

              <div 
                className="aspect-square rounded-xl overflow-hidden flex items-center justify-center"
                style={finalImage ? {
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
            </CardContent>
          </Card>
        </div>

        {/* Preview Cards */}
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          {/* Original Image Preview */}
          <Card>
            <CardContent className="p-4">
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                原图预览
              </h3>
              <div 
                className="h-40 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
                style={originalImage ? {
                  backgroundColor: '#fff',
                } : {}}
              >
                {originalImage ? (
                  <img
                    src={originalImage}
                    alt="原图"
                    className="max-w-full max-h-full object-contain"
                  />
                ) : (
                  <span className="text-slate-400 text-sm">等待上传...</span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pixelated Preview */}
          {pixelatedImage && (
            <Card>
              <CardContent className="p-4">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                  像素化预览
                </h3>
                <div 
                  className="h-40 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center"
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
                    ({effectiveGridCols}×{effectiveGridRows} 像素)
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
                    ({effectiveGridCols}×{effectiveGridRows} 格)
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
          </>
        )}
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

// 放大图片函数
async function upscaleImage(imageUrl: string, factor: number): Promise<string> {
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
      
      // 放大后的尺寸
      const newWidth = img.width * factor;
      const newHeight = img.height * factor;
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      
      // 使用高质量插值放大图片
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);
      
      resolve(canvas.toDataURL('image/png'));
    };
    
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = imageUrl;
  });
}

async function pixelateImage(imageUrl: string, gridCount: number, isFullImage: boolean = false, scaleRatio: number = 0.9): Promise<PixelateResult> {
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
      
      // Max dimension (width or height) = grid size * scaleRatio, keep aspect ratio
      // scaleRatio: 0.9 for normal, 1.35 (0.9*1.5) for 2x upscale
      const maxDimension = Math.max(imgWidth, imgHeight);
      const targetMaxSize = gridSize * scaleRatio;
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
            
            // 当 isFullImage 为 true 时，处理整张图片（忽略透明度检测）
            // 否则只绘制有透明度的像素（抠图主体）
            if (isFullImage || avgA > 10) {
              // Draw at centered position (offsetX, offsetY) on 800x800 canvas
              subjectCtx.fillStyle = `rgba(${avgR}, ${avgG}, ${avgB}, ${isFullImage ? 1 : avgA / 255})`;
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
  gridSize: number,
  colorMatchAccuracy: ColorMatchAccuracy = 'enhanced'
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
      // Color codes are typically 2-3 characters (e.g., "A1", "B12")
      // Use smaller font for smaller grids to ensure text doesn't overflow
      // For 2-char codes: max width should be ~60% of cell size
      // For 3-char codes: max width should be ~80% of cell size
      const estimatedCharWidth = pixelSize * 0.25; // Rough estimate for monospace-like width
      const maxTextWidth = pixelSize * 0.7; // Leave some padding
      const fontSizeFromWidth = Math.floor(maxTextWidth / 2.5); // Assume max 2.5 chars width
      const fontSizeFromHeight = Math.floor(pixelSize * 0.45); // Height constraint
      const fontSize = Math.max(4, Math.min(fontSizeFromWidth, fontSizeFromHeight, Math.floor(pixelSize * 0.35)));
      
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
            const nearestColor = findClosestMardColor(avgR, avgG, avgB, colorMatchAccuracy);
            
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

      // Draw grid lines on top (白色网格线)
      ctx.strokeStyle = '#FFFFFF';
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
// Generate bead pattern using direct center pixel sampling (simplified approach)
// Similar to perler_VERSION2: read center pixel only, no flood fill
async function generateBeadPatternHD(
  subjectImageUrl: string,
  gridCols: number,  // 网格列数（宽度）
  gridRows: number,  // 网格行数（高度）
  scale: number = 3,
  showColorCode: boolean = true,
  colorMatchAccuracy: ColorMatchAccuracy = 'enhanced'
): Promise<{ image: string; legend: Array<MardColor & { count: number }> }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      // Step 1: Create canvas and get image data
      const srcCanvas = document.createElement('canvas');
      const srcCtx = srcCanvas.getContext('2d');
      if (!srcCtx) {
        reject(new Error('无法创建源画布'));
        return;
      }
      
      // Make square canvas (like perler_VERSION2)
      const squareSize = Math.max(img.width, img.height);
      srcCanvas.width = squareSize;
      srcCanvas.height = squareSize;
      
      // Fill white background
      srcCtx.fillStyle = '#FFFFFF';
      srcCtx.fillRect(0, 0, squareSize, squareSize);
      
      // Draw image centered
      const srcOffsetX = (squareSize - img.width) / 2;
      const srcOffsetY = (squareSize - img.height) / 2;
      srcCtx.drawImage(img, srcOffsetX, srcOffsetY);
      
      const imageData = srcCtx.getImageData(0, 0, squareSize, squareSize);
      
      // Step 2: Calculate cell size
      const cellWidth = Math.floor(squareSize / gridCols);
      const cellHeight = Math.floor(squareSize / gridRows);
      
      // Step 3: Process each grid cell - direct center pixel sampling
      const cellData: Array<{
        gridX: number;
        gridY: number;
        r: number;
        g: number;
        b: number;
        a: number;
        mardColor: MardColor | null;
      }> = [];
      
      const colorStats = new Map<string, { color: MardColor; count: number }>();
      
      for (let gridY = 0; gridY < gridRows; gridY++) {
        for (let gridX = 0; gridX < gridCols; gridX++) {
          // Calculate center pixel position
          const startX = gridX * cellWidth;
          const startY = gridY * cellHeight;
          const endX = Math.min((gridX + 1) * cellWidth, squareSize);
          const endY = Math.min((gridY + 1) * cellHeight, squareSize);
          
          // Direct center pixel sampling
          const centerX = Math.floor((startX + endX) / 2);
          const centerY = Math.floor((startY + endY) / 2);
          
          // Get center pixel color
          const i = (centerY * squareSize + centerX) * 4;
          const r = imageData.data[i];
          const g = imageData.data[i + 1];
          const b = imageData.data[i + 2];
          const a = imageData.data[i + 3];
          
          cellData.push({
            gridX,
            gridY,
            r, g, b, a,
            mardColor: null
          });
          
          // If pixel is visible, find closest bead color
          if (a >= 128) {
            const mardColor = findClosestMardColor(r, g, b, colorMatchAccuracy);
            cellData[cellData.length - 1].mardColor = mardColor;
            
            const existing = colorStats.get(mardColor.code);
            if (existing) {
              existing.count++;
            } else {
              colorStats.set(mardColor.code, { color: mardColor, count: 1 });
            }
          }
        }
      }
      
      // Step 4: Limit to max 30 colors
      const MAX_COLORS = 30;
      let selectedColors: MardColor[];
      
      if (colorStats.size > MAX_COLORS) {
        // Get top 30 most frequently used colors
        const sortedEntries = Array.from(colorStats.entries())
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, MAX_COLORS);
        
        selectedColors = sortedEntries.map(([_, data]) => data.color);
        
        // Remap cells with non-top-30 colors
        const selectedColorSet = new Set(selectedColors.map(c => c.code));
        
        for (const cell of cellData) {
          if (cell.mardColor && !selectedColorSet.has(cell.mardColor.code)) {
            // Find closest color from selected colors
            let minDist = Infinity;
            let closestColor = cell.mardColor;
            
            for (const color of selectedColors) {
              const rgb = hexToRgb(color.hex);
              const dist = Math.sqrt(
                Math.pow(cell.r - rgb.r, 2) +
                Math.pow(cell.g - rgb.g, 2) +
                Math.pow(cell.b - rgb.b, 2)
              );
              if (dist < minDist) {
                minDist = dist;
                closestColor = color;
              }
            }
            cell.mardColor = closestColor;
          }
        }
        
        // Recalculate stats after remapping
        colorStats.clear();
        for (const cell of cellData) {
          if (cell.mardColor) {
            const existing = colorStats.get(cell.mardColor.code);
            if (existing) {
              existing.count++;
            } else {
              colorStats.set(cell.mardColor.code, { color: cell.mardColor, count: 1 });
            }
          }
        }
      } else {
        selectedColors = Array.from(colorStats.values()).map(v => v.color);
      }
      
      // Helper function
      function hexToRgb(hex: string): { r: number; g: number; b: number } {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 255, g: 255, b: 255 };
      }
      
      // Step 5: Create output canvas with legend at bottom
      const baseCellSize = 20 * scale;
      const labelPadding = 30 * scale;
      
      // Calculate legend dimensions (at bottom, 2 rows, 10 items per row)
      const sortedColors = Array.from(colorStats.entries())
        .filter(([code, _]) => code !== 'W')
        .sort((a, b) => b[1].count - a[1].count);
      
      const totalBeads = sortedColors.reduce((sum, [_, data]) => sum + data.count, 0);
      
      const legendPadding = 40 * scale;
      const itemGap = 15 * scale;  // 色号项之间的间距
      const colorBoxSize = 30 * scale;  // 色块大小
      const itemHeight = 50 * scale;
      const gridWidth = gridCols * baseCellSize;
      const gridHeight = gridRows * baseCellSize;
      
      // 固定每排10个色号，共三排（最多30种颜色）
      const itemsPerRow = 10;
      const legendRows = 3;
      
      // 计算每个色号项的宽度（预估）
      const estimatedItemWidth = 70 * scale;
      
      // 计算图例区域所需宽度：10个色号项 + 间距
      const legendWidth = itemsPerRow * estimatedItemWidth + (itemsPerRow - 1) * itemGap + legendPadding * 2;
      
      // 画布宽度取网格宽度和图例所需宽度的较大值
      const canvasWidth = Math.max(gridWidth + labelPadding * 2, legendWidth);
      
      // 图例高度：标题 + 三排色号
      const legendHeight = legendPadding + 40 * scale + legendRows * itemHeight + legendPadding;
      
      // Canvas size: grid with labels on all 4 sides, plus legend at bottom
      const canvasHeight = gridHeight + labelPadding * 2 + legendHeight;
      
      // 计算图纸部分在画布中的居中偏移
      const gridAreaWidth = gridWidth + labelPadding * 2;
      const gridOffsetX = (canvasWidth - gridAreaWidth) / 2;
      
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('无法创建画布'));
        return;
      }
      
      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      const cellSize = baseCellSize;
      // 图纸部分居中偏移
      const offsetX = gridOffsetX + labelPadding;
      const offsetY = labelPadding;
      const patternWidth = gridWidth;
      const patternHeight = gridHeight;
      
      // Calculate font size for color codes (same as number labels)
      const codeFontSize = Math.max(10, Math.floor(cellSize * 0.35));
      
      // Step 6: Draw grid labels on all four sides (number labels)
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${Math.max(12, Math.floor(scale * 12))}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Column labels at top
      for (let x = 0; x < gridCols; x++) {
        ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY - cellSize / 2);
      }

      // Row labels at left
      ctx.textAlign = 'right';
      for (let y = 0; y < gridRows; y++) {
        ctx.fillText(`${y + 1}`, offsetX - 5, offsetY + y * cellSize + cellSize / 2);
      }

      // Row labels at right
      ctx.textAlign = 'left';
      for (let y = 0; y < gridRows; y++) {
        ctx.fillText(`${y + 1}`, offsetX + patternWidth + 5, offsetY + y * cellSize + cellSize / 2);
      }

      // Column labels at bottom
      ctx.textAlign = 'center';
      for (let x = 0; x < gridCols; x++) {
        ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY + patternHeight + cellSize / 2);
      }
      
      // Step 7: Fill grid cells
      const whiteMardColor: MardColor = { code: 'W', hex: '#FFFFFF' };
      
      for (const cell of cellData) {
        const x = offsetX + cell.gridX * cellSize;
        const y = offsetY + cell.gridY * cellSize;
        
        let finalColor: MardColor;
        let finalRgb: { r: number; g: number; b: number };
        
        if (cell.mardColor) {
          finalColor = cell.mardColor;
          finalRgb = hexToRgb(finalColor.hex);
        } else {
          // Transparent or background - fill white
          finalColor = whiteMardColor;
          finalRgb = { r: 255, g: 255, b: 255 };
        }
        
        // Fill cell with color
        ctx.fillStyle = finalColor.hex;
        ctx.fillRect(x, y, cellSize, cellSize);
      }
      
      // Step 8: Draw grid lines (白色网格线)
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = Math.max(1, Math.floor(scale * 0.5));
      
      for (let x = 0; x <= gridCols; x++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x * cellSize, offsetY);
        ctx.lineTo(offsetX + x * cellSize, offsetY + patternHeight);
        ctx.stroke();
      }
      
      for (let y = 0; y <= gridRows; y++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y * cellSize);
        ctx.lineTo(offsetX + patternWidth, offsetY + y * cellSize);
        ctx.stroke();
      }
      
      // Step 9: Draw color codes (only if showColorCode is true)
      if (showColorCode) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `bold ${codeFontSize}px Arial`;
        
        for (const cell of cellData) {
          if (!cell.mardColor) continue;
          
          const rgb = hexToRgb(cell.mardColor.hex);
          const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
          ctx.fillStyle = brightness > 128 ? '#000000' : '#ffffff';
          
          const x = offsetX + cell.gridX * cellSize + cellSize / 2;
          const y = offsetY + cell.gridY * cellSize + cellSize / 2;
          ctx.fillText(cell.mardColor.code, x, y);
        }
      }
      
      // Step 10: Draw legend area at bottom
      if (sortedColors.length > 0) {
        const legendY = offsetY + patternHeight + labelPadding;
        
        // Draw legend area background
        ctx.fillStyle = '#F8F9FA';
        ctx.fillRect(0, legendY, canvasWidth, legendHeight);
        
        // Draw legend title (centered)
        ctx.fillStyle = '#000000';
        ctx.font = `bold ${Math.floor(scale * 20)}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `拼豆色号图例 (${sortedColors.length}种色号, 共${totalBeads}个拼豆)`,
          canvasWidth / 2,
          legendY + 35 * scale
        );
        
        // Draw legend items - 两排，每排10个
        ctx.font = `bold ${Math.floor(scale * 12)}px Arial`;
        
        // 计算每个色号项的实际宽度（色块 + 色号 + 数量）
        const codeTextWidth = ctx.measureText('W1').width;
        const countTextWidth = ctx.measureText('999').width;
        const actualItemWidth = colorBoxSize + 8 * scale + countTextWidth + itemGap;
        
        // 计算图例起始位置（居中）
        const totalLegendWidth = itemsPerRow * actualItemWidth - itemGap;
        const legendStartX = (canvasWidth - totalLegendWidth) / 2;
        
        sortedColors.forEach(([code, data], index) => {
          // 固定每排10个，最多两排
          const row = Math.floor(index / itemsPerRow);
          const col = index % itemsPerRow;
          
          // 如果超过三排，跳过
          if (row >= 3) return;
          
          const itemStartX = legendStartX + col * actualItemWidth;
          const y = legendY + legendPadding + 40 * scale + row * itemHeight;
          const rgb = hexToRgb(data.color.hex);
          
          // Draw color swatch
          ctx.fillStyle = data.color.hex;
          ctx.fillRect(itemStartX, y - 12 * scale, colorBoxSize, colorBoxSize);
          ctx.strokeStyle = '#CCCCCC';
          ctx.lineWidth = 1;
          ctx.strokeRect(itemStartX, y - 12 * scale, colorBoxSize, colorBoxSize);
          
          // Draw color code on the swatch
          const textColor = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000 > 128 ? '#000000' : '#ffffff';
          ctx.fillStyle = textColor;
          ctx.textAlign = 'center';
          ctx.font = `bold ${Math.floor(scale * 11)}px Arial`;
          ctx.fillText(code, itemStartX + colorBoxSize / 2, y);
          
          // Draw count on the right
          ctx.fillStyle = '#000000';
          ctx.textAlign = 'left';
          ctx.font = `bold ${Math.floor(scale * 12)}px Arial`;
          ctx.fillText(`${data.count}`, itemStartX + colorBoxSize + 5 * scale, y);
        });
      }

      // Build legend with counts
      const legend = sortedColors.map(([code, data]) => ({
        ...data.color,
        count: data.count
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
