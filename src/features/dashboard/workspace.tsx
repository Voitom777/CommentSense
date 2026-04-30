"use client";

import {
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileUp,
  MessageSquareText,
  RefreshCcw,
  Search,
  Settings,
  Sparkles
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import type {
  AiConfigStatus,
  AnalysisResult,
  BrandProfile,
  BusyOperation,
  ImportResult,
  ReplyDraft,
  ReplyFilter,
  Review,
  Sentiment
} from "@/shared/types";
import { formatUnknown, mergeBy, readJsonResponse, toPercent } from "@/shared/lib/utils";

type WorkspaceProps = {
  initialReviews: Review[];
  initialAnalyses: AnalysisResult[];
  initialReplies: ReplyDraft[];
  brand: BrandProfile;
};

type Tab = "dashboard" | "import" | "reviews" | "insights" | "replies" | "settings";

const tabs: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "总览", icon: <BarChart3 size={16} /> },
  { id: "import", label: "导入", icon: <FileUp size={16} /> },
  { id: "reviews", label: "评论池", icon: <Search size={16} /> },
  { id: "insights", label: "洞察", icon: <Sparkles size={16} /> },
  { id: "replies", label: "回复工作台", icon: <MessageSquareText size={16} /> },
  { id: "settings", label: "品牌设置", icon: <Settings size={16} /> }
];

const sentimentLabels: Record<Sentiment, string> = {
  positive: "正向",
  neutral: "中性",
  negative: "负向",
  mixed: "混合"
};

const urgencyLabels = {
  low: "低",
  medium: "中",
  high: "高",
  critical: "紧急"
} as const;

const replyStatusLabels = {
  draft: "草稿",
  needs_review: "需审核",
  approved: "已批准",
  rejected: "已驳回"
} as const;

const riskFlagLabels: Record<string, string> = {
  health_related: "健康相关",
  unsafe_promise: "不当承诺",
  forbidden_word: "命中禁用词"
};

const replyLengthLabels = {
  short: "较短",
  medium: "适中",
  long: "较长"
} as const;

export function Workspace({ initialReviews, initialAnalyses, initialReplies, brand }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [reviews, setReviews] = useState(initialReviews);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [replies, setReplies] = useState(initialReplies);
  const [selected, setSelected] = useState<string[]>(initialReviews.slice(0, 4).map((review) => review.id));
  const [query, setQuery] = useState("");
  const [sentiment, setSentiment] = useState<"all" | Sentiment>("all");
  const [replyFilter, setReplyFilter] = useState<ReplyFilter>("all");
  const [busy, setBusy] = useState<BusyOperation | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [operationError, setOperationError] = useState("");
  const [operationNotice, setOperationNotice] = useState("");
  const [generatingReplyCount, setGeneratingReplyCount] = useState(0);
  const [generatingReviewIds, setGeneratingReviewIds] = useState<string[]>([]);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const [replyStudioTab, setReplyStudioTab] = useState<"pending" | "approved">("pending");
  const [aiConfig, setAiConfig] = useState<AiConfigStatus>({
    mode: "mock",
    hasApiKey: false,
    sourceLabel: "Mock"
  });

  useEffect(() => {
    fetch("/api/ai/config")
      .then((response) => response.json())
      .then((config: AiConfigStatus) => setAiConfig(config))
      .catch(() => {
        setAiConfig({ mode: "mock", hasApiKey: false, sourceLabel: "Mock" });
      });
  }, []);

  const analysisByReview = useMemo(
    () => new Map(analyses.map((analysis) => [analysis.reviewId, analysis])),
    [analyses]
  );

  const filteredReviews = useMemo(() => {
    const replyMap = new Map(replies.map((r) => [r.reviewId, r]));
    return reviews.filter((review) => {
      const analysis = analysisByReview.get(review.id);
      const matchesSentiment = sentiment === "all" || analysis?.sentiment === sentiment;
      const matchesQuery =
        query.trim().length === 0 ||
        [review.content, review.platform, review.productName, review.author]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query.toLowerCase()));
      const reply = replyMap.get(review.id);
      const matchesReplyFilter =
        replyFilter === "all" ||
        (replyFilter === "unreplied" && !reply) ||
        (replyFilter === "generating" && generatingReviewIds.includes(review.id)) ||
        (replyFilter === "pending_review" && reply && reply.status === "needs_review") ||
        (replyFilter === "approved" && reply && reply.status === "approved");

      return matchesSentiment && matchesQuery && matchesReplyFilter;
    });
  }, [analysisByReview, query, reviews, sentiment, replies, replyFilter, generatingReviewIds]);

  const metrics = useMemo(() => {
    const negative = analyses.filter((analysis) => analysis.sentiment === "negative").length;
    const urgent = analyses.filter((analysis) => ["high", "critical"].includes(analysis.urgency)).length;
    const approved = replies.filter((reply) => reply.status === "approved").length;

    return {
      total: reviews.length,
      analyzed: analyses.length,
      negative,
      urgent,
      approved
    };
  }, [analyses, replies, reviews.length]);

  const topicCounts = useMemo(() => {
    const counts = new Map<string, number>();
    analyses.flatMap((analysis) => analysis.topics).forEach((topic) => counts.set(topic, (counts.get(topic) ?? 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [analyses]);

  const filteredReviewIds = useMemo(() => filteredReviews.map((review) => review.id), [filteredReviews]);
  const selectedFilteredCount = useMemo(
    () => filteredReviewIds.filter((id) => selected.includes(id)).length,
    [filteredReviewIds, selected]
  );

  function toggleSelected(reviewId: string) {
    setSelected((current) =>
      current.includes(reviewId) ? current.filter((id) => id !== reviewId) : [...current, reviewId]
    );
  }

  function toggleFilteredSelection() {
    if (filteredReviewIds.length === 0) {
      return;
    }

    const allFilteredSelected = filteredReviewIds.every((id) => selected.includes(id));
    setSelected((current) => {
      if (allFilteredSelected) {
        return current.filter((id) => !filteredReviewIds.includes(id));
      }

      return Array.from(new Set([...current, ...filteredReviewIds]));
    });
  }

  async function uploadCsv(file?: File) {
    if (!file) return;
    setBusy("import");
    setOperationError("");
    setOperationNotice("");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await fetch("/api/import/reviews", { method: "POST", body: formData });
      const result = (await readJsonResponse(response)) as ImportResult;
      setImportResult(result);
      setReviews((current) => [...result.reviews, ...current]);
      setSelected(result.reviews.map((review) => review.id));
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "导入失败，请检查 CSV 格式。");
    } finally {
      setBusy(null);
    }
  }

  async function analyzeSelected() {
    if (selected.length === 0) return;
    setBusy("analyze");
    setAnalyzingCount(selected.length);
    setOperationError("");
    setOperationNotice("");

    try {
      const response = await fetch("/api/reviews/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: selected })
      });
      const payload = (await readJsonResponse(response)) as { analyses: AnalysisResult[] };
      setAnalyses((current) => mergeBy(current, payload.analyses, "reviewId"));
      setOperationNotice(`分析完成，已分析 ${payload.analyses.length} 条评论。`);
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "分析失败，请检查模型配置。");
    } finally {
      setBusy(null);
      setAnalyzingCount(0);
    }
  }

  async function generateReplies() {
    if (selected.length === 0) return;
    setBusy("reply");
    setGeneratingReviewIds(selected);
    setGeneratingReplyCount(selected.length);
    setOperationError("");
    setOperationNotice(`${selected.length} 条评论回复生成中`);

    try {
      const response = await fetch("/api/replies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: selected })
      });
      const payload = (await readJsonResponse(response)) as { replies: ReplyDraft[] };
      setReplies((current) => mergeBy(current, payload.replies, "id"));
      setOperationNotice(`${payload.replies.length} 条回复已生成，已进入回复工作台。`);
      setActiveTab("replies");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "生成回复失败，请检查模型配置。");
    } finally {
      setGeneratingReplyCount(0);
      setGeneratingReviewIds([]);
      setBusy(null);
    }
  }

  async function updateReply(replyId: string, patch: Partial<ReplyDraft>) {
    try {
      const response = await fetch(`/api/replies/${replyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = (await readJsonResponse(response)) as { reply: ReplyDraft };
      setReplies((current) => mergeBy(current, [payload.reply], "id"));
      setOperationNotice("回复已更新。");
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "更新回复失败。");
    }
  }

  return (
    <main className="app-shell">
      <div className="workspace">
        <header className="topbar">
          <div className="brand-block">
            <h1>宠物品牌评论智能分析 & 回复生成系统</h1>
            <p>
              为品牌运营和客服团队设计的 AI 工作台：导入评论、识别情绪与痛点、生成可审核回复，并保留 prompt
              版本、结构化校验和人工确认流程。
            </p>
          </div>
          <div className="status-strip">
            <span className="pill">模型：{formatAiModel(aiConfig)}</span>
            <span className="pill">品牌：{brand.name}</span>
            <span className="pill">审核优先</span>
          </div>
        </header>

        <nav className="nav-tabs" aria-label="工作台导航">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        {operationError && <div className="error-banner">{operationError}</div>}
        {operationNotice && !operationError && <div className="notice-banner">{operationNotice}</div>}

        {activeTab === "dashboard" && (
          <Dashboard
            metrics={metrics}
            analyses={analyses}
            topicCounts={topicCounts}
            urgentReviews={reviews.filter((review) => ["high", "critical"].includes(analysisByReview.get(review.id)?.urgency ?? ""))}
          />
        )}

        {activeTab === "import" && (
          <section className="panel">
            <div className="panel-header">
              <h2>CSV 导入</h2>
              <a className="secondary-button" href="/samples/pet-reviews.csv" download>
                <Download size={16} />
                下载样例
              </a>
            </div>
            <div className="import-box">
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => uploadCsv(event.target.files?.[0])}
                disabled={busy === "import"}
              />
              <p>
                必填字段为评论内容（content）；平台、产品名、评分、作者、评论时间等字段可缺失。
              </p>
              {importResult && (
                <div>
                  <strong>导入完成：{importResult.acceptedRows} 条成功，{importResult.rejectedRows} 条失败</strong>
                  {importResult.errors.map((error) => (
                    <p key={error}>{error}</p>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {activeTab === "reviews" && (
          <section className="panel">
            <div className="panel-header">
              <h2>评论池</h2>
              <ActionButtons
                busy={busy}
                filteredCount={filteredReviews.length}
                selectedCount={selected.length}
                selectedFilteredCount={selectedFilteredCount}
                onAnalyze={analyzeSelected}
                onReply={generateReplies}
                onToggleFiltered={toggleFilteredSelection}
              />
            </div>
            <div className="toolbar">
              <input
                className="search-input"
                placeholder="搜索评论、平台、产品或作者"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <select
                className="select-input"
                value={sentiment}
                onChange={(event) => setSentiment(event.target.value as "all" | Sentiment)}
              >
                <option value="all">全部情绪</option>
                <option value="positive">正向</option>
                <option value="neutral">中性</option>
                <option value="negative">负向</option>
                <option value="mixed">混合</option>
              </select>
              <select
                className="select-input"
                value={replyFilter}
                onChange={(event) => setReplyFilter(event.target.value as ReplyFilter)}
              >
                <option value="all">全部回复状态</option>
                <option value="unreplied">未回复</option>
                <option value="generating">生成中</option>
                <option value="pending_review">待审核</option>
                <option value="approved">已回复</option>
              </select>
            </div>
            <ReviewList
              reviews={filteredReviews}
              selected={selected}
              analyses={analysisByReview}
              replies={replies}
              generatingReviewIds={generatingReviewIds}
              onToggle={toggleSelected}
            />
          </section>
        )}

        {activeTab === "insights" && (
          <Insights analyses={analyses} reviews={reviews} topicCounts={topicCounts} analysisByReview={analysisByReview} />
        )}

        {activeTab === "replies" && (
          <ReplyStudio
            replies={replies}
            reviews={reviews}
            onUpdate={updateReply}
            onGenerate={generateReplies}
            busy={busy}
            generatingCount={generatingReplyCount}
            selectedCount={selected.length}
            replyStudioTab={replyStudioTab}
            onReplyStudioTabChange={setReplyStudioTab}
          />
        )}

        {activeTab === "settings" && <BrandSettings brand={brand} aiConfig={aiConfig} onAiConfigChange={setAiConfig} />}
      </div>
    </main>
  );
}

function Dashboard({
  metrics,
  analyses,
  topicCounts,
  urgentReviews
}: {
  metrics: { total: number; analyzed: number; negative: number; urgent: number; approved: number };
  analyses: AnalysisResult[];
  topicCounts: Array<[string, number]>;
  urgentReviews: Review[];
}) {
  const sentimentCounts = useMemo(() =>
    (["positive", "neutral", "negative", "mixed"] as const).map((item) => {
      const count = analyses.filter((analysis) => analysis.sentiment === item).length;
      return [item, count] as const;
    }),
    [analyses]
  );

  return (
    <section>
      <div className="metric-grid">
        <Metric label="评论总量" value={metrics.total} />
        <Metric label="已分析" value={metrics.analyzed} />
        <Metric label="高优先级" value={metrics.urgent} />
        <Metric label="已批准回复" value={metrics.approved} />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>情绪分布</h2>
            <span className="pill">结构化输出校验</span>
          </div>
          {sentimentCounts.map(([key, count]) => (
            <Bar key={key} label={sentimentLabels[key as Sentiment]} value={count} max={Math.max(1, analyses.length)} />
          ))}
          <div className="panel-header" style={{ marginTop: 22 }}>
            <h2>高频主题</h2>
          </div>
          {topicCounts.slice(0, 5).map(([topic, count]) => (
            <Bar key={topic} label={topic} value={count} max={Math.max(1, topicCounts[0]?.[1] ?? 1)} />
          ))}
        </div>
        <div className="panel">
          <div className="panel-header">
            <h2>紧急评论</h2>
            <AlertTriangle size={18} />
          </div>
          <div className="insight-list">
            {urgentReviews.length === 0 && <div className="empty-state">暂无高优先级评论</div>}
            {urgentReviews.map((review) => (
              <div className="review-card" key={review.id}>
                <div className="card-title">{formatUnknown(review.productName)}</div>
                <p>{review.content}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: toPercent(value / max) }} />
      </div>
      <span>{value}</span>
    </div>
  );
}

function ActionButtons({
  busy,
  filteredCount,
  selectedCount,
  selectedFilteredCount,
  onAnalyze,
  onReply,
  onToggleFiltered
}: {
  busy: string | null;
  filteredCount: number;
  selectedCount: number;
  selectedFilteredCount: number;
  onAnalyze: () => void;
  onReply: () => void;
  onToggleFiltered: () => void;
}) {
  return (
    <div className="toolbar" style={{ marginBottom: 0 }}>
      <button className="secondary-button" disabled={filteredCount === 0 || Boolean(busy)} onClick={onToggleFiltered} type="button">
        {selectedFilteredCount === filteredCount && filteredCount > 0 ? "取消当前筛选" : "全选当前筛选"}（
        {selectedFilteredCount}/{filteredCount}）
      </button>
      <button className="secondary-button" disabled={selectedCount === 0 || Boolean(busy)} onClick={onAnalyze} type="button">
        <RefreshCcw size={16} />
        分析 {selectedCount}
      </button>
      <button className="primary-button" disabled={selectedCount === 0 || Boolean(busy)} onClick={onReply} type="button">
        <Sparkles size={16} />
        生成回复
      </button>
    </div>
  );
}

function ReviewList({
  reviews,
  selected,
  analyses,
  replies,
  generatingReviewIds,
  onToggle
}: {
  reviews: Review[];
  selected: string[];
  analyses: Map<string, AnalysisResult>;
  replies: ReplyDraft[];
  generatingReviewIds: string[];
  onToggle: (id: string) => void;
}) {
  const replyMap = useMemo(() => new Map(replies.map((r) => [r.reviewId, r])), [replies]);

  if (reviews.length === 0) {
    return <div className="empty-state">没有符合筛选条件的评论</div>;
  }

  function getReplyStatusLabel(reviewId: string) {
    if (generatingReviewIds.includes(reviewId)) return "生成中";
    const reply = replyMap.get(reviewId);
    if (!reply) return null;
    if (reply.status === "approved") return "已回复";
    if (reply.status === "needs_review") return "待审核";
    return "草稿";
  }

  return (
    <div className="review-list">
      {reviews.map((review) => {
        const analysis = analyses.get(review.id);
        const replyStatusLabel = getReplyStatusLabel(review.id);
        return (
          <article className="review-card" key={review.id}>
            <div className="card-head">
              <div>
                <div className="card-title">
                  <input
                    aria-label="选择评论"
                    checked={selected.includes(review.id)}
                    onChange={() => onToggle(review.id)}
                    type="checkbox"
                  />
                  {formatUnknown(review.productName)}
                  <span className="tag">{formatUnknown(review.platform)}</span>
                  <span className="tag">{formatUnknown(review.rating)} 星</span>
                </div>
                <p>{review.content}</p>
              </div>
              <div className="card-head-right">
                {analysis && (
                  <span className={`pill sentiment-${analysis.sentiment}`}>
                    {sentimentLabels[analysis.sentiment]} / {urgencyLabels[analysis.urgency]}
                  </span>
                )}
                {replyStatusLabel && (
                  <span className={`pill ${replyStatusLabel === "已回复" ? "sentiment-positive" : replyStatusLabel === "生成中" ? "urgency-high" : ""}`}>
                    {replyStatusLabel}
                  </span>
                )}
              </div>
            </div>
            {analysis && (
              <div className="toolbar">
                {analysis.topics.map((topic) => (
                  <span className="tag" key={topic}>
                    {topic}
                  </span>
                ))}
                <span className="tag">置信度 {toPercent(analysis.confidence)}</span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function Insights({
  analyses,
  reviews,
  topicCounts,
  analysisByReview
}: {
  analyses: AnalysisResult[];
  reviews: Review[];
  topicCounts: Array<[string, number]>;
  analysisByReview: Map<string, AnalysisResult>;
}) {
  const negativeReviews = useMemo(
    () => reviews.filter((review) => analysisByReview.get(review.id)?.sentiment === "negative"),
    [reviews, analysisByReview]
  );
  const healthReviews = useMemo(
    () => reviews.filter((review) => analysisByReview.get(review.id)?.topics.includes("宠物健康反馈")),
    [reviews, analysisByReview]
  );
  const representativeReviews = useMemo(
    () => Array.from(new Map([...healthReviews, ...negativeReviews].map((r) => [r.id, r])).values()).slice(0, 4),
    [healthReviews, negativeReviews]
  );

  return (
    <section className="dashboard-grid">
      <div className="panel">
        <div className="panel-header">
          <h2>高频问题与产品痛点</h2>
        </div>
        <div className="insight-list">
          {topicCounts.map(([topic, count]) => (
            <div className="review-card" key={topic}>
              <div className="card-title">{topic}</div>
              <p>出现 {count} 次，建议在商品详情、客服话术或售后 SOP 中补充说明。</p>
            </div>
          ))}
        </div>
      </div>
      <div className="panel">
        <h2>代表性评论</h2>
        <div className="insight-list" style={{ marginTop: 14 }}>
          {representativeReviews.map((review) => (
            <div className="review-card" key={review.id}>
              <div className="card-title">{formatUnknown(review.productName)}</div>
              <p>{review.content}</p>
            </div>
          ))}
          {analyses.length === 0 && <div className="empty-state">先选择评论执行分析</div>}
        </div>
      </div>
    </section>
  );
}

function ReplyStudio({
  replies,
  reviews,
  onUpdate,
  onGenerate,
  busy,
  generatingCount,
  selectedCount,
  replyStudioTab,
  onReplyStudioTabChange
}: {
  replies: ReplyDraft[];
  reviews: Review[];
  onUpdate: (id: string, patch: Partial<ReplyDraft>) => void;
  onGenerate: () => void;
  busy: string | null;
  generatingCount: number;
  selectedCount: number;
  replyStudioTab: "pending" | "approved";
  onReplyStudioTabChange: (tab: "pending" | "approved") => void;
}) {
  const reviewMap = useMemo(() => new Map(reviews.map((review) => [review.id, review])), [reviews]);

  return (
    <section className="panel">
      <div className="panel-header">
        <h2>回复审核工作台</h2>
        <div className="toolbar" style={{ marginBottom: 0 }}>
          <button className="secondary-button" disabled={selectedCount === 0 || Boolean(busy)} onClick={onGenerate} type="button">
            <Sparkles size={16} />
            重新生成
          </button>
          <a className="primary-button" href="/api/export/replies">
            <Download size={16} />
            导出已批准
          </a>
        </div>
      </div>
      <div className="reply-tabs">
        <button
          className={`reply-tab-button ${replyStudioTab === "pending" ? "active" : ""}`}
          onClick={() => onReplyStudioTabChange("pending")}
          type="button"
        >
          待审核（{replies.filter((r) => r.status === "needs_review" || r.status === "draft").length}）
        </button>
        <button
          className={`reply-tab-button ${replyStudioTab === "approved" ? "active" : ""}`}
          onClick={() => onReplyStudioTabChange("approved")}
          type="button"
        >
          已批准（{replies.filter((r) => r.status === "approved").length}）
        </button>
      </div>
      <div className="generation-summary">
        <div>
          <span>正在生成</span>
          <strong>{generatingCount}</strong>
        </div>
        <div>
          <span>草稿总数</span>
          <strong>{replies.length}</strong>
        </div>
        <div>
          <span>需审核</span>
          <strong>{replies.filter((reply) => reply.status === "needs_review").length}</strong>
        </div>
        <div>
          <span>真实模型回复</span>
          <strong>
            {replies.filter((reply) => ["runtime", "environment"].includes(String(reply.generationParams?.mode))).length}
          </strong>
        </div>
      </div>
      <div className="reply-list">
        {replies
          .filter((reply) => {
            if (replyStudioTab === "pending") return reply.status === "needs_review" || reply.status === "draft";
            return reply.status === "approved";
          })
          .map((reply) => {
          const review = reviewMap.get(reply.reviewId);
          return (
            <article className="reply-card" key={reply.id}>
              <div className="card-head">
                <div>
                  <div className="card-title">
                    {formatUnknown(review?.productName)}
                    <span className="tag">{replyStatusLabels[reply.status]}</span>
                    <span className="tag">来源：{formatReplySource(reply)}</span>
                    {reply.riskFlags.map((flag) => (
                      <span className="tag urgency-critical" key={flag}>
                        {riskFlagLabels[flag] ?? flag}
                      </span>
                    ))}
                  </div>
                  <p>{review?.content}</p>
                </div>
              </div>
              <textarea
                className="text-area"
                defaultValue={reply.editedText ?? reply.replyText}
                onBlur={(event) => onUpdate(reply.id, { editedText: event.target.value })}
              />
              <p>{reply.reasoningSummary}</p>
              <div className="toolbar">
                <button
                  className="primary-button"
                  disabled={reply.riskFlags.length > 0 && !(reply.editedText && reply.editedText !== reply.replyText)}
                  onClick={() => onUpdate(reply.id, { status: "approved" })}
                  type="button"
                >
                  <Check size={16} />
                  批准
                </button>
                <button className="secondary-button" onClick={() => onUpdate(reply.id, { status: "rejected" })} type="button">
                  驳回
                </button>
              </div>
            </article>
          );
        })}
        {replies.length === 0 && <div className="empty-state">选择评论后生成回复草稿</div>}
      </div>
    </section>
  );
}

function BrandSettings({
  brand,
  aiConfig,
  onAiConfigChange
}: {
  brand: BrandProfile;
  aiConfig: AiConfigStatus;
  onAiConfigChange: (config: AiConfigStatus) => void;
}) {
  return (
    <div className="settings-stack">
      <section className="panel">
        <div className="panel-header">
          <h2>AI 模型配置</h2>
          <span className="pill">当前来源：{aiConfig.sourceLabel}</span>
        </div>
        <AiConfigForm aiConfig={aiConfig} onAiConfigChange={onAiConfigChange} />
      </section>

      <section className="panel">
        <div className="panel-header">
          <h2>品牌回复策略</h2>
          <span className="pill">prompt 版本：reply-generation:v1</span>
        </div>
        <div className="settings-grid">
          <Field label="品牌名" value={brand.name} />
          <Field label="回复长度" value={replyLengthLabels[brand.replyLength]} />
          <Field label="品牌语气" value={brand.tone} />
          <Field label="目标客群" value={brand.audience} />
          <Field label="禁用词" value={brand.forbiddenWords.join("、")} />
          <Field label="售后策略" value={brand.servicePolicy} />
        </div>
      </section>
    </div>
  );
}

function AiConfigForm({
  aiConfig,
  onAiConfigChange
}: {
  aiConfig: AiConfigStatus;
  onAiConfigChange: (config: AiConfigStatus) => void;
}) {
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl ?? "https://api.deepseek.com/v1");
  const [model, setModel] = useState(aiConfig.model ?? "deepseek-chat");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    setBaseUrl(aiConfig.baseUrl ?? "https://api.deepseek.com/v1");
    setModel(aiConfig.model ?? "deepseek-chat");
  }, [aiConfig.baseUrl, aiConfig.model, aiConfig.hasApiKey]);

  async function saveConfig(clearApiKey = false) {
    setSaving(true);
    setMessage("");

    const response = await fetch("/api/ai/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        baseUrl,
        model,
        apiKey,
        clearApiKey
      })
    });

    if (!response.ok) {
      setMessage("保存失败，请检查接口地址是否是完整 URL。");
      setSaving(false);
      return;
    }

    const updated = (await response.json()) as AiConfigStatus;
    onAiConfigChange(updated);
    setApiKey("");
    setMessage(clearApiKey ? "已清除页面配置的 API Key。" : "AI 配置已保存，后续分析和回复会使用该配置。");
    setSaving(false);
  }

  async function testConnection() {
    setTesting(true);
    setTestMessage("");

    const response = await fetch("/api/ai/test", { method: "POST" });
    const payload = (await readJsonResponse(response).catch((error) => ({
      ok: false,
      message: error instanceof Error ? error.message : "连通测试失败"
    }))) as { ok: boolean; message: string; config?: AiConfigStatus };

    if (payload.config) {
      onAiConfigChange(payload.config);
    }

    setTestMessage(payload.ok ? `连通成功：${payload.message}` : `连通失败：${payload.message}`);
    setTesting(false);
  }

  return (
    <div>
      <div className="settings-grid">
        <label className="field">
          <span>接口地址</span>
          <input
            className="search-input"
            onChange={(event) => setBaseUrl(event.target.value)}
            placeholder="https://api.deepseek.com/v1"
            value={baseUrl}
          />
        </label>
        <label className="field">
          <span>模型名称</span>
          <input
            className="search-input"
            onChange={(event) => setModel(event.target.value)}
            placeholder="deepseek-chat"
            value={model}
          />
        </label>
        <label className="field">
          <span>API Key</span>
          <input
            className="search-input"
            onChange={(event) => setApiKey(event.target.value)}
            placeholder={aiConfig.hasApiKey ? "已配置，留空则保留原值" : "填入后启用真实模型"}
            type="password"
            value={apiKey}
          />
        </label>
        <div className="field">
          <span>当前状态</span>
          <div className="status-box">
            <strong>{formatAiModel(aiConfig)}</strong>
            <p>API Key：{aiConfig.hasApiKey ? "已配置" : "未配置"}</p>
          </div>
        </div>
      </div>
      <div className="toolbar" style={{ marginTop: 14 }}>
        <button className="primary-button" disabled={saving} onClick={() => saveConfig(false)} type="button">
          保存配置
        </button>
        <button className="secondary-button" disabled={saving} onClick={() => saveConfig(true)} type="button">
          清除 API Key
        </button>
        <button className="secondary-button" disabled={testing || !aiConfig.hasApiKey} onClick={testConnection} type="button">
          测试连通
        </button>
        <span className="pill">密钥只保存在当前服务进程内，不会回显到页面</span>
      </div>
      {message && <p>{message}</p>}
      {testMessage && <p>{testMessage}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      <textarea className="text-area" readOnly value={value} />
    </label>
  );
}

function formatAiModel(config: AiConfigStatus) {
  if (config.mode === "mock") {
    return "Mock / OpenAI-compatible";
  }

  return `${config.model ?? "未命名模型"}（${config.sourceLabel}）`;
}

function formatReplySource(reply: ReplyDraft) {
  const mode = reply.generationParams?.mode;
  const model = reply.generationParams?.model;

  if (mode === "runtime" || mode === "environment") {
    return String(model ?? "真实模型");
  }

  return "Mock";
}
