import { NextRequest, NextResponse } from 'next/server';

// 从 CSV 文件获取的颜色数据（与 perler_VERSION2 完全一致）
const BEAD_COLORS_CSV = `色号,RGB 值,HEX 值,色号,RGB 值,HEX 值,色号,RGB 值,HEX 值,色号,RGB 值,HEX 值,色号,RGB 值,HEX 值
A1,250.245.205,FAF5CD,B1,223.241.59,DFF13B,C1,240.254.228,F0FEE4,D1,172.183.239,ACB7EF,E1,246.212.203,F6D4CB
A2,252.254.214,FCFED6,B2,100.243.67,64F343,C2,171.248.254,ABF8FE,D2,134.141.211,868DD3,E2,252.193.221,FCC1DD
A3,252.255.146,FCFF92,B3,161.245.134,A1F586,C3,26.224.247,1AE0F7,D3,53.84.175,3554AF,E3,246.189.232,F6BDE8
A4,247.236.92,F7EC5C,B4,95.223.52,5FDF34,C4,68.205.251,44CDFB,D4,22.45.123,162DB7,E4,232.100.158,E8649E
A5,240.216.58,F0D83A,B5,57.225.88,39E158,C5,6.170.223,06AADF,D5,179.78.198,B34EC6,E5,240.86.159,F0569F
A6,253.169.81,FDA951,B6,100.224.164,64EA04,C6,84.167.233,54A7E9,D6,179.123.220,B37BDC,E6,235.65.114,EB4172
A7,250.140.79,FA8C4F,B7,62.174.124,3EAE7C,C7,57.119.202,3977CA,D7,135.88.169,8758A9,E7,197.54.116,C53674
A8,251.218.77,FBDA4D,B8,29.155.84,1D9B54,C8,15.82.189,0F52BD,D8,227.210.254,E3D2FE,E8,253.219.233,FDB9E1
A9,247.157.95,F79D5F,B9,42.80.55,2A5037,C9,51.73.195,3349C3,D9,213.185.244,D5B9F4,E9,227.118.199,E376C7
A10,244.126.56,F47E38,B10,154.209.186,9AD1BA,C10,60.188.227,3CBCE3,D10,48.26.73,301A49,E10,209.59.149,D13B95
A11,254.219.153,FEDB99,B11,98.112.50,627032,C11,42.222.211,2ADED3,D11,190.185.226,BEB9E2,E11,247.218.212,F7DAD4
A12,253.162.118,FDA276,B12,26.110.61,1A6E3D,C12,30.51.78,1E334E,D12,220.153.206,DC99CE,E12,246.147.191,F693BF
A13,254.198.103,FEC667,B13,200.232.125,C8E87D,C13,205.231.254,CDE7FE,D13,181.3.141,B5038D,E13,181.1.106,B5016A
A14,247.88.66,F75842,B14,171.232.79,ABE84F,C14,213.252.247,D5FCF7,D14,134.41.147,862993,E14,250.212.191,FAD4BF
A15,251.246.94,FBF65E,B15,48.83.53,305335,C15,33.197.196,21C5C4,D15,47.31.140,2F1F8C,E15,245.201.202,F5C9CA
A16,254.255.151,FEFF97,B16,192.237.79,C0ED4F,C16,24.88.162,1858A2,D16,226.228.240,E2E4F0,E16,251.244.236,FBF4EC
A17,253.225.115,FDE173,B17,158.179.62,9EB33E,C17,2.209.243,02D1F3,D17,199.211.249,C7D3F9,E17,247.227.236,F7E3EC
A18,252.191.128,FCBF80,B18,230.237.79,E6ED4F,C18,33.50.68,213244,D18,154.100.184,9A64B8,E18,249.200.209,F9C8D1
A19,253.126.119,FD7E77,B19,138.138.142,8B8B8E,C19,24.134.157,18869D,D19,216.194.217,D8C2D9,E19,246.187.209,F6BBD1
A20,249.197.103,F9C567,B20,111.170.89,6FAA59,C20,38.190.233,26BEE9,D20,0.0.0,000000,E20,250.220.206,FADCCE
A21,254.230.165,FAE6A5,B21,34.166.103,22A667,C21,48.55.68,303744,D21,255.255.255,FFFFFF,E21,255.255.225,FFFFE1
A22,232.218.170,E8DAAA,B22,124.190.115,7CBE73,,,,,,
A23,203.186.147,CBBA93,B23,180.198.119,B4C677,,,,,,,,,
A24,242.189.100,F2BD64,B24,153.165.83,99A553,,,,,,,,,
A25,216.179.100,D8B364,B25,95.107.65,5F6B41,,,,,,,,,
A26,,,,,,,,,,,,,,,,`;

export interface BeadColor {
  colorName: string;
  colorCode: string;
  hex: string;
  r: number;
  g: number;
  b: number;
}

function parseBeadColors(): BeadColor[] {
  const lines = BEAD_COLORS_CSV.split('\n').filter(line => line.trim());
  const colors: BeadColor[] = [];
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Remove BOM character if present
    const cleanLine = line.replace(/^\uFEFF/, '');
    
    // Split by comma
    const parts = cleanLine.split(',').map(part => part.trim());
    
    // Each line has 5 color groups, each with 3 fields: colorCode, rgb, hex
    for (let j = 0; j < parts.length; j += 3) {
      if (j + 2 >= parts.length) break;
      
      const colorCode = parts[j];
      const rgb = parts[j + 1];
      const hex = parts[j + 2];
      
      // Skip empty entries
      if (!colorCode || colorCode === '-' || rgb === '-' || hex === '-') continue;
      
      // Parse RGB value (format: "250.245.205")
      const rgbNumbers = rgb.split('.').map(n => parseInt(n.trim(), 10));
      let r = 0, g = 0, b = 0;
      
      if (rgbNumbers.length === 3 && !isNaN(rgbNumbers[0])) {
        r = rgbNumbers[0];
        g = rgbNumbers[1];
        b = rgbNumbers[2];
      } else {
        // Fallback: try parsing from hex
        const cleanHex = hex.replace('#', '').trim();
        if (cleanHex.length === 6) {
          r = parseInt(cleanHex.substring(0, 2), 16);
          g = parseInt(cleanHex.substring(2, 4), 16);
          b = parseInt(cleanHex.substring(4, 6), 16);
        }
      }
      
      // Parse hex value
      let cleanHex = hex.replace('#', '').trim();
      if (cleanHex.length === 3) {
        cleanHex = cleanHex.split('').map(c => c + c).join('');
      }
      
      colors.push({
        colorName: colorCode,
        colorCode: colorCode,
        hex: '#' + cleanHex,
        r,
        g,
        b,
      });
    }
  }
  
  return colors;
}

// GET endpoint to fetch bead colors
export async function GET(request: NextRequest) {
  try {
    const colors = parseBeadColors();
    return NextResponse.json(colors);
  } catch (error) {
    console.error('Error parsing bead colors:', error);
    return NextResponse.json(
      { error: 'Failed to parse bead colors' },
      { status: 500 }
    );
  }
}
