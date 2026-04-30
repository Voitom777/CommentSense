import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CommentSense | 宠物品牌评论智能分析",
  description: "AI-powered review analysis and response drafting workspace for pet brands."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
