# CommentSense

宠物品牌用户评论智能分析 & 回复生成系统。这个项目是面向 AI 应用岗位投递的全栈作品集 Demo，展示从评论数据导入、结构化 AI 分析、品牌语气约束到人工审核回复的完整产品闭环。

## What It Shows

- CSV 导入宠物品牌评论，允许缺失平台、产品、评分、作者和时间等可选字段。
- AI 分析评论情绪、主题、意图、紧急程度、摘要和置信度。
- 根据品牌语气生成客服回复草稿，涉及宠物健康内容时自动打风险标记。
- 人工审核回复，支持编辑、批准、驳回和导出已批准 CSV。
- OpenAI-compatible AI adapter，可接入 DeepSeek、通义千问、智谱、Moonshot 等国内模型；没有 API key 时自动走 mock，方便演示。

## Tech Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4 + custom operational dashboard styling
- Prisma schema for PostgreSQL deployment
- Zod validation for AI structured output
- Vitest unit tests

## Getting Started

```bash
npm install
npm run db:init
npm run db:generate
npm run dev
```

打开 `http://localhost:3000` 即可体验。样例 CSV 位于 `public/samples/pet-reviews.csv`。

## AI Provider

复制 `.env.example` 为 `.env.local` 并配置：

```bash
AI_BASE_URL="https://api.deepseek.com/v1"
AI_API_KEY="your-api-key"
AI_MODEL="deepseek-chat"
```

只要供应商兼容 OpenAI Chat Completions 接口，就可以通过这三个变量替换模型。未配置时会使用 mock 输出，仍可完整演示导入、分析、回复和审核流程。

也可以在页面的「品牌设置」里填写接口地址、模型名称和 API Key。页面配置会优先于环境变量，用于本地 Demo 快速测试真实模型；API Key 不会回显到前端，但只保存在当前 Node.js 服务进程内，重启后会恢复到环境变量或 Mock 模式。正式部署建议使用环境变量配置。

保存页面配置后，可以点击「测试连通」确认接口、模型和 API Key 是否能正常返回可解析 JSON。回复工作台会在每条回复上显示生成来源，例如真实模型名称或 `Mock`，方便区分当前回复是否来自模型调用。

## Database

`prisma/schema.prisma` 定义了本地 SQLite 数据模型：`Review`、`AnalysisResult`、`ReplyDraft`、`BrandProfile`、`PromptVersion`、`ImportBatch` 和 `AiConfig`。运行 `npm run db:init` 会创建 `prisma/dev.db`，新增评论、回复草稿和页面 AI 配置都会持久化到这个文件。接 Neon 或 Supabase 时，可以把 datasource 切回 PostgreSQL 并迁移 JSON 字段。

## Scripts

```bash
npm run dev      # local development
npm run build    # production build
npm run test     # unit tests
npm run db:init  # create local SQLite tables
npm run db:generate # generate Prisma Client
```

## Portfolio Talking Points

- 不是单次 prompt demo，而是带审核状态、风险标记和导出的业务工作流。
- AI 输出使用 schema 校验，避免 unstructured parsing。
- prompt 版本和品牌策略独立建模，便于回归测试和持续迭代。
- 对宠物健康场景做保守回复策略，避免医疗诊断式表述。
