// MARD色号与HEX色值映射表
// 数据来源: 表格_20260304.csv

export interface MardColor {
  code: string;
  hex: string;
}

// 完整的MARD色号映射表
export const MARD_COLORS: MardColor[] = [
  // A系列 - 黄色/米色系
  { code: 'A1', hex: '#FAF5CD' },
  { code: 'A2', hex: '#FCFED6' },
  { code: 'A3', hex: '#FCFF92' },
  { code: 'A4', hex: '#F7EC5C' },
  { code: 'A5', hex: '#F0D83A' },
  { code: 'A6', hex: '#FDA951' },
  { code: 'A7', hex: '#FA8C4F' },
  { code: 'A8', hex: '#FBDA4D' },
  { code: 'A9', hex: '#F79D5F' },
  { code: 'A10', hex: '#F47E38' },
  { code: 'A11', hex: '#FEDB99' },
  { code: 'A12', hex: '#FDA276' },
  { code: 'A13', hex: '#FEC667' },
  { code: 'A14', hex: '#F75842' },
  { code: 'A15', hex: '#FBF65E' },
  { code: 'A16', hex: '#FEFF97' },
  { code: 'A17', hex: '#FDE173' },
  { code: 'A18', hex: '#FCBF80' },
  { code: 'A19', hex: '#FD7E77' },
  { code: 'A20', hex: '#F9D66E' },
  { code: 'A21', hex: '#FAE393' },
  { code: 'A22', hex: '#EDF878' },
  { code: 'A23', hex: '#E4C8BA' },
  { code: 'A24', hex: '#F3F6A9' },
  { code: 'A25', hex: '#FFD785' },
  { code: 'A26', hex: '#FFC734' },
  
  // B系列 - 绿色系
  { code: 'B1', hex: '#DFF13B' },
  { code: 'B2', hex: '#64F343' },
  { code: 'B3', hex: '#A1F586' },
  { code: 'B4', hex: '#5FDF34' },
  { code: 'B5', hex: '#39E158' },
  { code: 'B6', hex: '#64EA04' },
  { code: 'B7', hex: '#3EAE7C' },
  { code: 'B8', hex: '#1D9B54' },
  { code: 'B9', hex: '#2A5037' },
  { code: 'B10', hex: '#9AD1BA' },
  { code: 'B11', hex: '#627032' },
  { code: 'B12', hex: '#1A6E3D' },
  { code: 'B13', hex: '#C8E87D' },
  { code: 'B14', hex: '#ABE84F' },
  { code: 'B15', hex: '#305335' },
  { code: 'B16', hex: '#C0ED4F' },
  { code: 'B17', hex: '#9EB33E' },
  { code: 'B18', hex: '#E6ED4F' },
  { code: 'B19', hex: '#8B8B8E' },
  { code: 'B20', hex: '#CBECCF' },
  { code: 'B21', hex: '#18616A' },
  { code: 'B22', hex: '#0A4241' },
  { code: 'B23', hex: '#343B1A' },
  { code: 'B24', hex: '#E8FAA6' },
  { code: 'B25', hex: '#4E846D' },
  { code: 'B26', hex: '#907C35' },
  { code: 'B27', hex: '#D0DEF9' },
  { code: 'B28', hex: '#9EE5BB' },
  { code: 'B29', hex: '#C6DF5F' },
  { code: 'B30', hex: '#E3FBB1' },
  { code: 'B31', hex: '#B4E691' },
  { code: 'B32', hex: '#92B060' },
  
  // C系列 - 蓝色/青色系
  { code: 'C1', hex: '#F0FEE4' },
  { code: 'C2', hex: '#ABF8FE' },
  { code: 'C3', hex: '#1AE0F7' },
  { code: 'C4', hex: '#44CDFB' },
  { code: 'C5', hex: '#06AADF' },
  { code: 'C6', hex: '#54A7E9' },
  { code: 'C7', hex: '#3977CA' },
  { code: 'C8', hex: '#0F52BD' },
  { code: 'C9', hex: '#3349C3' },
  { code: 'C10', hex: '#3CBCE3' },
  { code: 'C11', hex: '#2ADED3' },
  { code: 'C12', hex: '#1E334E' },
  { code: 'C13', hex: '#CDE7FE' },
  { code: 'C14', hex: '#D5FCF7' },
  { code: 'C15', hex: '#21C5C4' },
  { code: 'C16', hex: '#1858A2' },
  { code: 'C17', hex: '#02D1F3' },
  { code: 'C18', hex: '#213244' },
  { code: 'C19', hex: '#18869D' },
  { code: 'C20', hex: '#1A70A9' },
  { code: 'C21', hex: '#BCDFFC' },
  { code: 'C22', hex: '#6BB1BB' },
  { code: 'C23', hex: '#C8E2FD' },
  { code: 'C24', hex: '#7EC5F9' },
  { code: 'C25', hex: '#A9E8E0' },
  { code: 'C26', hex: '#42ADCF' },
  { code: 'C27', hex: '#D0DECF' },
  { code: 'C28', hex: '#CECEE8' },
  { code: 'C29', hex: '#364A89' },
  
  // D系列 - 紫色系
  { code: 'D1', hex: '#ACB7EF' },
  { code: 'D2', hex: '#868DD3' },
  { code: 'D3', hex: '#3554AF' },
  { code: 'D4', hex: '#162DB7' },
  { code: 'D5', hex: '#B34EC6' },
  { code: 'D6', hex: '#B37BDC' },
  { code: 'D7', hex: '#8758A9' },
  { code: 'D8', hex: '#E3D2FE' },
  { code: 'D9', hex: '#D5B9F4' },
  { code: 'D10', hex: '#301A49' },
  { code: 'D11', hex: '#BEB9E2' },
  { code: 'D12', hex: '#DC99CE' },
  { code: 'D13', hex: '#B5038D' },
  { code: 'D14', hex: '#862993' },
  { code: 'D15', hex: '#2F1F8C' },
  { code: 'D16', hex: '#E2E4F0' },
  { code: 'D17', hex: '#C7D3F9' },
  { code: 'D18', hex: '#9A64B8' },
  { code: 'D19', hex: '#D8C2D9' },
  { code: 'D20', hex: '#9A35AD' },
  { code: 'D21', hex: '#940595' },
  { code: 'D22', hex: '#38389A' },
  { code: 'D23', hex: '#EADBF8' },
  { code: 'D24', hex: '#768AE1' },
  { code: 'D25', hex: '#4950C2' },
  { code: 'D26', hex: '#D6C6EB' },
  
  // E系列 - 粉色系
  { code: 'E1', hex: '#F6D4CB' },
  { code: 'E2', hex: '#FCC1DD' },
  { code: 'E3', hex: '#F6BDE8' },
  { code: 'E4', hex: '#E8649E' },
  { code: 'E5', hex: '#F0569F' },
  { code: 'E6', hex: '#EB4172' },
  { code: 'E7', hex: '#C53674' },
  { code: 'E8', hex: '#FDB9E1' },
  { code: 'E9', hex: '#E376C7' },
  { code: 'E10', hex: '#D13B95' },
  { code: 'E11', hex: '#F7DAD4' },
  { code: 'E12', hex: '#F693BF' },
  { code: 'E13', hex: '#B5016A' },
  { code: 'E14', hex: '#FAD4BF' },
  { code: 'E15', hex: '#F5C9CA' },
  { code: 'E16', hex: '#FBF4EC' },
  { code: 'E17', hex: '#F7E3EC' },
  { code: 'E18', hex: '#F9C8D1' },
  { code: 'E19', hex: '#F6BBD1' },
  { code: 'E20', hex: '#D7C6CE' },
  { code: 'E21', hex: '#C09DA4' },
  { code: 'E22', hex: '#B38C9F' },
  { code: 'E23', hex: '#937D8A' },
  { code: 'E24', hex: '#DEBEE5' },
  { code: 'E25', hex: '#4950C2' },
  
  // F系列 - 红色系
  { code: 'F1', hex: '#FE9381' },
  { code: 'F2', hex: '#F63D4B' },
  { code: 'F3', hex: '#EE4E3E' },
  { code: 'F4', hex: '#FB2A40' },
  { code: 'F5', hex: '#E10328' },
  { code: 'F6', hex: '#913635' },
  { code: 'F7', hex: '#911932' },
  { code: 'F8', hex: '#BB0126' },
  { code: 'F9', hex: '#E0677A' },
  { code: 'F10', hex: '#874628' },
  { code: 'F11', hex: '#592323' },
  { code: 'F12', hex: '#F5363B' },
  { code: 'F13', hex: '#F45C45' },
  { code: 'F14', hex: '#FCADB2' },
  { code: 'F15', hex: '#D50527' },
  { code: 'F16', hex: '#F8C0A9' },
  { code: 'F17', hex: '#E89B7D' },
  { code: 'F18', hex: '#D07F4A' },
  { code: 'F19', hex: '#BE454A' },
  { code: 'F20', hex: '#C69495' },
  { code: 'F21', hex: '#F2B8C6' },
  { code: 'F22', hex: '#F7C3D0' },
  { code: 'F23', hex: '#ED806C' },
  { code: 'F24', hex: '#E09DAF' },
  { code: 'F25', hex: '#E84854' },
  
  // G系列 - 橙色/棕色系
  { code: 'G1', hex: '#FFE4D3' },
  { code: 'G2', hex: '#FCC6AC' },
  { code: 'G3', hex: '#F1C4A5' },
  { code: 'G4', hex: '#DCB387' },
  { code: 'G5', hex: '#E7B34E' },
  { code: 'G6', hex: '#E3A014' },
  { code: 'G7', hex: '#985C3A' },
  { code: 'G8', hex: '#713D2F' },
  { code: 'G9', hex: '#E4B685' },
  { code: 'G10', hex: '#DA8C42' },
  { code: 'G11', hex: '#DAC898' },
  { code: 'G12', hex: '#FEC993' },
  { code: 'G13', hex: '#B2714B' },
  { code: 'G14', hex: '#8B684C' },
  { code: 'G15', hex: '#F6F8E3' },
  { code: 'G16', hex: '#F2D8C1' },
  { code: 'G17', hex: '#77544E' },
  { code: 'G18', hex: '#FFE3D5' },
  { code: 'G19', hex: '#DD7D41' },
  { code: 'G20', hex: '#A5452F' },
  { code: 'G21', hex: '#B38561' },
  
  // H系列 - 灰色/白色/黑色系
  { code: 'H1', hex: '#FFFFFF' },
  { code: 'H2', hex: '#FBFBFB' },
  { code: 'H3', hex: '#B4B4B4' },
  { code: 'H4', hex: '#878787' },
  { code: 'H5', hex: '#464648' },
  { code: 'H6', hex: '#2C2C2C' },
  { code: 'H7', hex: '#010101' },
  { code: 'H8', hex: '#E7D6DC' },
  { code: 'H9', hex: '#EFEDEE' },
  { code: 'H10', hex: '#EBEBEB' },
  { code: 'H11', hex: '#CDCDCD' },
  { code: 'H12', hex: '#FDF6EE' },
  { code: 'H13', hex: '#F4EFD1' },
  { code: 'H14', hex: '#CED7D4' },
  { code: 'H15', hex: '#9AA6A6' },
  { code: 'H16', hex: '#1B1213' },
  { code: 'H17', hex: '#F0EEEF' },
  { code: 'H18', hex: '#FCFFF6' },
  { code: 'H19', hex: '#F2EEE5' },
  { code: 'H20', hex: '#96A09F' },
  { code: 'H21', hex: '#F8FBE6' },
  { code: 'H22', hex: '#CACAD2' },
  { code: 'H23', hex: '#9B9C94' },
  
  // M系列 - 灰色/棕色系
  { code: 'M1', hex: '#BBC6B6' },
  { code: 'M2', hex: '#909994' },
  { code: 'M3', hex: '#697E80' },
  { code: 'M4', hex: '#E0D4BC' },
  { code: 'M5', hex: '#D1CCAF' },
  { code: 'M6', hex: '#B0AA86' },
  { code: 'M7', hex: '#B0A796' },
  { code: 'M8', hex: '#AE7F82' },
  { code: 'M9', hex: '#A68862' },
  { code: 'M10', hex: '#C4B3BB' },
  { code: 'M11', hex: '#9E7592' },
  { code: 'M12', hex: '#644A51' },
  { code: 'M13', hex: '#C79266' },
  { code: 'M14', hex: '#C27464' },
  { code: 'M15', hex: '#747D7A' },
];

/**
 * 将RGB颜色转换为CIELAB颜色空间
 * LAB颜色空间更符合人眼感知，颜色距离计算更准确
 */
function rgbToLab(r: number, g: number, bVal: number): { L: number; a: number; b: number } {
  // Step 1: RGB to XYZ (sRGB D65)
  let R = r / 255;
  let G = g / 255;
  let B = bVal / 255;

  // Apply gamma correction (sRGB to linear RGB)
  R = R > 0.04045 ? Math.pow((R + 0.055) / 1.055, 2.4) : R / 12.92;
  G = G > 0.04045 ? Math.pow((G + 0.055) / 1.055, 2.4) : G / 12.92;
  B = B > 0.04045 ? Math.pow((B + 0.055) / 1.055, 2.4) : B / 12.92;

  // Scale to 0-100
  R *= 100;
  G *= 100;
  B *= 100;

  // Observer = 2°, Illuminant = D65
  const X = R * 0.4124564 + G * 0.3575761 + B * 0.1804378;
  const Y = R * 0.2126729 + G * 0.7151522 + B * 0.0721750;
  const Z = R * 0.0193339 + G * 0.1191920 + B * 0.9503041;

  // Step 2: XYZ to LAB
  // Reference white point D65
  const refX = 95.047;
  const refY = 100.000;
  const refZ = 108.883;

  let x = X / refX;
  let y = Y / refY;
  let z = Z / refZ;

  // Apply the f function
  const delta = 6 / 29;
  const f = (t: number) => t > delta * delta * delta ? Math.cbrt(t) : t / (3 * delta * delta) + 4 / 29;

  const fx = f(x);
  const fy = f(y);
  const fz = f(z);

  const L = 116 * fy - 16;
  const a = 500 * (fx - fy);
  const b = 500 * (fy - fz);

  return { L, a, b };
}

/**
 * 计算CIEDE2000色差
 * 这是最准确的色差计算方法，符合人眼感知
 */
function ciede2000(
  L1: number, a1: number, b1: number,
  L2: number, a2: number, b2: number
): number {
  // CIEDE2000 implementation
  const kL = 1, kC = 1, kH = 1;

  const C1 = Math.sqrt(a1 * a1 + b1 * b1);
  const C2 = Math.sqrt(a2 * a2 + b2 * b2);
  const C_mean = (C1 + C2) / 2;

  const G = 0.5 * (1 - Math.sqrt(Math.pow(C_mean, 7) / (Math.pow(C_mean, 7) + Math.pow(25, 7))));

  const a1_prime = a1 * (1 + G);
  const a2_prime = a2 * (1 + G);

  const C1_prime = Math.sqrt(a1_prime * a1_prime + b1 * b1);
  const C2_prime = Math.sqrt(a2_prime * a2_prime + b2 * b2);

  let h1_prime = Math.atan2(b1, a1_prime) * 180 / Math.PI;
  if (h1_prime < 0) h1_prime += 360;

  let h2_prime = Math.atan2(b2, a2_prime) * 180 / Math.PI;
  if (h2_prime < 0) h2_prime += 360;

  const deltaL_prime = L2 - L1;
  const deltaC_prime = C2_prime - C1_prime;

  let deltaH_prime: number;
  if (C1_prime * C2_prime === 0) {
    deltaH_prime = 0;
  } else if (Math.abs(h2_prime - h1_prime) <= 180) {
    deltaH_prime = h2_prime - h1_prime;
  } else if (h2_prime - h1_prime > 180) {
    deltaH_prime = h2_prime - h1_prime - 360;
  } else {
    deltaH_prime = h2_prime - h1_prime + 360;
  }

  const deltaH_prime_rad = 2 * Math.sqrt(C1_prime * C2_prime) * Math.sin(deltaH_prime * Math.PI / 360);
  const deltaH_prime_abs = 2 * Math.sqrt(C1_prime * C2_prime) * Math.abs(Math.sin(deltaH_prime * Math.PI / 360));

  const L_mean = (L1 + L2) / 2;
  const C_prime_mean = (C1_prime + C2_prime) / 2;

  let h_prime_mean: number;
  if (C1_prime * C2_prime === 0) {
    h_prime_mean = h1_prime + h2_prime;
  } else if (Math.abs(h1_prime - h2_prime) <= 180) {
    h_prime_mean = (h1_prime + h2_prime) / 2;
  } else if (h1_prime + h2_prime < 360) {
    h_prime_mean = (h1_prime + h2_prime + 360) / 2;
  } else {
    h_prime_mean = (h1_prime + h2_prime - 360) / 2;
  }

  const T = 1 -
    0.17 * Math.cos((h_prime_mean - 30) * Math.PI / 180) +
    0.24 * Math.cos(2 * h_prime_mean * Math.PI / 180) +
    0.32 * Math.cos((3 * h_prime_mean + 6) * Math.PI / 180) -
    0.20 * Math.cos((4 * h_prime_mean - 63) * Math.PI / 180);

  const SL = 1 + (0.015 * Math.pow(L_mean - 50, 2)) / Math.sqrt(20 + Math.pow(L_mean - 50, 2));
  const SC = 1 + 0.045 * C_prime_mean;
  const SH = 1 + 0.015 * C_prime_mean * T;

  const RT = -2 * Math.sqrt(Math.pow(C_prime_mean, 7) / (Math.pow(C_prime_mean, 7) + Math.pow(25, 7))) *
    Math.sin(60 * Math.exp(-Math.pow((h_prime_mean - 275) / 25, 2)) * Math.PI / 180);

  const deltaE = Math.sqrt(
    Math.pow(deltaL_prime / (kL * SL), 2) +
    Math.pow(deltaC_prime / (kC * SC), 2) +
    Math.pow(deltaH_prime_abs / (kH * SH), 2) +
    RT * (deltaC_prime / (kC * SC)) * (deltaH_prime_abs / (kH * SH))
  );

  return deltaE;
}

/**
 * 计算两个颜色之间的距离（使用LAB颜色空间）
 */
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const lab1 = rgbToLab(r1, g1, b1);
  const lab2 = rgbToLab(r2, g2, b2);
  
  // 使用简化的LAB距离（欧氏距离在LAB空间）
  // 对于更精确的匹配，可以使用CIEDE2000
  return Math.sqrt(
    Math.pow(lab1.L - lab2.L, 2) +
    Math.pow(lab1.a - lab2.a, 2) +
    Math.pow(lab1.b - lab2.b, 2)
  );
}

/**
 * 计算两个颜色之间的CIEDE2000色差（更精确）
 */
function colorDistanceCIEDE2000(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  const lab1 = rgbToLab(r1, g1, b1);
  const lab2 = rgbToLab(r2, g2, b2);
  return ciede2000(lab1.L, lab1.a, lab1.b, lab2.L, lab2.a, lab2.b);
}

/**
 * 将HEX颜色转换为RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 255, g: 255, b: 255 };
}

// 缓存LAB值以提高性能
const MARD_COLORS_LAB = MARD_COLORS.map(color => {
  const rgb = hexToRgb(color.hex);
  const lab = rgbToLab(rgb.r, rgb.g, rgb.b);
  return { ...color, lab, rgb };
});

/**
 * 找到最接近的MARD色号（使用CIEDE2000色差）
 */
export function findClosestMardColor(r: number, g: number, b: number): MardColor {
  const sourceLab = rgbToLab(r, g, b);
  
  let closestColor = MARD_COLORS_LAB[0];
  let minDistance = Infinity;

  for (const color of MARD_COLORS_LAB) {
    // 使用CIEDE2000色差，更精确
    const distance = ciede2000(
      sourceLab.L, sourceLab.a, sourceLab.b,
      color.lab.L, color.lab.a, color.lab.b
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return { code: closestColor.code, hex: closestColor.hex };
}

/**
 * 找到最接近的MARD色号（使用LAB距离，速度更快）
 * 用于需要快速匹配的场景
 */
export function findClosestMardColorFast(r: number, g: number, b: number): MardColor {
  const sourceLab = rgbToLab(r, g, b);
  
  let closestColor = MARD_COLORS_LAB[0];
  let minDistance = Infinity;

  for (const color of MARD_COLORS_LAB) {
    // 使用LAB空间的欧氏距离
    const distance = Math.sqrt(
      Math.pow(sourceLab.L - color.lab.L, 2) +
      Math.pow(sourceLab.a - color.lab.a, 2) +
      Math.pow(sourceLab.b - color.lab.b, 2)
    );
    
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = color;
    }
  }

  return { code: closestColor.code, hex: closestColor.hex };
}
