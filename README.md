# CommentSense

宠物品牌用户评论智能分析与回复生成系统。面向 AI 应用岗位的全栈作品集项目，展示从评论数据导入、结构化 AI 分析、品牌语气约束到人工审核回复的完整产品闭环。

## 功能亮点

- **CSV 导入**：拖拽上传宠物品牌评论，支持预览、编码自动检测（UTF-8/GBK）、进度反馈和导入结果可视化
- **AI 分析**：对评论进行情绪分析、主题提取、意图识别、紧急程度判断、摘要生成和置信度评估
- **回复生成**：基于品牌语气自动生成客服回复草稿，涉及宠物健康内容时自动标记风险
- **人工审核**：审核回复草稿，支持编辑内容和确认风险标记，审核通过后标记为已提交
- **CSV 导出**：导出已审核通过的回复，方便批量提交到平台
- **AI 提供方切换**：兼容 OpenAI 接口的模型（DeepSeek、通义千问、智谱等），无 API Key 时自动使用 Mock 模式
- **品牌设置**：在线配置品牌语气、目标受众、违禁词和服务策略

## 技术栈

- **框架**：Next.js 15 App Router + TypeScript
- **样式**：Tailwind CSS v4
- **数据库**：SQLite（本地开发），Prisma ORM
- **校验**：Zod 结构化输出校验
- **测试**：Vitest 单元测试
- **部署**：Vercel（演示模式）

## 本地运行

```bash
npm install
npm run db:init
npm run db:generate
npm run dev
```

打开 `http://localhost:3000` 即可体验。样例 CSV 位于 `public/samples/pet-reviews.csv`。

## 配置 AI

复制 `.env.example` 为 `.env.local` 并填写：

```bash
AI_BASE_URL="https://api.deepseek.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="deepseek-chat"
```

只要供应商兼容 OpenAI Chat Completions 接口，就可以通过这三个变量替换模型。未配置时会使用 Mock 输出，仍可完整体验导入、分析、回复和审核流程。

也可以在页面的「品牌设置」里填写接口地址、模型名称和 API Key，页面配置会优先于环境变量。API Key 不回显到前端，仅保存在当前服务进程内，重启后恢复到环境变量或 Mock 模式。正式部署建议使用环境变量。

## 演示模式

线上部署版（Vercel）以演示模式运行，无持久化数据库，展示内置示例数据。所有页面功能可浏览查看。如需完整功能，请按上述步骤本地运行。

## 项目亮点

- 完整业务工作流，而非单次 prompt 演示：从数据导入到审核导出形成闭环
- AI 输出通过 Zod schema 校验，避免非结构化解析
- Prompt 版本和品牌策略独立建模，便于回归测试和持续迭代
- 对宠物健康场景做保守回复策略，避免医疗诊断式表述
- CSV 导入支持编码自动检测（UTF-8/GBK），零额外依赖
