'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Upload, Download, Grid3x3, Type } from 'lucide-react';

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
  samplingMode?: 'single' | 'multi5';  // 采样模式
  onSamplingModeChange?: (mode: 'single' | 'multi5') => void;  // 切换采样模式的回调
}

export default function PerlerVersion2Page({ onBack, samplingMode = 'single', onSamplingModeChange }: PerlerVersion2PageProps) {
  // 使用 API 获取颜色数据（与 perler_VERSION2 完全一致）
  const [beadColors, setBeadColors] = useState<BeadColor[]>([]);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState(29); // Width in beads
  const [gridHeight, setGridHeight] = useState(29); // Height in beads
  const [pixelGrid, setPixelGrid] = useState<PixelGrid | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showGridLines, setShowGridLines] = useState(true);
  const [showColorCodes, setShowColorCodes] = useState(true);
  const [colorMatchAccuracy, setColorMatchAccuracy] = useState<'standard' | 'enhanced'>('enhanced');
  const [colorStats, setColorStats] = useState<Map<number, number>>(new Map());

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

  const findClosestBeadColor = (r: number, g: number, b: number): number => {
    let minDistance = Infinity;
    let closestIndex = 0;

    if (colorMatchAccuracy === 'enhanced') {
      const inputLab = rgbToLab(r, g, b);

      for (let i = 0; i < beadColors.length; i++) {
        const color = beadColors[i];
        // 使用 beadColors 中预先计算的 RGB 值（与 perler_VERSION2 完全一致）
        const colorLab = rgbToLab(color.r, color.g, color.b);
        const distance = deltaE2000(inputLab, colorLab);

        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
    } else {
      for (let i = 0; i < beadColors.length; i++) {
        const color = beadColors[i];
        // 使用 beadColors 中预先计算的 RGB 值（与 perler_VERSION2 完全一致）
        const dr = r - color.r;
        const dg = g - color.g;
        const db = b - color.b;
        const distance = Math.sqrt(dr * dr * 0.299 + dg * dg * 0.587 + db * db * 0.114);

        if (distance < minDistance) {
          minDistance = distance;
          closestIndex = i;
        }
      }
    }

    return closestIndex;
  };

  const detectGridAndProcess = async () => {
    if (!uploadedImage || beadColors.length === 0) return;

    setIsProcessing(true);

    const img = new Image();
    img.onload = () => {
      // Step 1: Create square canvas
      const squareSize = Math.max(img.width, img.height);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      canvas.width = squareSize;
      canvas.height = squareSize;

      // Fill white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw image centered
      const offsetX = (squareSize - img.width) / 2;
      const offsetY = (squareSize - img.height) / 2;
      ctx.drawImage(img, offsetX, offsetY);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

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
          } else {
            // 5点采样：中心 + 四角（只计算非透明点）
            const points = [
              { x: centerX, y: centerY },                              // 中心
              { x: startX, y: startY },                                // 左上角
              { x: endX - 1, y: startY },                              // 右上角
              { x: startX, y: endY - 1 },                              // 左下角
              { x: endX - 1, y: endY - 1 }                             // 右下角
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
          }

          if (a >= 128) {
            const colorIndex = findClosestBeadColor(r, g, b);
            row.push(colorIndex);
            colorRow.push(beadColors[colorIndex]);
          } else {
            // 透明像素 - 与 perler_VERSION2 完全一致
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

      // Calculate color statistics
      const stats = new Map<number, number>();
      pixels.forEach(row => {
        row.forEach(colorIndex => {
          if (colorIndex >= 0) {
            const count = stats.get(colorIndex) || 0;
            stats.set(colorIndex, count + 1);
          }
        });
      });

      // Limit to max 20 bead colors
      const MAX_COLORS = 20;
      if (stats.size > MAX_COLORS) {
        const sortedColors = Array.from(stats.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, MAX_COLORS)
          .map(entry => entry[0]);

        const topColorSet = new Set(sortedColors);

        // Remap all colors to the top 20 (使用 beadColors 中预先计算的 RGB 值)
        const remappedPixels = pixels.map(row =>
          row.map(colorIndex => {
            if (colorIndex < 0) return -1;
            if (topColorSet.has(colorIndex)) return colorIndex;

            const currentColor = beadColors[colorIndex];
            let minDistance = Infinity;
            let closestIndex = colorIndex;

            sortedColors.forEach(topIndex => {
              const topColor = beadColors[topIndex];
              // 使用 beadColors 中预先计算的 RGB 值（与 perler_VERSION2 完全一致）
              const distance = Math.sqrt(
                Math.pow(currentColor.r - topColor.r, 2) +
                Math.pow(currentColor.g - topColor.g, 2) +
                Math.pow(currentColor.b - topColor.b, 2)
              );

              if (distance < minDistance) {
                minDistance = distance;
                closestIndex = topIndex;
              }
            });

            return closestIndex;
          })
        );

        // Recalculate stats
        const newStats = new Map<number, number>();
        remappedPixels.forEach(row => {
          row.forEach(colorIndex => {
            if (colorIndex >= 0) {
              const count = newStats.get(colorIndex) || 0;
              newStats.set(colorIndex, count + 1);
            }
          });
        });

        const newGridColors = remappedPixels.map(row =>
          row.map(colorIndex => colorIndex >= 0 ? beadColors[colorIndex] : {
            colorName: '',
            colorCode: '',
            hex: '#FFFFFF',
            r: 255,
            g: 255,
            b: 255
          })
        );

        setColorStats(newStats);
        setPixelGrid({ width: gridWidth, height: gridHeight, pixels: remappedPixels, gridColors: newGridColors });
      } else {
        setColorStats(stats);
        setPixelGrid({ width: gridWidth, height: gridHeight, pixels, gridColors });
      }

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

    const baseCellSize = 20;
    const labelPadding = 30;

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
    const itemHeight = 50;
    const itemWidth = 200;
    const itemsPerRow = Math.floor((pixelGrid.width * baseCellSize - legendPadding * 2) / itemWidth);
    const legendRows = Math.ceil(colorList.length / itemsPerRow);
    const legendHeight = legendPadding * 2 + legendRows * itemHeight + 60;

    canvas.width = pixelGrid.width * baseCellSize + labelPadding * 2;
    canvas.height = pixelGrid.height * baseCellSize + labelPadding * 2 + legendHeight;

    const cellSize = baseCellSize;
    const offsetX = labelPadding;
    const offsetY = labelPadding;
    const patternWidth = pixelGrid.width * baseCellSize;
    const patternHeight = pixelGrid.height * baseCellSize;

    // Fill white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid labels on all four sides
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px Arial';
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
            ctx.font = `bold ${Math.max(8, Math.floor(cellSize * 0.35))}px Arial`;
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
      ctx.font = 'bold 20px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(`拼豆色号图例 (${colorList.length}种色号, 共${totalBeads}个拼豆)`, canvas.width / 2, legendY + 35);

      colorList.forEach((item, index) => {
        const row = Math.floor(index / itemsPerRow);
        const col = index % itemsPerRow;

        const x = offsetX + legendPadding + col * itemWidth;
        const y = legendY + legendPadding + 40 + row * itemHeight;

        ctx.fillStyle = item.hex;
        ctx.fillRect(x, y - 15, 30, 30);
        ctx.strokeStyle = '#CCCCCC';
        ctx.strokeRect(x, y - 15, 30, 30);

        ctx.fillStyle = '#000000';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(item.colorCode, x + 40, y);

        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'right';
        ctx.fillText(`${item.count}个`, x + itemWidth - 10, y + 8);
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

  const exportColorList = () => {
    if (!pixelGrid || colorStats.size === 0) return;

    const colorList = Array.from(colorStats.entries())
      .map(([index, count]) => ({
        colorCode: beadColors[index]?.colorCode || '',
        hex: beadColors[index]?.hex || '#FFFFFF',
        count
      }))
      .sort((a, b) => b.count - a.count);

    const header = '拼豆色号统计表\n' + '='.repeat(40) + '\n\n';
    const summary = `总计使用色号: ${colorList.length}\n拼豆总数: ${colorList.reduce((sum, item) => sum + item.count, 0)}\n\n`;
    const content = colorList.map(c => `${c.colorCode} (${c.hex}): ${c.count} 个`).join('\n');

    const blob = new Blob([header + summary + content], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = 'bead-color-list.txt';
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  useEffect(() => {
    renderBeadGrid();
  }, [pixelGrid, showGridLines, showColorCodes]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            像素图纸转拼豆图纸
          </h1>
          <p className="text-gray-600">
            上传像素图片，自动转换为拼豆图纸
          </p>
        </div>

        {/* 使用说明 */}
        <Card className="mb-6 p-6 bg-blue-50 border-blue-200">
          <h2 className="text-lg font-semibold mb-3 text-blue-900">📖 使用说明</h2>
          <div className="space-y-2 text-sm text-blue-800">
            <p><strong>1. 上传图片：</strong>点击或拖拽上传您想要转换的像素风格图片</p>
            <p><strong>2. 设置网格尺寸：</strong>设置网格大小（必须为正方形，如 29x29、52x52）</p>
            <p><strong>3. 选择匹配模式：</strong>专业模式使用 Lab 色彩空间，匹配更准确</p>
            <p><strong>4. 生成图纸：</strong>点击"生成拼豆图纸"按钮，自动匹配拼豆色号</p>
            <p><strong>5. 预览与导出：</strong>预览图纸包含色号图例，支持导出高清 PNG 和色号统计表</p>
            <p className="text-xs text-blue-600 mt-2">💡 提示：建议上传对比度高、色彩清晰的图片，效果更佳</p>
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Panel - Upload and Settings */}
          <div className="space-y-6">
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

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">设置</h2>

              <div className="space-y-4">
                <div>
                  <Label>网格尺寸（正方形）</Label>
                  <div className="mt-2">
                    <Label htmlFor="grid-width-v2" className="text-sm text-gray-600">
                      尺寸（宽=高）
                    </Label>
                    <Input
                      id="grid-width-v2"
                      type="number"
                      min={1}
                      max={100}
                      value={gridWidth === 0 ? '' : gridWidth}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '') {
                          setGridWidth(0);
                          setGridHeight(0);
                          return;
                        }
                        const numValue = Number(value);
                        if (!isNaN(numValue) && numValue >= 1 && numValue <= 100) {
                          setGridWidth(numValue);
                          setGridHeight(numValue);
                        }
                      }}
                      onBlur={(e) => {
                        const value = e.target.value;
                        const numValue = Number(value);
                        if (value === '' || isNaN(numValue) || numValue < 1 || numValue > 100) {
                          setGridWidth(29);
                          setGridHeight(29);
                        }
                      }}
                      className="mt-1"
                    />
                  </div>

                  {/* Quick select buttons */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">快速选择常用尺寸：</p>
                    <div className="flex flex-wrap gap-2">
                      {[25, 29, 52, 100].map((size) => (
                        <Button
                          key={size}
                          variant={gridWidth === size ? 'default' : 'outline'}
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
                    网格必须为正方形，输入任意尺寸（1-100），宽和高自动保持一致
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
                        <span className="font-medium">专业模式</span> - Lab色彩空间 + CIEDE2000算法，最准确
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
                  <p className="text-xs text-gray-500 mt-2">
                    专业模式使用工业标准的CIEDE2000算法。每个网格使用中心像素颜色，不使用平均值。
                  </p>
                </div>

                <Button
                  onClick={detectGridAndProcess}
                  disabled={!uploadedImage || isProcessing}
                  className="w-full"
                  size="lg"
                >
                  {isProcessing ? '处理中...' : '生成拼豆图纸'}
                </Button>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">视图控制</h2>

              <div className="space-y-4">
                <Label>显示选项</Label>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Grid3x3 className="w-4 h-4" />
                    <span className="text-sm">显示网格线</span>
                  </div>
                  <Switch
                    checked={showGridLines}
                    onCheckedChange={setShowGridLines}
                  />
                </div>

                <div className="flex items-center justify-between">
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
          </div>

          {/* Right Panel - Preview and Export */}
          <div className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-semibold mb-4">拼豆图纸预览</h2>

              <div className="border rounded-lg bg-white p-4">
                {pixelGrid ? (
                  <canvas
                    ref={canvasRef}
                    className="w-full h-auto"
                  />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-400">
                    <p>上传图片并点击"生成拼豆图纸"</p>
                  </div>
                )}
              </div>

              {pixelGrid && (
                <div className="mt-4 flex gap-3">
                  <Button
                    onClick={exportImage}
                    className="flex-1"
                    variant="default"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出图片
                  </Button>
                  <Button
                    onClick={exportColorList}
                    className="flex-1"
                    variant="outline"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    导出色号表
                  </Button>
                </div>
              )}
            </Card>

            {pixelGrid && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">图纸信息</h2>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600">网格尺寸</p>
                    <p className="font-semibold">
                      {pixelGrid.width} x {pixelGrid.height}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">拼豆数量</p>
                    <p className="font-semibold">
                      {pixelGrid.pixels.flat().filter(c => c >= 0).length}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">使用颜色数</p>
                    <p className="font-semibold">
                      {new Set(pixelGrid.pixels.flat()).size - 1}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600">可用色号</p>
                    <p className="font-semibold">{beadColors.length}</p>
                  </div>
                </div>
              </Card>
            )}

            {pixelGrid && colorStats.size > 0 && (
              <Card className="p-6">
                <h2 className="text-xl font-semibold mb-4">拼豆色号图例</h2>

                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {Array.from(colorStats.entries())
                    .sort((a, b) => b[1] - a[1])
                    .map(([colorIndex, count]) => {
                      const beadColor = beadColors[colorIndex];
                      if (!beadColor) return null;

                      return (
                        <div
                          key={colorIndex}
                          className="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                        >
                          <div
                            className="w-10 h-10 rounded-lg border-2 border-gray-300 flex-shrink-0"
                            style={{ backgroundColor: beadColor.hex }}
                          />

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-base">
                                {beadColor.colorCode}
                              </span>
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              {beadColor.hex}
                            </div>
                          </div>

                          <div className="flex-shrink-0">
                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800">
                              {count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">
                      总计使用色号: <span className="font-semibold">{colorStats.size}</span>
                    </span>
                    <span className="text-gray-600">
                      拼豆总数: <span className="font-semibold">
                        {Array.from(colorStats.values()).reduce((sum, count) => sum + count, 0)}
                      </span>
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
