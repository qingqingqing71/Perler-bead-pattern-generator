'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Upload, Download, Grid3x3, Type, Grid3X3 } from 'lucide-react';

// 与 perler_VERSION2 完全一致的颜色数据结构
interface BeadColor {
  colorName: string;
  colorCode: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

interface PixelGrid {
  width: number;
  height: number;
  pixels: number[][]; // color indices
  gridColors: BeadColor[][]; // matched bead colors for each grid
}

interface PerlerVersion2PageProps {
  onBack?: () => void;
  samplingMode?: 'single' | 'multi5' | 'multi9';  // 采样模式
  onSamplingModeChange?: (mode: 'single' | 'multi5' | 'multi9') => void;  // 切换采样模式的回调
}

export default function PerlerVersion2Page({ onBack, samplingMode: propSamplingMode = 'single', onSamplingModeChange }: PerlerVersion2PageProps) {
  // 内部管理采样模式状态（如果没有传入回调函数）
  const [internalSamplingMode, setInternalSamplingMode] = useState<'single' | 'multi5' | 'multi9'>('single');
  const samplingMode = onSamplingModeChange ? propSamplingMode : internalSamplingMode;
  const handleSamplingModeChange = (mode: 'single' | 'multi5' | 'multi9') => {
    if (onSamplingModeChange) {
      onSamplingModeChange(mode);
    } else {
      setInternalSamplingMode(mode);
    }
  };

  // 使用 API 获取颜色数据（与 perler_VERSION2 完全一致）
  const [beadColors, setBeadColors] = useState<BeadColor[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(52); // Width in beads
  const [gridHeight, setGridHeight] = useState(52); // Height in beads
  const [pixelGrid, setPixelGrid] = useState<PixelGrid | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement>(null); // 拼豆效果预览 canvas
  const [showGridLines, setShowGridLines] = useState(true);
  const [showColorCodes, setShowColorCodes] = useState(true);
  const [colorMatchAccuracy, setColorMatchAccuracy] = useState<'standard' | 'enhanced'>('enhanced');
  const [colorMode, setColorMode] = useState<'simple' | 'standard' | 'accurate' | 'custom'>('simple'); // 颜色模式：简化/标准/精准/自定义
  const [customMaxColors, setCustomMaxColors] = useState(15); // 自定义最大颜色数
  const [colorStats, setColorStats] = useState<Map<number, number>>(new Map());
  const [upscaleFactor, setUpscaleFactor] = useState<1 | 1.2>(1); // 放大倍数

  // Load bead colors on mount (与 perler_VERSION2 完全一致)
  useEffect(() => {
    fetch('/api/beads-colors')
      .then(res => res.json())
      .then(data => {
        setBeadColors(data);
      })
      .catch(err => {
        console.error('Failed to load bead colors:', err);
      });
  }, []);

  // 当颜色模式或自定义颜色数改变时，清除已有的图纸
  useEffect(() => {
    if (pixelGrid) {
      setPixelGrid(null);
      setColorStats(new Map());
    }
  }, [colorMode, customMaxColors]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
        setPixelGrid(null);
        setColorStats(new Map());
      };
      reader.readAsDataURL(file);
    }
  };

  // Helper function to convert RGB to XYZ color space
  const rgbToXyz = (r: number, g: number, b: number) => {
    const normalize = (c: number) => {
      const cNorm = c / 255;
      return cNorm > 0.04045 ? Math.pow((cNorm + 0.055) / 1.055, 2.4) : cNorm / 12.92;
    };

    const rLinear = normalize(r);
    const gLinear = normalize(g);
    const bLinear = normalize(b);

    const x = (rLinear * 0.4124564 + gLinear * 0.3575761 + bLinear * 0.1804375) * 100;
    const y = (rLinear * 0.2126729 + gLinear * 0.7151522 + bLinear * 0.0721750) * 100;
    const z = (rLinear * 0.0193339 + gLinear * 0.1191920 + bLinear * 0.9503041) * 100;

    return { x, y, z };
  };

  // Helper function to convert XYZ to Lab color space
  const xyzToLab = (x: number, y: number, z: number) => {
    const xn = 95.047;
    const yn = 100.000;
    const zn = 108.883;

    const normalize = (c: number) => {
      return c > 0.008856 ? Math.pow(c, 1/3) : (7.787 * c) + (16 / 116);
    };

    const fx = normalize(x / xn);
    const fy = normalize(y / yn);
    const fz = normalize(z / zn);

    const l = 116 * fy - 16;
    const a = 500 * (fx - fy);
    const b = 200 * (fy - fz);

    return { l, a, b };
  };

  // Helper function to convert RGB to Lab directly
  const rgbToLab = (r: number, g: number, b: number) => {
    const { x, y, z } = rgbToXyz(r, g, b);
    return xyzToLab(x, y, z);
  };

  // Calculate CIEDE2000 color difference
  const deltaE2000 = (lab1: { l: number; a: number; b: number }, lab2: { l: number; a: number; b: number }) => {
    const L1 = lab1.l, a1 = lab1.a, b1 = lab1.b;
    const L2 = lab2.l, a2 = lab2.a, b2 = lab2.b;

    const kL = 1, kC = 1, kH = 1;

    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cab = (C1 + C2) / 2;

    const G = 0.5 * (1 - Math.sqrt(Math.pow(Cab, 7) / (Math.pow(Cab, 7) + Math.pow(25, 7))));
    const a1p = a1 * (1 + G);
    const a2p = a2 * (1 + G);

    const C1p = Math.sqrt(a1p * a1p + b1 * b1);
    const C2p = Math.sqrt(a2p * a2p + b2 * b2);

    let h1p = Math.atan2(b1, a1p) * 180 / Math.PI;
    if (h1p < 0) h1p += 360;
    let h2p = Math.atan2(b2, a2p) * 180 / Math.PI;
    if (h2p < 0) h2p += 360;

    const dLp = L2 - L1;
    const dCp = C2p - C1p;

    let dhp;
    if (C1p * C2p === 0) {
      dhp = 0;
    } else if (Math.abs(h2p - h1p) <= 180) {
      dhp = h2p - h1p;
    } else if (h2p - h1p > 180) {
      dhp = h2p - h1p - 360;
    } else {
      dhp = h2p - h1p + 360;
    }

    const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(dhp * Math.PI / 360);

    const Lp = (L1 + L2) / 2;
    const Cp = (C1p + C2p) / 2;

    let Hp;
    if (C1p * C2p === 0) {
      Hp = h1p + h2p;
    } else if (Math.abs(h1p - h2p) <= 180) {
      Hp = (h1p + h2p) / 2;
    } else if (h1p + h2p < 360) {
      Hp = (h1p + h2p + 360) / 2;
    } else {
      Hp = (h1p + h2p - 360) / 2;
    }

    const T = 1 - 0.17 * Math.cos((Hp - 30) * Math.PI / 180)
            + 0.24 * Math.cos(2 * Hp * Math.PI / 180)
            + 0.32 * Math.cos((3 * Hp + 6) * Math.PI / 180)
            - 0.20 * Math.cos((4 * Hp - 63) * Math.PI / 180);

    const SL = 1 + (0.015 * Math.pow(Lp - 50, 2)) / Math.sqrt(20 + Math.pow(Lp - 50, 2));
    const SC = 1 + 0.045 * Cp;
    const SH = 1 + 0.015 * Cp * T;

    const RT = -2 * Math.sqrt(Math.pow(Cp, 7) / (Math.pow(Cp, 7) + Math.pow(25, 7)))
               * Math.sin(60 * Math.exp(-Math.pow((Hp - 275) / 25, 2)) * Math.PI / 180);

    const dE = Math.sqrt(
      Math.pow(dLp / (kL * SL), 2) +
      Math.pow(dCp / (kC * SC), 2) +
      Math.pow(dHp / (kH * SH), 2) +
      RT * (dCp / (kC * SC)) * (dHp / (kH * SH))
    );

    return dE;
  };

  // Hex to RGB helper
  const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 255, g: 255, b: 255 };
  };

  // 找到最接近的拼豆颜色（统一使用CIEDE2000，提高颜色匹配准确性）
  const findClosestBeadColor = (r: number, g: number, b: number): number => {
    let minDistance = Infinity;
    let closestIndex = 0;

    // 强制使用 CIEDE2000 匹配（最准确）
    const inputLab = rgbToLab(r, g, b);

    for (let i = 0; i < beadColors.length; i++) {
      const color = beadColors[i];
      // 使用 beadColors 中预先计算的 RGB 值
      const colorLab = rgbToLab(color.r, color.g, color.b);
      const distance = deltaE2000(inputLab, colorLab);

      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = i;
      }
    }

    return closestIndex;
  };

  // 颜色聚类合并函数（用于5点采样，减少杂色）
  const clusterColors = (
    stats: Map<number, number>,
    beadColors: BeadColor[],
    maxColors: number,
    clusterThreshold: number = 35
  ): Map<number, number> => {
    // 颜色映射：原色号 -> 代表色号
    const colorMap = new Map<number, number>();
    const entries = Array.from(stats.entries()).sort((a, b) => b[1] - a[1]);
    const used = new Set<number>();
    
    // 按使用频率从高到低遍历，建立聚类
    for (const [colorIndex, count] of entries) {
      if (used.has(colorIndex)) continue;
      
      // 如果已经达到最大颜色数，将剩余颜色映射到最接近的已有颜色
      if (colorMap.size >= maxColors) {
        let minDist = Infinity;
        let closestRepresentative = -1;
        
        for (const [rep] of colorMap) {
          const dist = colorDistance(beadColors[colorIndex], beadColors[rep]);
          if (dist < minDist) {
            minDist = dist;
            closestRepresentative = rep;
          }
        }
        colorMap.set(colorIndex, closestRepresentative);
        used.add(colorIndex);
        continue;
      }
      
      // 当前颜色作为新聚类的代表色
      const currentColor = beadColors[colorIndex];
      colorMap.set(colorIndex, colorIndex);
      used.add(colorIndex);
      
      // 找出所有相近的颜色，合并到当前聚类
      for (const [otherIndex, otherCount] of entries) {
        if (used.has(otherIndex)) continue;
        
        const otherColor = beadColors[otherIndex];
        const dist = colorDistance(currentColor, otherColor);
        
        // 如果颜色足够接近，合并到同一聚类
        if (dist < clusterThreshold) {
          colorMap.set(otherIndex, colorIndex);
          used.add(otherIndex);
          // 累加计数到代表色
          stats.set(colorIndex, (stats.get(colorIndex) || 0) + otherCount);
        }
      }
    }
    
    return colorMap;
  };

  // 简单颜色距离计算
  const colorDistance = (c1: BeadColor, c2: BeadColor): number => {
    return Math.sqrt(
      Math.pow(c1.r - c2.r, 2) +
      Math.pow(c1.g - c2.g, 2) +
      Math.pow(c1.b - c2.b, 2)
    );
  };

  // 简单截断颜色限制函数 + 相近色合并（参考26247a7版本，用于9点采样）
  const limitColorsSimple = (
    stats: Map<number, number>,
    beadColors: BeadColor[],
    maxColors: number,
    mergeThreshold: number = 30,  // 相近色合并阈值
    edgeCells?: Set<string>,  // 边缘格子集合
    pixels?: number[][]  // 像素网格
  ): Map<number, number> => {
    // 颜色映射：原色号 -> 代表色号
    const colorMap = new Map<number, number>();
    
    // 收集边缘格子使用的颜色
    const edgeColors = new Set<number>();
    if (edgeCells && pixels) {
      edgeCells.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const colorIndex = pixels[y][x];
        if (colorIndex >= 0) {
          edgeColors.add(colorIndex);
        }
      });
    }
    
    // 按使用频率从高到低排序
    const sortedColors = Array.from(stats.entries())
      .sort((a, b) => b[1] - a[1]);

    // 计算每个颜色的权重（边缘颜色权重更高）
    const weightedColors = sortedColors.map(([colorIndex, count]) => {
      const weight = edgeColors.has(colorIndex) ? count * 3 : count; // 边缘颜色额外算3次
      return { colorIndex, weight };
    });

    // 按权重从高到低排序
    const sortedByWeight = weightedColors
      .sort((a, b) => b.weight - a.weight)
      .map(item => [item.colorIndex, stats.get(item.colorIndex) || 0]);

    // 保留权重最高的 maxColors 个颜色
    const keptColors: number[] = [];
    const processedColors = new Set<number>();

    for (const [colorIndex, count] of sortedByWeight) {
      if (processedColors.has(colorIndex)) continue;
      if (keptColors.length >= maxColors) break;

      keptColors.push(colorIndex);
      processedColors.add(colorIndex);
    }
    
    // 对保留的颜色进行相近色合并，但保护边缘颜色不被合并
    const finalKeptColors = new Set<number>();
    const merged = new Set<number>();
    
    for (let i = 0; i < keptColors.length; i++) {
      const colorIndex = keptColors[i];
      if (merged.has(colorIndex)) continue;
      
      finalKeptColors.add(colorIndex);
      colorMap.set(colorIndex, colorIndex);
      
      // 如果当前颜色是边缘颜色，不合并任何颜色
      if (edgeColors.has(colorIndex)) {
        continue;
      }
      
      // 检查后面的颜色是否与当前颜色相近
      for (let j = i + 1; j < keptColors.length; j++) {
        const otherIndex = keptColors[j];
        if (merged.has(otherIndex)) continue;
        
        const dist = colorDistance(beadColors[colorIndex], beadColors[otherIndex]);
        
        // 边缘颜色完全不合并
        if (edgeColors.has(otherIndex)) {
          continue;
        }
        
        // 如果颜色足够接近，合并到当前颜色
        if (dist < mergeThreshold) {
          merged.add(otherIndex);
          colorMap.set(otherIndex, colorIndex);
        }
      }
    }
    
    // 将剩余颜色（未保留的和被合并的）映射到最接近的最终保留颜色
    for (const [colorIndex] of sortedColors) {
      if (finalKeptColors.has(colorIndex)) continue;
      
      // 如果已经被合并了，跳过
      if (colorMap.has(colorIndex)) continue;
      
      let minDist = Infinity;
      let closestRepresentative = -1;
      
      for (const rep of finalKeptColors) {
        const dist = colorDistance(beadColors[colorIndex], beadColors[rep]);
        if (dist < minDist) {
          minDist = dist;
          closestRepresentative = rep;
        }
      }
      
      colorMap.set(colorIndex, closestRepresentative);
    }
    
    return colorMap;
  };

  const detectGridAndProcess = async () => {
    if (!uploadedImage || beadColors.length === 0) return;

    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = async () => {
      // 确保图片完全解码（重要：解决手机浏览器颜色不准确问题）
      try {
        await img.decode();
      } catch (e) {
        console.warn('Image decode warning:', e);
      }
      
      // Step 1: Create square canvas (based on original image size)
      // 限制最大尺寸为 2048px，避免手机浏览器内存问题
      const maxSize = 2048;
      let squareSize = Math.max(img.width, img.height);
      const scale = squareSize > maxSize ? maxSize / squareSize : 1;
      squareSize = Math.floor(squareSize * scale);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      canvas.width = squareSize;
      canvas.height = squareSize;

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate image size with upscale factor and scale
      // 1.2倍：在相同网格画幅内，图片放大1.2倍（边缘会被裁剪）
      const drawWidth = img.width * upscaleFactor * scale;
      const drawHeight = img.height * upscaleFactor * scale;

      // Draw image centered
      const offsetX = (squareSize - drawWidth) / 2;
      const offsetY = (squareSize - drawHeight) / 2;

      // 根据采样模式选择是否启用平滑缩放
      if (samplingMode === 'single' || samplingMode === 'multi5') {
        // 单点/5点采样：关闭平滑缩放，避免边缘颜色混合影响
        // 保持原始像素颜色，不受周围网格颜色影响
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      } else {
        // 9点采样：可以保持平滑缩放（因为取的是全像素平均值）
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);
      }

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // 色彩拍平：减少颜色过渡，使图像更卡通化
      // 通过降低颜色精度（从8位降到5位）来合并相近颜色
      const flattenColors = (data: Uint8ClampedArray) => {
        const factor = 8; // 位深度：8 - 5 = 3，即每8个等级合并为1个
        for (let i = 0; i < data.length; i += 4) {
          // 降低R、G、B通道的精度
          data[i] = Math.round(data[i] / factor) * factor;     // R
          data[i + 1] = Math.round(data[i + 1] / factor) * factor; // G
          data[i + 2] = Math.round(data[i + 2] / factor) * factor; // B
          // Alpha通道保持不变
        }
      };
      
      flattenColors(imageData.data);

      // Calculate grid cell size
      const cellWidth = Math.floor(canvas.width / gridWidth);
      const cellHeight = Math.floor(canvas.height / gridHeight);

      const pixels: number[][] = [];
      const gridColors: BeadColor[][] = [];

      // Helper function to get pixel color at (x, y)
      const getPixelColor = (x: number, y: number) => {
        const idx = (y * canvas.width + x) * 4;
        return {
          r: imageData.data[idx],
          g: imageData.data[idx + 1],
          b: imageData.data[idx + 2],
          a: imageData.data[idx + 3]
        };
      };

      // Process each grid cell - 根据采样模式选择采样方式
      for (let y = 0; y < gridHeight; y++) {
        const row: number[] = [];
        const colorRow: BeadColor[] = [];

        for (let x = 0; x < gridWidth; x++) {
          const startX = x * cellWidth;
          const startY = y * cellHeight;
          const endX = Math.min((x + 1) * cellWidth, canvas.width);
          const endY = Math.min((y + 1) * cellHeight, canvas.height);

          // Calculate center pixel position
          const centerX = Math.floor((startX + endX) / 2);
          const centerY = Math.floor((startY + endY) / 2);

          let r: number, g: number, b: number, a: number;

          if (samplingMode === 'single') {
            // 单点采样：只取中心点
            const color = getPixelColor(centerX, centerY);
            r = color.r;
            g = color.g;
            b = color.b;
            a = color.a;
          } else if (samplingMode === 'multi5') {
            // 5点采样：中心 + 四个象限中心（均匀分布）
            const cellW = endX - startX;
            const cellH = endY - startY;
            
            // 5点位置：中心 + 四个象限的中心（更均匀的分布）
            const points = [
              { x: centerX, y: centerY },                                    // 中心
              { x: Math.floor(startX + cellW * 0.25), y: Math.floor(startY + cellH * 0.25) },  // 左上象限中心
              { x: Math.floor(startX + cellW * 0.75), y: Math.floor(startY + cellH * 0.25) },  // 右上象限中心
              { x: Math.floor(startX + cellW * 0.25), y: Math.floor(startY + cellH * 0.75) },  // 左下象限中心
              { x: Math.floor(startX + cellW * 0.75), y: Math.floor(startY + cellH * 0.75) }   // 右下象限中心
            ];

            let sumR = 0, sumG = 0, sumB = 0, validCount = 0;
            let hasValidPixel = false;
            
            points.forEach(p => {
              const color = getPixelColor(p.x, p.y);
              // 只计算非透明点（a >= 128）
              if (color.a >= 128) {
                sumR += color.r;
                sumG += color.g;
                sumB += color.b;
                validCount++;
                hasValidPixel = true;
              }
            });
            
            if (hasValidPixel) {
              // 有有效的像素点，取平均值
              r = Math.round(sumR / validCount);
              g = Math.round(sumG / validCount);
              b = Math.round(sumB / validCount);
              a = 255;  // 有有效像素，标记为不透明
            } else {
              // 所有点都是透明的
              r = 255;
              g = 255;
              b = 255;
              a = 0;
            }
          } else {
            // 9点采样：格子内所有像素取平均（参考26247a7版本）
            let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
            let pixelCount = 0;
            
            for (let py = startY; py < endY; py++) {
              for (let px = startX; px < endX; px++) {
                const color = getPixelColor(px, py);
                totalR += color.r;
                totalG += color.g;
                totalB += color.b;
                totalA += color.a;
                pixelCount++;
              }
            }
            
            if (pixelCount > 0) {
              r = Math.round(totalR / pixelCount);
              g = Math.round(totalG / pixelCount);
              b = Math.round(totalB / pixelCount);
              a = Math.round(totalA / pixelCount);
            } else {
              r = 255;
              g = 255;
              b = 255;
              a = 0;
            }
          }

          if (a > 10) {
            // 统一使用 CIEDE2000 匹配（最准确）
            const colorIndex = findClosestBeadColor(r, g, b);
            row.push(colorIndex);
            colorRow.push(beadColors[colorIndex]);
          } else {
            // 透明像素 - 与 26247a7 版本一致（阈值 > 10）
            row.push(-1);
            colorRow.push({
              colorName: '',
              colorCode: '',
              hex: '#FFFFFF',
              r: 255,
              g: 255,
              b: 255
            });
          }
        }

        pixels.push(row);
        gridColors.push(colorRow);
      }

      // 边缘检测和优化
      const edgeCells = new Set<string>();
      const edgeThreshold = 30; // RGB距离阈值，超过则认为是边缘（更敏感）
      
      for (let y = 0; y < gridHeight; y++) {
        for (let x = 0; x < gridWidth; x++) {
          const colorIndex = pixels[y][x];
          if (colorIndex < 0) continue; // 跳过透明格子
          
          const currentColor = beadColors[colorIndex];
          let isEdge = false;
          
          // 检查周围8个格子
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              
              const ny = y + dy;
              const nx = x + dx;
              
              if (ny >= 0 && ny < gridHeight && nx >= 0 && nx < gridWidth) {
                const neighborIndex = pixels[ny][nx];
                if (neighborIndex < 0) {
                  // 邻居是透明格子，当前格子是边缘
                  isEdge = true;
                  break;
                }
                
                const neighborColor = beadColors[neighborIndex];
                const dist = colorDistance(currentColor, neighborColor);
                
                if (dist > edgeThreshold) {
                  isEdge = true;
                  break;
                }
              } else {
                // 边界格子，认为是边缘
                isEdge = true;
                break;
              }
            }
            if (isEdge) break;
          }
          
          if (isEdge) {
            edgeCells.add(`${x},${y}`);
          }
        }
      }
      
      // 对边缘格子重新用全像素平均采样（更准确）
      for (const key of edgeCells) {
        const [x, y] = key.split(',').map(Number);
        
        const startX = x * cellWidth;
        const startY = y * cellHeight;
        const endX = Math.min((x + 1) * cellWidth, canvas.width);
        const endY = Math.min((y + 1) * cellHeight, canvas.height);
        
        let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
        let pixelCount = 0;
        
        // 全像素平均采样
        for (let py = startY; py < endY; py++) {
          for (let px = startX; px < endX; px++) {
            const color = getPixelColor(px, py);
            totalR += color.r;
            totalG += color.g;
            totalB += color.b;
            totalA += color.a;
            pixelCount++;
          }
        }
        
        if (pixelCount > 0) {
          const r = Math.round(totalR / pixelCount);
          const g = Math.round(totalG / pixelCount);
          const b = Math.round(totalB / pixelCount);
          const a = Math.round(totalA / pixelCount);
          
          if (a > 10) {
            // 统一使用 CIEDE2000 匹配（最准确）
            const newColorIndex = findClosestBeadColor(r, g, b);
            pixels[y][x] = newColorIndex;
            gridColors[y][x] = beadColors[newColorIndex];
          }
        }
      }

      // Calculate color statistics
      const stats = new Map<number, number>();
      pixels.forEach(row => {
        row.forEach((colorIndex, x) => {
          if (colorIndex >= 0) {
            const count = stats.get(colorIndex) || 0;
            stats.set(colorIndex, count + 1);
          }
        });
      });
      
      // 边缘格子的颜色给予额外权重（每个边缘格子额外算3次，增强保护）
      edgeCells.forEach(key => {
        const [x, y] = key.split(',').map(Number);
        const colorIndex = pixels[y][x];
        if (colorIndex >= 0) {
          const count = stats.get(colorIndex) || 0;
          stats.set(colorIndex, count + 3); // 额外权重从1次增加到3次
        }
      });

      // 根据颜色模式计算最大颜色数
      let maxColors: number;
      if (colorMode === 'simple') {
        // 简化模式：15色
        maxColors = 15;
      } else if (colorMode === 'standard') {
        // 标准模式：30色
        maxColors = 30;
      } else if (colorMode === 'accurate') {
        // 精准模式：不限制（最多221色）
        maxColors = 221;
      } else if (colorMode === 'custom') {
        // 自定义模式
        maxColors = customMaxColors;
      } else {
        // 默认简化模式
        maxColors = 15;
      }

      // Process colors based on color mode
      // 所有采样模式都使用简单截断+相近色合并策略，参数调整（减少杂色）
      let colorMap: Map<number, number>;

      colorMap = limitColorsSimple(stats, beadColors, maxColors, 10, edgeCells, pixels);
      
      // 应用颜色映射
      const finalPixels = pixels.map(row =>
        row.map(colorIndex => {
          if (colorIndex < 0) return -1;
          return colorMap.get(colorIndex) ?? colorIndex;
        })
      );
      
      // 重新计算统计
      const finalStats = new Map<number, number>();
      finalPixels.forEach(row => {
        row.forEach(colorIndex => {
          if (colorIndex >= 0) {
            const count = finalStats.get(colorIndex) || 0;
            finalStats.set(colorIndex, count + 1);
          }
        });
      });

      const finalGridColors = finalPixels.map(row =>
        row.map(colorIndex => colorIndex >= 0 ? beadColors[colorIndex] : {
          colorName: '',
          colorCode: '',
          hex: '#FFFFFF',
          r: 255,
          g: 255,
          b: 255
        })
      );

      setColorStats(finalStats);
      setPixelGrid({ width: gridWidth, height: gridHeight, pixels: finalPixels, gridColors: finalGridColors });

      setIsProcessing(false);
    };

    img.onerror = () => {
      setIsProcessing(false);
      alert('图片加载失败');
    };

    img.src = uploadedImage;
  };

  const renderBeadGrid = () => {
    if (!pixelGrid || !canvasRef.current || !uploadedImage) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseCellSize = 40; // 提高格子大小以增加清晰度
    const labelPadding = 50; // 标签区域padding

    // Calculate legend dimensions
    const colorList = Array.from(colorStats.entries())
      .map(([index, count]) => ({
        colorCode: beadColors[index]?.colorCode || '',
        hex: beadColors[index]?.hex || '#FFFFFF',
        count
      }))
      .sort((a, b) => b.count - a.count);

    const totalBeads = colorList.reduce((sum, item) => sum + item.count, 0);

    const legendPadding = 40;
    const itemHeight = 35;
    const minItemWidth = 120; // 最小图例项宽度，确保不重叠
    const itemsPerRow = 10; // 固定每行10个
    
    // 计算图例所需宽度
    const legendRequiredWidth = itemsPerRow * minItemWidth + legendPadding * 2;
    const gridWidth = pixelGrid.width * baseCellSize;
    
    // 画布宽度取网格宽度和图例所需宽度的较大值
    const canvasWidth = Math.max(gridWidth + labelPadding * 2, legendRequiredWidth + labelPadding * 2);
    const itemWidth = Math.floor((canvasWidth - labelPadding * 2 - legendPadding * 2) / itemsPerRow);
    
    const legendRows = Math.ceil(colorList.length / itemsPerRow);
    const legendHeight = legendPadding * 2 + legendRows * itemHeight + 80;

    canvas.width = canvasWidth;
    canvas.height = pixelGrid.height * baseCellSize + labelPadding * 2 + legendHeight;

    const cellSize = baseCellSize;
    // 居中显示网格
    const offsetX = (canvasWidth - gridWidth) / 2;
    const offsetY = labelPadding;
    const patternWidth = pixelGrid.width * baseCellSize;
    const patternHeight = pixelGrid.height * baseCellSize;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid labels on all four sides
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial'; // 序号字体放大
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top column numbers
    for (let x = 0; x < pixelGrid.width; x++) {
      ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY - cellSize / 2);
    }

    // Left row numbers
    ctx.textAlign = 'right';
    for (let y = 0; y < pixelGrid.height; y++) {
      ctx.fillText(`${y + 1}`, offsetX - 5, offsetY + y * cellSize + cellSize / 2);
    }

    // Right row numbers
    ctx.textAlign = 'left';
    for (let y = 0; y < pixelGrid.height; y++) {
      ctx.fillText(`${y + 1}`, offsetX + patternWidth + 5, offsetY + y * cellSize + cellSize / 2);
    }

    // Bottom column numbers
    ctx.textAlign = 'center';
    for (let x = 0; x < pixelGrid.width; x++) {
      ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY + patternHeight + cellSize / 2);
    }

    // Draw bead cells
    for (let y = 0; y < pixelGrid.height; y++) {
      for (let x = 0; x < pixelGrid.width; x++) {
        const colorIndex = pixelGrid.pixels[y][x];
        const beadColor = pixelGrid.gridColors?.[y][x];

        if (colorIndex >= 0 && beadColor) {
          ctx.fillStyle = beadColor.hex;
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        } else {
          ctx.clearRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw grid lines
    if (showGridLines) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;

      for (let x = 0; x <= pixelGrid.width; x++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x * cellSize, offsetY);
        ctx.lineTo(offsetX + x * cellSize, offsetY + patternHeight);
        ctx.stroke();
      }

      for (let y = 0; y <= pixelGrid.height; y++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y * cellSize);
        ctx.lineTo(offsetX + pixelGrid.width * cellSize, offsetY + y * cellSize);
        ctx.stroke();
      }
    }

    // Draw color codes
    if (showColorCodes) {
      for (let y = 0; y < pixelGrid.height; y++) {
        for (let x = 0; x < pixelGrid.width; x++) {
          const colorIndex = pixelGrid.pixels[y][x];
          const beadColor = pixelGrid.gridColors?.[y][x];

          if (colorIndex >= 0 && beadColor) {
            // 使用 beadColor 中预先计算的 r, g, b 值
            const luminance = (0.299 * beadColor.r + 0.587 * beadColor.g + 0.114 * beadColor.b) / 255;
            ctx.fillStyle = luminance > 0.5 ? '#000000' : '#ffffff';
            ctx.font = `bold ${Math.max(10, Math.floor(cellSize * 0.4))}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(beadColor.colorCode, offsetX + x * cellSize + cellSize / 2, offsetY + y * cellSize + cellSize / 2);
          }
        }
      }
    }

    // Draw legend area
    if (colorList.length > 0) {
      const legendY = offsetY + patternHeight + labelPadding;

      ctx.fillStyle = '#F8F9FA';
      ctx.fillRect(0, legendY, canvas.width, legendHeight);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`拼豆色号图例 (${colorList.length}种色号, 共${totalBeads}个拼豆)`, canvas.width / 2, legendY + 40);

      colorList.forEach((item, index) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;

        // 图例从画布左边开始绘制，独立于网格位置
        const x = legendPadding + col * itemWidth;
        const y = legendY + legendPadding + 50 + row * itemHeight;

        // 绘制色块
        ctx.fillStyle = item.hex;
        ctx.fillRect(x, y - 14, 28, 28);
        ctx.strokeStyle = '#CCCCCC';
        ctx.strokeRect(x, y - 14, 28, 28);

        // 色号和数量在同一横排显示
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.colorCode} (${item.count})`, x + 35, y + 2);
      });
    }
  };

  // 渲染拼豆效果预览（不带色号标注）
  const renderBeadEffect = () => {
    if (!pixelGrid || !effectCanvasRef.current || !uploadedImage) return;

    const canvas = effectCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const baseCellSize = 40; // 提高格子大小以增加清晰度
    const labelPadding = 50; // 标签区域padding

    // Calculate legend dimensions
    const colorList = Array.from(colorStats.entries())
      .map(([index, count]) => ({
        colorCode: beadColors[index]?.colorCode || '',
        hex: beadColors[index]?.hex || '#FFFFFF',
        count
      }))
      .sort((a, b) => b.count - a.count);

    const totalBeads = colorList.reduce((sum, item) => sum + item.count, 0);

    const legendPadding = 40;
    const itemHeight = 35;
    const minItemWidth = 120; // 最小图例项宽度，确保不重叠
    const itemsPerRow = 10; // 固定每行10个
    
    // 计算图例所需宽度
    const legendRequiredWidth = itemsPerRow * minItemWidth + legendPadding * 2;
    const gridWidth = pixelGrid.width * baseCellSize;
    
    // 画布宽度取网格宽度和图例所需宽度的较大值
    const canvasWidth = Math.max(gridWidth + labelPadding * 2, legendRequiredWidth + labelPadding * 2);
    const itemWidth = Math.floor((canvasWidth - labelPadding * 2 - legendPadding * 2) / itemsPerRow);
    
    const legendRows = Math.ceil(colorList.length / itemsPerRow);
    const legendHeight = legendPadding * 2 + legendRows * itemHeight + 80;

    canvas.width = canvasWidth;
    canvas.height = pixelGrid.height * baseCellSize + labelPadding * 2 + legendHeight;

    const cellSize = baseCellSize;
    // 居中显示网格
    const offsetX = (canvasWidth - gridWidth) / 2;
    const offsetY = labelPadding;
    const patternWidth = pixelGrid.width * baseCellSize;
    const patternHeight = pixelGrid.height * baseCellSize;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid labels on all four sides
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 16px Arial'; // 序号字体放大
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Top column numbers
    for (let x = 0; x < pixelGrid.width; x++) {
      ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY - cellSize / 2);
    }

    // Left row numbers
    ctx.textAlign = 'right';
    for (let y = 0; y < pixelGrid.height; y++) {
      ctx.fillText(`${y + 1}`, offsetX - 5, offsetY + y * cellSize + cellSize / 2);
    }

    // Right row numbers
    ctx.textAlign = 'left';
    for (let y = 0; y < pixelGrid.height; y++) {
      ctx.fillText(`${y + 1}`, offsetX + patternWidth + 5, offsetY + y * cellSize + cellSize / 2);
    }

    // Bottom column numbers
    ctx.textAlign = 'center';
    for (let x = 0; x < pixelGrid.width; x++) {
      ctx.fillText(`${x + 1}`, offsetX + x * cellSize + cellSize / 2, offsetY + patternHeight + cellSize / 2);
    }

    // Draw bead cells (不带色号标注)
    for (let y = 0; y < pixelGrid.height; y++) {
      for (let x = 0; x < pixelGrid.width; x++) {
        const colorIndex = pixelGrid.pixels[y][x];
        const beadColor = pixelGrid.gridColors?.[y][x];

        if (colorIndex >= 0 && beadColor) {
          ctx.fillStyle = beadColor.hex;
          ctx.fillRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        } else {
          ctx.clearRect(offsetX + x * cellSize, offsetY + y * cellSize, cellSize, cellSize);
        }
      }
    }

    // Draw grid lines
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;

    for (let x = 0; x <= pixelGrid.width; x++) {
      ctx.beginPath();
      ctx.moveTo(offsetX + x * cellSize, offsetY);
      ctx.lineTo(offsetX + x * cellSize, offsetY + patternHeight);
      ctx.stroke();
    }

    for (let y = 0; y <= pixelGrid.height; y++) {
      ctx.beginPath();
      ctx.moveTo(offsetX, offsetY + y * cellSize);
      ctx.lineTo(offsetX + pixelGrid.width * cellSize, offsetY + y * cellSize);
      ctx.stroke();
    }

    // 不绘制色号文字 - 这是与 renderBeadGrid 的区别

    // Draw legend area
    if (colorList.length > 0) {
      const legendY = offsetY + patternHeight + labelPadding;

      ctx.fillStyle = '#F8F9FA';
      ctx.fillRect(0, legendY, canvas.width, legendHeight);

      ctx.fillStyle = '#000000';
      ctx.font = 'bold 24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`拼豆色号图例 (${colorList.length}种色号, 共${totalBeads}个拼豆)`, canvas.width / 2, legendY + 40);

      colorList.forEach((item, index) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;

        // 图例从画布左边开始绘制，独立于网格位置
        const x = legendPadding + col * itemWidth;
        const y = legendY + legendPadding + 50 + row * itemHeight;

        // 绘制色块
        ctx.fillStyle = item.hex;
        ctx.fillRect(x, y - 14, 28, 28);
        ctx.strokeStyle = '#CCCCCC';
        ctx.strokeRect(x, y - 14, 28, 28);

        // 色号和数量在同一横排显示
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(`${item.colorCode} (${item.count})`, x + 35, y + 2);
      });
    }
  };

  const exportImage = () => {
    if (!canvasRef.current || !pixelGrid || colorStats.size === 0) return;

    const link = document.createElement('a');
    link.download = 'bead-pattern-with-legend.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    renderBeadGrid();
    renderBeadEffect();
  }, [pixelGrid, showGridLines, showColorCodes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            自助拼豆图纸生成器
          </h1>
          <p className="text-gray-600">
            上传图片，自动转成拼豆图纸
          </p>
        </div>

        {/* 使用说明 */}
        <Card className="mb-6 p-6 bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold mb-3 text-blue-900">📖 使用说明</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>1. 选择采样方式：</strong>单点采样取中心点颜色，5点/9点采样取多点平均值，适合色彩渐变图片</p>
            <p><strong>2. 上传图片：</strong>点击或拖拽上传您想要转换的图片</p>
            <p><strong>3. 设置网格尺寸：</strong>设置网格大小（如 25×25、52×52），支持非正方形</p>
            <p><strong>4. 选择匹配模式：</strong>专业模式使用 Lab 色彩空间，匹配更准确</p>
            <p><strong>5. 生成图纸：</strong>点击"生成拼豆图纸"按钮，自动匹配拼豆色号</p>
            <p><strong>6. 导出结果：</strong>支持导出高清 PNG 图纸和色号统计表</p>
            <p className="text-xs text-blue-600 mt-2">💡 提示：建议上传对比度高、色彩清晰的图片，效果更佳</p>
          </div>
        </Card>

        {/* 设置 - 放在使用说明下方 */}
        <Card className="mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">设置</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label>网格尺寸</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor="grid-width-v2" className="text-sm text-gray-600">
                    宽度
                  </Label>
                  <Input
                    id="grid-width-v2"
                    type="number"
                    min={1}
                    max={200}
                    value={gridWidth === 0 ? '' : gridWidth}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setGridWidth(0);
                        return;
                      }
                      const numValue = Number(value);
                      if (!isNaN(numValue) && numValue >= 1 && numValue <= 200) {
                        setGridWidth(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = Number(value);
                      if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 200) {
                        setGridWidth(52);
                      }
                    }}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="grid-height-v2" className="text-sm text-gray-600">
                    高度
                  </Label>
                  <Input
                    id="grid-height-v2"
                    type="number"
                    min={1}
                    max={200}
                    value={gridHeight === 0 ? '' : gridHeight}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '') {
                        setGridHeight(0);
                        return;
                      }
                      const numValue = Number(value);
                      if (!isNaN(numValue) && numValue >= 1 && numValue <= 200) {
                        setGridHeight(numValue);
                      }
                    }}
                    onBlur={(e) => {
                      const value = e.target.value;
                      const numValue = Number(value);
                      if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 200) {
                        setGridHeight(52);
                      }
                    }}
                    className="mt-1"
                  />
                </div>
              </div>
              {/* Quick select buttons */}
              <div className="mt-3">
                <p className="text-xs text-gray-500 mb-2">快速选择常用尺寸：</p>
                <div className="flex flex-wrap gap-2">
                  {[25, 52, 100].map((size) => (
                    <Button
                      key={size}
                      variant={gridWidth === size && gridHeight === size ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setGridWidth(size);
                        setGridHeight(size);
                      }}
                    >
                      {size}×{size}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                输入网格宽度和高度（1-200），支持非正方形网格
              </p>
            </div>

            <div>
              <Label>颜色匹配准确度</Label>
              <div className="mt-2 space-y-2">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="color-accuracy-v2"
                    value="enhanced"
                    checked={colorMatchAccuracy === 'enhanced'}
                    onChange={(e) => setColorMatchAccuracy(e.target.value as 'standard' | 'enhanced')}
                    className="text-purple-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium">专业模式</span> - Lab色彩空间 + CIEDE2000算法
                  </span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    name="color-accuracy-v2"
                    value="standard"
                    checked={colorMatchAccuracy === 'standard'}
                    onChange={(e) => setColorMatchAccuracy(e.target.value as 'standard' | 'enhanced')}
                    className="text-purple-600"
                  />
                  <span className="text-sm">
                    <span className="font-medium">标准模式</span> - 感知加权RGB距离
                  </span>
                </label>
              </div>
              <div className="mt-4">
                <Label>采样方式</Label>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant={samplingMode === 'single' ? 'default' : 'outline'}
                    size="sm"
                    className={samplingMode === 'single' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => handleSamplingModeChange('single')}
                  >
                    单点
                  </Button>
                  <Button
                    variant={samplingMode === 'multi5' ? 'default' : 'outline'}
                    size="sm"
                    className={samplingMode === 'multi5' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => handleSamplingModeChange('multi5')}
                  >
                    5点
                  </Button>
                  <Button
                    variant={samplingMode === 'multi9' ? 'default' : 'outline'}
                    size="sm"
                    className={samplingMode === 'multi9' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => handleSamplingModeChange('multi9')}
                  >
                    9点
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  单点取中心颜色，多点取平均值
                </p>
              </div>
              <div className="mt-4">
                <Label>颜色模式</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    variant={colorMode === 'simple' ? 'default' : 'outline'}
                    size="sm"
                    className={colorMode === 'simple' ? 'bg-green-600 hover:bg-green-700' : ''}
                    onClick={() => setColorMode('simple')}
                  >
                    简化 (15色)
                  </Button>
                  <Button
                    variant={colorMode === 'standard' ? 'default' : 'outline'}
                    size="sm"
                    className={colorMode === 'standard' ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => setColorMode('standard')}
                  >
                    标准 (30色)
                  </Button>
                  <Button
                    variant={colorMode === 'accurate' ? 'default' : 'outline'}
                    size="sm"
                    className={colorMode === 'accurate' ? 'bg-purple-600 hover:bg-purple-700' : ''}
                    onClick={() => setColorMode('accurate')}
                  >
                    精准 (不限制)
                  </Button>
                  <Button
                    variant={colorMode === 'custom' ? 'default' : 'outline'}
                    size="sm"
                    className={colorMode === 'custom' ? 'bg-orange-600 hover:bg-orange-700' : ''}
                    onClick={() => setColorMode('custom')}
                  >
                    自定义
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  简化模式适合卡通/Logo，标准适合照片，精准适合复杂图案
                </p>
                {!pixelGrid && uploadedImage && (
                  <p className="text-xs text-orange-600 mt-1 font-medium">
                    ⚠️ 颜色模式已改变，请重新生成图纸
                  </p>
                )}
              </div>
              <div className="mt-4">
                <Label htmlFor="custom-max-colors">自定义最大颜色数（选择自定义模式时生效）</Label>
                <Input
                  id="custom-max-colors"
                  type="number"
                  min={1}
                  max={221}
                  value={customMaxColors}
                  onChange={(e) => {
                    const value = e.target.value;
                    const numValue = Number(value);
                    if (!isNaN(numValue) && numValue >= 1 && numValue <= 221) {
                      setCustomMaxColors(numValue);
                    }
                  }}
                  onBlur={(e) => {
                    const value = e.target.value;
                    const numValue = Number(value);
                    if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 221) {
                      setCustomMaxColors(15);
                    }
                  }}
                  className="mt-1"
                  placeholder="1-221"
                  disabled={colorMode !== 'custom'}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {colorMode === 'custom' ? '当前使用自定义颜色数' : '选择"自定义"模式后生效（1-221）'}
                </p>
              </div>
              <div className="mt-4">
                <Label>图片大小</Label>
                <div className="mt-2 flex gap-2">
                  <Button
                    variant={upscaleFactor === 1 ? 'default' : 'outline'}
                    size="sm"
                    className={upscaleFactor === 1 ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => setUpscaleFactor(1)}
                  >
                    1倍（原图）
                  </Button>
                  <Button
                    variant={upscaleFactor === 1.2 ? 'default' : 'outline'}
                    size="sm"
                    className={upscaleFactor === 1.2 ? 'bg-blue-600 hover:bg-blue-700' : ''}
                    onClick={() => setUpscaleFactor(1.2)}
                  >
                    1.2倍（大图）
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  1.2倍将图片放大后处理，细节更丰富
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <Button
                onClick={detectGridAndProcess}
                disabled={!uploadedImage || isProcessing}
                className="w-full"
                size="lg"
              >
                {isProcessing ? '处理中...' : '生成拼豆图纸'}
              </Button>
              {pixelGrid && (
                <Button
                  onClick={exportImage}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                  size="lg"
                >
                  <Download className="w-4 h-4 mr-2" />
                  导出拼豆图纸
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* 上传图片和拼豆效果预览 - 并排显示 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 上传图片 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">上传图片</h2>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                id="image-upload-v2"
              />
              <label
                htmlFor="image-upload-v2"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="w-12 h-12 text-gray-400" />
                <span className="text-sm text-gray-600">
                  点击上传或拖拽图片到这里
                </span>
              </label>
            </div>
            {uploadedImage && (
              <div className="mt-4">
                <p className="text-sm text-gray-600 mb-2">原始图片预览:</p>
                <img
                  src={uploadedImage}
                  alt="Uploaded"
                  className="max-w-full h-auto rounded-lg border"
                />
              </div>
            )}
          </Card>

          {/* 拼豆效果预览 */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">拼豆效果预览</h2>
            <div className="border rounded-lg bg-white p-4">
              {pixelGrid ? (
                <canvas
                  ref={effectCanvasRef}
                  className="w-full h-auto"
                  style={{ imageRendering: 'crisp-edges' }}
                />
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-400">
                  <p>上传图片并点击"生成拼豆图纸"</p>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* 视图控制 */}
        <Card className="mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4">视图控制</h2>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Grid3x3 className="w-4 h-4" />
                <span className="text-sm">显示网格线</span>
              </div>
              <Switch
                checked={showGridLines}
                onCheckedChange={setShowGridLines}
              />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Type className="w-4 h-4" />
                <span className="text-sm">显示色号</span>
              </div>
              <Switch
                checked={showColorCodes}
                onCheckedChange={setShowColorCodes}
              />
            </div>
          </div>
        </Card>

        {/* 拼豆图纸预览 */}
        <Card className="mb-6 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">拼豆图纸预览</h2>
            {pixelGrid && (
              <Button
                onClick={exportImage}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                <Download className="w-4 h-4 mr-2" />
                导出拼豆图纸
              </Button>
            )}
          </div>
          <div className="border rounded-lg bg-white p-4">
            {pixelGrid ? (
              <canvas
                ref={canvasRef}
                className="w-full h-auto"
                style={{ imageRendering: 'crisp-edges' }}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-400">
                <p>上传图片并点击"生成拼豆图纸"</p>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
