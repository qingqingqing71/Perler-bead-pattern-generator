// MARD色号与HEX色值映射表
// 数据来源: Sheet_20260302.csv 系列

export interface MardColor {
  code: string;
  hex: string;
}

// 完整的MARD色号映射表
export const MARD_COLORS: MardColor[] = [
  // A系列 - 黄色系
  { code: 'A1', hex: '#faf5cd' },
  { code: 'A2', hex: '#fcfed6' },
  { code: 'A3', hex: '#fcff92' },
  { code: 'A4', hex: '#fff280' },
  { code: 'A5', hex: '#ffd856' },
  { code: 'A6', hex: '#ffb956' },
  { code: 'A7', hex: '#ff9f56' },
  { code: 'A8', hex: '#ffd256' },
  { code: 'A9', hex: '#ff9f56' },
  { code: 'A10', hex: '#ff8a56' },
  { code: 'A11', hex: '#ffc999' },
  { code: 'A12', hex: '#ffc299' },
  { code: 'A13', hex: '#ffb380' },
  { code: 'A14', hex: '#ff4d4d' },
  { code: 'A15', hex: '#ffcc80' },
  { code: 'A16', hex: '#ffd999' },
  { code: 'A17', hex: '#ffd280' },
  { code: 'A18', hex: '#ffd9b3' },
  { code: 'A19', hex: '#ff9980' },
  { code: 'A20', hex: '#ffdd99' },
  { code: 'A21', hex: '#fff2cc' },
  { code: 'A22', hex: '#fff6d9' },
  { code: 'A23', hex: '#e6d9b3' },
  { code: 'A24', hex: '#fff6cc' },
  { code: 'A25', hex: '#ffd966' },
  { code: 'A26', hex: '#ffcc66' },
  
  // B系列 - 绿色系
  { code: 'B1', hex: '#ffffff' },
  { code: 'B2', hex: '#64f343' },
  { code: 'B3', hex: '#a1f586' },
  { code: 'B4', hex: '#66e066' },
  { code: 'B5', hex: '#44d144' },
  { code: 'B6', hex: '#55c255' },
  { code: 'B7', hex: '#44b344' },
  { code: 'B8', hex: '#33a333' },
  { code: 'B9', hex: '#229322' },
  { code: 'B10', hex: '#88d188' },
  { code: 'B11', hex: '#66a366' },
  { code: 'B12', hex: '#559355' },
  { code: 'B13', hex: '#77b377' },
  { code: 'B14', hex: '#66a366' },
  { code: 'B15', hex: '#559355' },
  { code: 'B16', hex: '#99c399' },
  { code: 'B17', hex: '#b3e0b3' },
  { code: 'B18', hex: '#c3e6c3' },
  { code: 'B19', hex: '#44b344' },
  { code: 'B20', hex: '#33a333' },
  { code: 'B21', hex: '#229322' },
  { code: 'B22', hex: '#118311' },
  { code: 'B23', hex: '#117311' },
  { code: 'B24', hex: '#228322' },
  { code: 'B25', hex: '#448344' },
  { code: 'B26', hex: '#557355' },
  { code: 'B27', hex: '#a3d1a3' },
  { code: 'B28', hex: '#b3e0b3' },
  { code: 'B29', hex: '#c3e6c3' },
  { code: 'B30', hex: '#d3ecd3' },
  { code: 'B31', hex: '#e3f2e3' },
  { code: 'B32', hex: '#f3f8f3' },
  
  // C系列 - 蓝色系
  { code: 'C1', hex: '#c6f2ff' },
  { code: 'C2', hex: '#99e6ff' },
  { code: 'C3', hex: '#66d9ff' },
  { code: 'C4', hex: '#33ccff' },
  { code: 'C5', hex: '#00bfff' },
  { code: 'C6', hex: '#00b3ff' },
  { code: 'C7', hex: '#00a3e6' },
  { code: 'C8', hex: '#0099e6' },
  { code: 'C9', hex: '#008cdb' },
  { code: 'C10', hex: '#0080cc' },
  { code: 'C11', hex: '#66ccff' },
  { code: 'C12', hex: '#33b3e6' },
  { code: 'C13', hex: '#cceeff' },
  { code: 'C14', hex: '#b3e6ff' },
  { code: 'C15', hex: '#44c2e6' },
  { code: 'C16', hex: '#33b3e6' },
  { code: 'C17', hex: '#22a3d9' },
  { code: 'C18', hex: '#1199cc' },
  { code: 'C19', hex: '#008cc0' },
  { code: 'C20', hex: '#0080b3' },
  { code: 'C21', hex: '#88d1e6' },
  { code: 'C22', hex: '#77c2d9' },
  { code: 'C23', hex: '#66b3cc' },
  { code: 'C24', hex: '#55a3bf' },
  { code: 'C25', hex: '#4499b3' },
  { code: 'C26', hex: '#338ca6' },
  { code: 'C27', hex: '#b3e0e6' },
  { code: 'C28', hex: '#a3d1d9' },
  { code: 'C29', hex: '#558cb3' },
  
  // D系列 - 紫色系
  { code: 'D1', hex: '#d1d1ff' },
  { code: 'D2', hex: '#a3a3ff' },
  { code: 'D3', hex: '#7373ff' },
  { code: 'D4', hex: '#4444ff' },
  { code: 'D5', hex: '#b366ff' },
  { code: 'D6', hex: '#cc80ff' },
  { code: 'D7', hex: '#e699ff' },
  { code: 'D8', hex: '#f2b3ff' },
  { code: 'D9', hex: '#f5ccff' },
  { code: 'D10', hex: '#9933cc' },
  { code: 'D11', hex: '#aa44dd' },
  { code: 'D12', hex: '#ffb3d9' },
  { code: 'D13', hex: '#ff66b3' },
  { code: 'D14', hex: '#e64d99' },
  { code: 'D15', hex: '#cc3380' },
  { code: 'D16', hex: '#e6ccff' },
  { code: 'D17', hex: '#d9b3ff' },
  { code: 'D18', hex: '#cc99ff' },
  { code: 'D19', hex: '#bf80ff' },
  { code: 'D20', hex: '#b366ff' },
  { code: 'D21', hex: '#a64dff' },
  { code: 'D22', hex: '#3333cc' },
  { code: 'D23', hex: '#4444dd' },
  { code: 'D24', hex: '#5555ee' },
  { code: 'D25', hex: '#6666ff' },
  { code: 'D26', hex: '#f2e6ff' },
  
  // E系列 - 粉色系
  { code: 'E1', hex: '#ffffff' },
  { code: 'E2', hex: '#ffd9d9' },
  { code: 'E3', hex: '#ffcce6' },
  { code: 'E4', hex: '#ffb3cc' },
  { code: 'E5', hex: '#ff99b3' },
  { code: 'E6', hex: '#ff8099' },
  { code: 'E7', hex: '#ff6680' },
  { code: 'E8', hex: '#ffccd9' },
  { code: 'E9', hex: '#ffb3e6' },
  { code: 'E10', hex: '#ff99cc' },
  { code: 'E11', hex: '#ff80b3' },
  { code: 'E12', hex: '#ff6699' },
  { code: 'E13', hex: '#ff4d80' },
  { code: 'E14', hex: '#ffd9cc' },
  { code: 'E15', hex: '#ffccb3' },
  { code: 'E16', hex: '#ffbf99' },
  { code: 'E17', hex: '#ffb380' },
  { code: 'E18', hex: '#ffa666' },
  { code: 'E19', hex: '#ff994d' },
  { code: 'E20', hex: '#d9b3b3' },
  { code: 'E21', hex: '#cc9999' },
  { code: 'E22', hex: '#b38080' },
  { code: 'E23', hex: '#996666' },
  { code: 'E24', hex: '#cc99cc' },
  { code: 'E25', hex: '#ff8066' },
  
  // F系列 - 红色系
  { code: 'F1', hex: '#ff7f50' },
  { code: 'F2', hex: '#ff4d4d' },
  { code: 'F3', hex: '#ff3333' },
  { code: 'F4', hex: '#ff1a1a' },
  { code: 'F5', hex: '#ff0000' },
  { code: 'F6', hex: '#cc0000' },
  { code: 'F7', hex: '#b30000' },
  { code: 'F8', hex: '#ff6633' },
  { code: 'F9', hex: '#e65c3c' },
  { code: 'F10', hex: '#cc5233' },
  { code: 'F11', hex: '#b3482d' },
  { code: 'F12', hex: '#993e26' },
  { code: 'F13', hex: '#803420' },
  { code: 'F14', hex: '#ffcccc' },
  { code: 'F15', hex: '#ff0033' },
  { code: 'F16', hex: '#ffd9cc' },
  { code: 'F17', hex: '#ffccb3' },
  { code: 'F18', hex: '#ffbf99' },
  { code: 'F19', hex: '#ffb380' },
  { code: 'F20', hex: '#d9b3a6' },
  { code: 'F21', hex: '#cc998c' },
  { code: 'F22', hex: '#ffd9d9' },
  { code: 'F23', hex: '#ffcccc' },
  { code: 'F24', hex: '#ffb3b3' },
  { code: 'F25', hex: '#ff9999' },
  
  // G系列 - 橙色/棕色系
  { code: 'G1', hex: '#ffebcc' },
  { code: 'G2', hex: '#ffe6cc' },
  { code: 'G3', hex: '#ffddb3' },
  { code: 'G4', hex: '#ffd499' },
  { code: 'G5', hex: '#ffcb80' },
  { code: 'G6', hex: '#ffc266' },
  { code: 'G7', hex: '#e6a866' },
  { code: 'G8', hex: '#cc8f4d' },
  { code: 'G9', hex: '#ffd199' },
  { code: 'G10', hex: '#e6b880' },
  { code: 'G11', hex: '#cc9f66' },
  { code: 'G12', hex: '#ffd9b3' },
  { code: 'G13', hex: '#e6b380' },
  { code: 'G14', hex: '#cc9966' },
  { code: 'G15', hex: '#fff2e6' },
  { code: 'G16', hex: '#e6d9cc' },
  { code: 'G17', hex: '#996633' },
  { code: 'G18', hex: '#cc9966' },
  { code: 'G19', hex: '#e68a33' },
  { code: 'G20', hex: '#cc7a2e' },
  { code: 'G21', hex: '#b36a29' },
  
  // H系列 - 灰色/黑白系
  { code: 'H1', hex: '#ffffff' },
  { code: 'H2', hex: '#ffffff' },
  { code: 'H3', hex: '#d4d4d4' },
  { code: 'H4', hex: '#b3b3b3' },
  { code: 'H5', hex: '#999999' },
  { code: 'H6', hex: '#808080' },
  { code: 'H7', hex: '#000000' },
  { code: 'H8', hex: '#f2f2f2' },
  { code: 'H9', hex: '#e6e6e6' },
  { code: 'H10', hex: '#d9d9d9' },
  { code: 'H11', hex: '#cccccc' },
  { code: 'H12', hex: '#f0f0f0' },
  { code: 'H13', hex: '#f9f9e6' },
  { code: 'H14', hex: '#e6e6e6' },
  { code: 'H15', hex: '#d9d9d9' },
  { code: 'H16', hex: '#000000' },
  { code: 'H17', hex: '#ffffff' },
  { code: 'H18', hex: '#f2f2f2' },
  { code: 'H19', hex: '#e6e6e6' },
  { code: 'H20', hex: '#cccccc' },
  { code: 'H21', hex: '#f9f9f9' },
  { code: 'H22', hex: '#d9d9d9' },
  { code: 'H23', hex: '#cccccc' },
  
  // M系列
  { code: 'M1', hex: '#d9d9cc' },
  { code: 'M2', hex: '#ccccb3' },
  { code: 'M3', hex: '#bfbf99' },
  { code: 'M4', hex: '#d9d2b3' },
  { code: 'M5', hex: '#e6e0cc' },
  { code: 'M6', hex: '#d9d2b3' },
  { code: 'M7', hex: '#ccccb3' },
  { code: 'M8', hex: '#cc9999' },
  { code: 'M9', hex: '#b38066' },
  { code: 'M10', hex: '#ccb3b3' },
  { code: 'M11', hex: '#b380b3' },
  { code: 'M12', hex: '#996666' },
  { code: 'M13', hex: '#cc9966' },
  { code: 'M14', hex: '#b38066' },
  { code: 'M15', hex: '#808080' },
  
  // P系列
  { code: 'P1', hex: '#ffffff' },
  { code: 'P2', hex: '#d4d4d4' },
  { code: 'P3', hex: '#c3e6c3' },
  { code: 'P4', hex: '#ffb3b3' },
  { code: 'P5', hex: '#ff9933' },
  { code: 'P6', hex: '#88e0b3' },
  { code: 'P7', hex: '#f29966' },
  { code: 'P8', hex: '#f9e07f' },
  { code: 'P9', hex: '#e6e6e6' },
  { code: 'P10', hex: '#e6ccff' },
  { code: 'P11', hex: '#f9e6cc' },
  { code: 'P12', hex: '#f2f2f2' },
  { code: 'P13', hex: '#80b3e6' },
  { code: 'P14', hex: '#4d88cc' },
  { code: 'P15', hex: '#e6e6e6' },
  { code: 'P16', hex: '#ffb34d' },
  { code: 'P17', hex: '#ffb380' },
  { code: 'P18', hex: '#ffccb3' },
  { code: 'P19', hex: '#ffd9e6' },
  { code: 'P20', hex: '#ffcce6' },
  { code: 'P21', hex: '#e6b399' },
  { code: 'P22', hex: '#cc8866' },
  { code: 'P23', hex: '#995555' },
  
  // R系列
  { code: 'R1', hex: '#ff0000' },
  { code: 'R2', hex: '#ff3399' },
  { code: 'R3', hex: '#ff8033' },
  { code: 'R4', hex: '#ffcc00' },
  { code: 'R5', hex: '#66e066' },
  { code: 'R6', hex: '#66ccb3' },
  { code: 'R7', hex: '#3399cc' },
  { code: 'R8', hex: '#3380cc' },
  { code: 'R9', hex: '#b366cc' },
  { code: 'R10', hex: '#ffd933' },
  { code: 'R11', hex: '#ffeff6' },
  { code: 'R12', hex: '#d9d9d9' },
  { code: 'R13', hex: '#444444' },
  { code: 'R14', hex: '#b3e6d9' },
  { code: 'R15', hex: '#80c2d9' },
  { code: 'R16', hex: '#80d9cc' },
  { code: 'R17', hex: '#44997f' },
  { code: 'R18', hex: '#88c299' },
  { code: 'R19', hex: '#b3e680' },
  { code: 'R20', hex: '#d9b380' },
  { code: 'R21', hex: '#b3804d' },
  { code: 'R22', hex: '#804d33' },
  { code: 'R23', hex: '#ffb366' },
  { code: 'R24', hex: '#ffd9b3' },
  { code: 'R25', hex: '#cc6666' },
  { code: 'R26', hex: '#e699b3' },
  { code: 'R27', hex: '#ff99b3' },
  { code: 'R28', hex: '#b366b3' },
  
  // T系列
  { code: 'T1', hex: '#ffffff' },
  
  // Y系列
  { code: 'Y1', hex: '#ff84c4' },
  { code: 'Y2', hex: '#ffb366' },
  { code: 'Y3', hex: '#ccff99' },
  { code: 'Y4', hex: '#80d9ff' },
  { code: 'Y5', hex: '#e699e6' },
  
  // Z系列
  { code: 'Z1', hex: '#d9b3b3' },
  { code: 'Z2', hex: '#ccb380' },
  { code: 'Z3', hex: '#d9cc99' },
  { code: 'Z4', hex: '#a3b380' },
  { code: 'Z5', hex: '#6699b3' },
  { code: 'Z6', hex: '#80b3e6' },
  { code: 'Z7', hex: '#f2b3e6' },
  { code: 'Z8', hex: '#b380b3' },
];

// 创建HEX到MARD色号的映射（用于快速查找）
export const HEX_TO_MARD: Map<string, MardColor> = new Map(
  MARD_COLORS.map(c => [c.hex.toLowerCase(), c])
);

// 计算两个颜色之间的距离
function colorDistance(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
  return Math.sqrt(
    Math.pow(r1 - r2, 2) +
    Math.pow(g1 - g2, 2) +
    Math.pow(b1 - b2, 2)
  );
}

// 将HEX颜色转换为RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// 找到最接近的MARD色号
export function findClosestMardColor(r: number, g: number, b: number): MardColor {
  let closestColor = MARD_COLORS[0];
  let minDistance = Infinity;
  
  for (const mardColor of MARD_COLORS) {
    const rgb = hexToRgb(mardColor.hex);
    if (rgb) {
      const distance = colorDistance(r, g, b, rgb.r, rgb.g, rgb.b);
      if (distance < minDistance) {
        minDistance = distance;
        closestColor = mardColor;
      }
    }
  }
  
  return closestColor;
}
