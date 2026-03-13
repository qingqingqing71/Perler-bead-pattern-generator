import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '自助拼豆图纸生成器',
    template: '%s | 拼豆图纸生成器',
  },
  description:
    '自助拼豆图纸生成器，上传照片自动像素化处理，生成拼豆图纸，一键下载打印。',
  keywords: [
    '拼豆',
    '拼豆图纸',
    '像素画',
    '十字绣',
    '手工制作',
    'DIY',
    '拼豆生成器',
    '像素化',
  ],
  authors: [{ name: 'Qoding Tool' }],
  openGraph: {
    title: '自助拼豆图纸生成器',
    description:
      '上传照片自动像素化处理，生成拼豆图纸，一键下载打印。',
    url: 'https://www.qodingtool.cn',
    siteName: '自助拼豆图纸生成器',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === 'development';

  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
