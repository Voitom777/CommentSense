"use client";

import {
  AlertTriangle,
  BarChart3,
  Check,
  Download,
  FileUp,
  Lightbulb,
  Loader,
  MessageCircle,
  MessageSquareText,
  RefreshCcw,
  Settings,
  Sparkles
} from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
  AiConfigStatus,
  AnalysisResult,
  BrandProfile,
  BusyOperation,
  ImportResult,
  ReplyDraft,
  Review,
  Sentiment
} from "@/shared/types";
import { formatUnknown, mergeBy, readJsonResponse, toPercent } from "@/shared/lib/utils";
import { useCountUp } from "./use-count-up";
import { decodeCsvBuffer, detectCsvEncoding, importReviewsFromCsv } from "@/features/reviews/csv";

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
  { id: "reviews", label: "评论池", icon: <MessageCircle size={16} /> },
  { id: "insights", label: "洞察", icon: <Lightbulb size={16} /> },
  { id: "replies", label: "回复工作台", icon: <MessageSquareText size={16} /> },
  { id: "settings", label: "品牌设置", icon: <Settings size={16} /> }
];

const sentimentLabels: Record<Sentiment, string> = {
  positive: "好评",
  neutral: "中评",
  negative: "差评",
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
  approved: "已提交"
} as const;

const riskFlagLabels: Record<string, string> = {
  health_related: "健康相关",
  unsafe_promise: "不当承诺",
  forbidden_word: "命中禁用词",
  mild_product_quality_concern: "轻微产品质量问题",
  no_health_risk_confirmed: "确认无健康风险",
  no_liability_commitment: "无责任承诺",
  refund_request: "退款诉求",
  shipping_issue: "物流问题",
  allergy_concern: "过敏疑虑",
  usage_guidance: "使用指导",
  price_complaint: "价格异议",
  service_complaint: "服务投诉",
  suggestion_for_improvement: "改进建议",
  competitor_mention: "提及竞品",
  repeat_purchase: "复购意向"
};

const topicSuggestions: Record<string, string> = {
  "包装/物流": "建议加强包装防护，尤其是易漏液或易碎品。",
  "客服售后": "建议优化售后响应流程，缩短处理时间。",
  "气味与功效": "建议在详情页明确功效持续时间和使用方法。",
  "适口性": "用户关注口感和宠物接受度，建议提供试吃装降低决策门槛。",
  "宠物健康反馈": "建议在详情页注明常见反应并附兽医咨询指引。",
  "产品体验": "持续收集用户反馈，迭代产品细节体验。"
};

const replyLengthLabels = {
  short: "较短",
  medium: "适中",
  long: "较长"
} as const;

function getPetEmoji(productName: string | null | undefined): string {
  const name = productName ?? "";
  if (name.includes("猫")) return "🐱";
  if (name.includes("狗") || name.includes("犬")) return "🐶";
  return "🐾";
}

export function Workspace({ initialReviews, initialAnalyses, initialReplies, brand }: WorkspaceProps) {
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");
  const [reviews, setReviews] = useState(initialReviews);
  const [analyses, setAnalyses] = useState(initialAnalyses);
  const [replies, setReplies] = useState(initialReplies);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [sentiment, setSentiment] = useState<"all" | Sentiment>("all");
  const [reviewPoolTab, setReviewPoolTab] = useState<"all" | "generated" | "replied" | "no_reply">("all");

  const reviewPoolCounts = useMemo(() => {
    // Use replyMap (last-reply-wins) to stay consistent with the tab filter
    const replyMap = new Map(replies.map((r) => [r.reviewId, r]));
    const total = reviews.length;
    let replied = 0;
    let generated = 0;
    for (const review of reviews) {
      const reply = replyMap.get(review.id);
      if (reply == null) continue;
      if (reply.status === "approved") replied++;
      else generated++;
    }
    const noReply = total - replied - generated;
    return { total, generated, replied, noReply };
  }, [reviews, replies]);
  const [busy, setBusy] = useState<BusyOperation | null>(null);
  type ImportPhase = "idle" | "preview" | "uploading" | "result";
  const [importPhase, setImportPhase] = useState<ImportPhase>("idle");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [detectedEncoding, setDetectedEncoding] = useState("utf-8");
  const [isDragging, setIsDragging] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  type Toast = { id: string; type: "success" | "error" | "info"; message: string; exiting?: boolean };
  const [toasts, setToasts] = useState<Toast[]>([]);
  const addToast = (type: Toast["type"], message: string) => {
    const id = crypto.randomUUID?.() ?? Date.now().toString();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 250);
    }, 4000);
  };
  const [generatingReplyCount, setGeneratingReplyCount] = useState(0);
  const [generatingReviewIds, setGeneratingReviewIds] = useState<string[]>([]);
  const [replyStudioTab, setReplyStudioTab] = useState<"pending" | "approved">("pending");
  const [submittingReplyId, setSubmittingReplyId] = useState<string | null>(null);
  const [aiConfig, setAiConfig] = useState<AiConfigStatus>({
    mode: "mock",
    hasApiKey: false,
    sourceLabel: "模拟"
  });

  useEffect(() => {
    fetch("/api/ai/config")
      .then((response) => response.json())
      .then((config: AiConfigStatus) => setAiConfig(config))
      .catch(() => {
        setAiConfig({ mode: "mock", hasApiKey: false, sourceLabel: "模拟" });
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
      const matchesTab =
        reviewPoolTab === "all" ? true :
        reviewPoolTab === "generated" ? (reply != null && reply.status !== "approved") :
        reviewPoolTab === "replied" ? (reply?.status === "approved") :
        reply == null;

      return matchesSentiment && matchesQuery && matchesTab;
    });
  }, [analysisByReview, query, reviews, sentiment, replies, reviewPoolTab, generatingReviewIds]);

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

  async function handleFileSelected(file?: File) {
    if (!file) return;
    // Basic CSV check
    if (!file.name.endsWith(".csv") && !file.type.includes("csv")) {
      addToast("error", "请选择 CSV 文件");
      return;
    }
    const buffer = await file.arrayBuffer();
    const encoding = detectCsvEncoding(buffer);
    const text = decodeCsvBuffer(buffer, encoding);
    const parsed = importReviewsFromCsv(text, file.name);

    setImportFile(file);
    setDetectedEncoding(encoding);
    setPreviewData(parsed);
    setImportPhase("preview");
  }

  async function confirmImport() {
    if (!importFile) return;
    setImportPhase("uploading");
    setBusy("import");
    const formData = new FormData();
    formData.append("file", importFile);
    try {
      const response = await fetch("/api/import/reviews", { method: "POST", body: formData });
      const result = (await readJsonResponse(response)) as ImportResult;
      setImportResult(result);
      setImportPhase("result");
      setReviews((current) => [...result.reviews, ...current]);
      setSelected(result.reviews.map((review) => review.id));
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "导入失败，请检查 CSV 格式。");
      setImportPhase("idle");
    } finally {
      setBusy(null);
    }
  }

  function resetImport() {
    setImportPhase("idle");
    setImportFile(null);
    setPreviewData(null);
    setImportResult(null);
  }

  async function analyzeSelected() {
    if (selected.length === 0) return;
    setBusy("analyze");

    try {
      const response = await fetch("/api/reviews/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: selected })
      });
      const payload = (await readJsonResponse(response)) as { analyses: AnalysisResult[] };
      setAnalyses((current) => mergeBy(current, payload.analyses, "reviewId"));
      addToast("success", `分析完成，已分析 ${payload.analyses.length} 条评论。`);
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "分析失败，请检查模型配置。");
    } finally {
      setBusy(null);
    }
  }

  async function generateReplies() {
    if (selected.length === 0) return;
    setBusy("reply");
    setGeneratingReviewIds(selected);
    setGeneratingReplyCount(selected.length);
    addToast("info", `${selected.length} 条评论回复生成中`);

    try {
      const response = await fetch("/api/replies/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIds: selected })
      });
      const payload = (await readJsonResponse(response)) as { replies: ReplyDraft[] };
      setReplies((current) => mergeBy(current, payload.replies, "id"));
      addToast("success", `${payload.replies.length} 条回复已生成，已进入回复工作台。`);
      setActiveTab("replies");
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "生成回复失败，请检查模型配置。");
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
      addToast("success", "回复已更新。");
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "更新回复失败。");
    } finally {
      setSubmittingReplyId(null);
    }
  }

  return (
    <main className="app-shell">
      <div className="workspace">
        <ToastContainer toasts={toasts} />
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


        {activeTab === "dashboard" && (
          <div className="tab-content">
            <Dashboard
              metrics={metrics}
              analyses={analyses}
              topicCounts={topicCounts}
              urgentReviews={reviews.filter((review) => ["high", "critical"].includes(analysisByReview.get(review.id)?.urgency ?? ""))}
            />
          </div>
        )}

        {activeTab === "import" && (
          <section className="panel tab-content">
            <div className="panel-header">
              <h2>CSV 导入</h2>
              <a className="secondary-button" href="/samples/pet-reviews.csv" download>
                <Download size={16} />
                下载样例
              </a>
            </div>

            {/* IDLE: drag-and-drop zone */}
            {importPhase === "idle" && (
              <div
                ref={dropZoneRef}
                className="drop-zone"
                data-dragging={isDragging}
                onClick={() => document.getElementById("csv-input")?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (dropZoneRef.current && !dropZoneRef.current.contains(e.relatedTarget as Node)) {
                    setIsDragging(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileSelected(file);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") document.getElementById("csv-input")?.click(); }}
              >
                <FileUp size={36} className="drop-icon" />
                <p>拖拽 CSV 文件到此处，或点击选择文件</p>
                <p style={{ fontSize: 12, marginTop: 8, color: "var(--muted)" }}>
                  必填字段：content（评论内容）；platform、productName、rating、author、createdAt 可选
                </p>
                <input
                  id="csv-input"
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => handleFileSelected(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </div>
            )}

            {/* PREVIEW: file info + validation summary + preview table */}
            {importPhase === "preview" && previewData && (
              <>
                <div className="drop-zone has-file">
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                    <FileUp size={20} className="drop-icon" style={{ margin: 0 }} />
                    <span className="file-name">{importFile?.name}</span>
                    {detectedEncoding !== "utf-8" && (
                      <span className="validation-badge" style={{ background: "rgba(212,134,74,0.1)", color: "var(--warning)" }}>
                        编码：{detectedEncoding.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="validation-summary">
                  <span className="validation-badge ok">
                    <Check size={14} />
                    有效：{previewData.acceptedRows} 行
                  </span>
                  {previewData.rejectedRows > 0 && (
                    <span className="validation-badge err">
                      <AlertTriangle size={14} />
                      无效：{previewData.rejectedRows} 行
                    </span>
                  )}
                  <span className="validation-badge" style={{ background: "var(--panel-soft)", color: "var(--muted)" }}>
                    总计：{previewData.totalRows} 行
                  </span>
                </div>

                {previewData.reviews.length > 0 && (
                  <>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>内容</th>
                          <th>平台</th>
                          <th>产品</th>
                          <th>评分</th>
                          <th>作者</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.reviews.slice(0, 5).map((review, idx) => (
                          <tr key={review.id}>
                            <td>{idx + 1}</td>
                            <td title={review.content}>
                              {review.content.length > 40 ? review.content.slice(0, 40) + "…" : review.content}
                            </td>
                            <td>{review.platform || "-"}</td>
                            <td>{review.productName || "-"}</td>
                            <td>{review.rating ?? "-"}</td>
                            <td>{review.author || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {previewData.reviews.length > 5 && (
                      <p className="preview-note">共 {previewData.totalRows} 行，仅显示前 5 行预览</p>
                    )}
                  </>
                )}

                {previewData.errors.length > 0 && (
                  <details className="error-list">
                    <summary>{previewData.errors.length} 条无效数据（点击展开）</summary>
                    <div className="error-items">
                      {previewData.errors.map((error) => (
                        <div key={error} className="error-item">{error}</div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="import-actions">
                  <button className="primary-button" onClick={confirmImport} disabled={busy === "import"}>
                    <FileUp size={16} />
                    确认导入{previewData.acceptedRows > 0 ? `（${previewData.acceptedRows} 条）` : ""}
                  </button>
                  <button className="secondary-button" onClick={resetImport} disabled={busy === "import"}>
                    重新选择
                  </button>
                </div>
              </>
            )}

            {/* UPLOADING: progress feedback */}
            {importPhase === "uploading" && (
              <div className="import-progress">
                <Loader size={32} className="loader-icon" />
                <p>正在导入{importFile ? ` ${importFile.name}` : ""}…</p>
                <p style={{ fontSize: 12, color: "var(--muted)", margin: 0 }}>正在验证并保存数据</p>
              </div>
            )}

            {/* RESULT: done */}
            {importPhase === "result" && importResult && (
              <>
                <div className="drop-zone has-file" style={{ cursor: "default" }}>
                  <span className="file-name">{importFile?.name}</span>
                </div>

                <div className="import-result-grid">
                  <div className="result-card success">
                    <div className="result-number">{importResult.acceptedRows}</div>
                    <div className="result-label">导入成功</div>
                  </div>
                  <div className="result-card failure">
                    <div className="result-number">{importResult.rejectedRows}</div>
                    <div className="result-label">导入失败</div>
                  </div>
                  <div className="result-card total">
                    <div className="result-number">{importResult.totalRows}</div>
                    <div className="result-label">总行数</div>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <details className="error-list">
                    <summary>{importResult.errors.length} 条错误详情</summary>
                    <div className="error-items">
                      {importResult.errors.map((error) => (
                        <div key={error} className="error-item">{error}</div>
                      ))}
                    </div>
                  </details>
                )}

                <div className="import-actions">
                  <button className="primary-button" onClick={resetImport}>
                    继续导入
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {activeTab === "reviews" && (
          <section className="panel tab-content">
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
                <option value="positive">好评</option>
                <option value="neutral">中评</option>
                <option value="negative">差评</option>
                <option value="mixed">混合</option>
              </select>
            </div>
            <div className="reply-tabs">
              <button
                className={`reply-tab-button ${reviewPoolTab === "all" ? "active" : ""}`}
                onClick={() => setReviewPoolTab("all")}
                type="button"
              >
                全部（{reviewPoolCounts.total}）
              </button>
              <button
                className={`reply-tab-button ${reviewPoolTab === "generated" ? "active" : ""}`}
                onClick={() => setReviewPoolTab("generated")}
                type="button"
              >
                已生成回复（{reviewPoolCounts.generated}）
              </button>
              <button
                className={`reply-tab-button ${reviewPoolTab === "replied" ? "active" : ""}`}
                onClick={() => setReviewPoolTab("replied")}
                type="button"
              >
                已回复（{reviewPoolCounts.replied}）
              </button>
              <button
                className={`reply-tab-button ${reviewPoolTab === "no_reply" ? "active" : ""}`}
                onClick={() => setReviewPoolTab("no_reply")}
                type="button"
              >
                待生成回复（{reviewPoolCounts.noReply}）
              </button>
            </div>
            {busy === "analyze" ? (
              <SkeletonReviewList count={3} />
            ) : (
              <ReviewList
                reviews={filteredReviews}
                selected={selected}
                analyses={analysisByReview}
                replies={replies}
                generatingReviewIds={generatingReviewIds}
                onToggle={toggleSelected}
              />
            )}
          </section>
        )}

        {activeTab === "insights" && (
          <div className="tab-content">
            <Insights analyses={analyses} reviews={reviews} topicCounts={topicCounts} analysisByReview={analysisByReview} />
          </div>
        )}

        {activeTab === "replies" && (
          <div className="tab-content">
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
              submittingReplyId={submittingReplyId}
              onAction={(_type, replyId) => {
                setSubmittingReplyId(replyId);
                updateReply(replyId, { status: "approved" });
              }}
            />
          </div>
        )}

        {activeTab === "settings" && (
          <div className="tab-content">
            <BrandSettings brand={brand} aiConfig={aiConfig} onAiConfigChange={setAiConfig} />
          </div>
        )}
      </div>
      <SideCat />
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
        <Metric label="评论总量" value={metrics.total} icon="📝" />
        <Metric label="已分析" value={metrics.analyzed} icon="🔍" />
        <Metric label="高优先级" value={metrics.urgent} icon="⚠️" />
        <Metric label="已提交回复" value={metrics.approved} icon="✅" />
      </div>
      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-header">
            <h2>情绪分布</h2>
            <span className="pill">结构化输出校验</span>
          </div>
          {sentimentCounts.map(([key, count]) => {
            const barColor = key === "positive" ? "var(--positive)" : key === "negative" ? "var(--danger)" : key === "mixed" ? "var(--warning)" : "var(--neutral)";
            return (
              <Bar key={key} label={sentimentLabels[key as Sentiment]} value={count} max={Math.max(1, analyses.length)} color={barColor} />
            );
          })}
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
            {urgentReviews.length === 0 && <EmptyWithPet message="暂无高优先级评论" />}
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

function Metric({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
  const isNumber = typeof value === "number";
  const { count, ref } = useCountUp(isNumber ? value : 0, 800);

  return (
    <div className="metric-card">
      {icon && <span className="metric-icon">{icon}</span>}
      <span>{label}</span>
      <strong ref={isNumber ? ref : undefined}>
        {isNumber ? count : value}
      </strong>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color?: string }) {
  return (
    <div className="bar-row">
      <span>{label}</span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width: toPercent(value / max), background: color ?? undefined }} />
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
        {busy === "analyze" ? <Loader size={16} className="loader-icon" /> : <RefreshCcw size={16} />}
        {busy === "analyze" ? "分析中..." : `分析 ${selectedCount}`}
      </button>
      <button className="primary-button" disabled={selectedCount === 0 || Boolean(busy)} onClick={onReply} type="button">
        {busy === "reply" ? <Loader size={16} className="loader-icon" /> : <Sparkles size={16} />}
        {busy === "reply" ? "生成中..." : "生成回复"}
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
    return <EmptyWithPet message="没有符合筛选条件的评论" />;
  }

  function getReplyStatusLabel(reviewId: string) {
    if (generatingReviewIds.includes(reviewId)) return "生成中";
    const reply = replyMap.get(reviewId);
    if (!reply) return null;
    if (reply.status === "approved") return "已提交";
    if (reply.status === "needs_review") return "待审核";
    return "草稿";
  }

  return (
    <div className="review-list">
      {reviews.map((review) => {
        const analysis = analyses.get(review.id);
        const replyStatusLabel = getReplyStatusLabel(review.id);
        return (
          <article className={`review-card${selected.includes(review.id) ? ' selected' : ''}`} key={review.id}>
            <div className="card-head">
              <div>
                <div className="card-title">
                  <input
                    aria-label="选择评论"
                    checked={selected.includes(review.id)}
                    onChange={() => onToggle(review.id)}
                    type="checkbox"
                    className="review-checkbox"
                  />
                  {formatUnknown(review.productName)}
                  <span className="pet-tag">{getPetEmoji(review.productName)}</span>
                  <span className="tag">{formatUnknown(review.platform)}</span>
                  <span className="tag star-rating">
                    {Array.from({ length: 5 }, (_, i) =>
                      i < (review.rating ?? 0) ? "★" : "☆"
                    )}
                    {analysis && (
                      <span className={`paw-print sentiment-${analysis.sentiment}`}> 🐾</span>
                    )}
                  </span>
                </div>
                <p>{review.content}</p>
                {(() => {
                  const reply = replyMap.get(review.id);
                  if (reply?.status === "approved") {
                    return (
                      <div className="reply-preview">
                        <span className="tag sentiment-positive">已回复</span>
                        <p>{reply.editedText ?? reply.replyText}</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <div className="card-head-right">
                {analysis && (
                  <span className={`pill sentiment-${analysis.sentiment}`}>
                    {sentimentLabels[analysis.sentiment]} / {urgencyLabels[analysis.urgency]}
                  </span>
                )}
                {replyStatusLabel && (
                  <span className={`pill ${replyStatusLabel === "已提交" ? "sentiment-positive" : replyStatusLabel === "生成中" ? "urgency-high" : ""}`}>
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
  const urgencyCounts = useMemo(() => {
    const counts = { low: 0, medium: 0, high: 0, critical: 0 };
    analyses.forEach((a) => {
      if (a.urgency in counts) counts[a.urgency as keyof typeof counts] += 1;
    });
    return counts;
  }, [analyses]);

  const sentimentCounts = useMemo(() => {
    const counts = { positive: 0, neutral: 0, negative: 0 };
    analyses.forEach((a) => {
      if (a.sentiment in counts) counts[a.sentiment as keyof typeof counts] += 1;
    });
    return counts;
  }, [analyses]);

  const platformStats = useMemo(() => {
    const stats = new Map<string, { positive: number; neutral: number; negative: number; mixed: number }>();
    analyses.forEach((analysis) => {
      const review = reviews.find((r) => r.id === analysis.reviewId);
      if (!review?.platform) return;
      if (!stats.has(review.platform))
        stats.set(review.platform, { positive: 0, neutral: 0, negative: 0, mixed: 0 });
      const entry = stats.get(review.platform)!;
      if (analysis.sentiment === "positive") entry.positive += 1;
      else if (analysis.sentiment === "neutral") entry.neutral += 1;
      else if (analysis.sentiment === "negative") entry.negative += 1;
      else if (analysis.sentiment === "mixed") entry.mixed += 1;
    });
    return Array.from(stats.entries()).sort((a, b) => {
      const totalA = a[1].positive + a[1].neutral + a[1].negative + a[1].mixed;
      const totalB = b[1].positive + b[1].neutral + b[1].negative + b[1].mixed;
      return totalB - totalA;
    });
  }, [analyses, reviews]);

  const productStats = useMemo(() => {
    const stats = new Map<string, { total: number; ratings: number[]; negative: number }>();
    analyses.forEach((analysis) => {
      const review = reviews.find((r) => r.id === analysis.reviewId);
      if (!review?.productName) return;
      if (!stats.has(review.productName))
        stats.set(review.productName, { total: 0, ratings: [], negative: 0 });
      const entry = stats.get(review.productName)!;
      entry.total += 1;
      if (review.rating) entry.ratings.push(review.rating);
      if (analysis.sentiment === "negative") entry.negative += 1;
    });
    return Array.from(stats.entries())
      .map(([name, s]) => ({
        name,
        total: s.total,
        avgRating: s.ratings.length > 0 ? s.ratings.reduce((a, b) => a + b, 0) / s.ratings.length : 0,
        negativeRate: s.total > 0 ? s.negative / s.total : 0
      }))
      .sort((a, b) => b.negativeRate - a.negativeRate || b.total - a.total);
  }, [analyses, reviews]);

  const representativeReviews = useMemo(() => {
    const scored = reviews
      .filter((r) => analysisByReview.has(r.id))
      .map((r) => {
        const analysis = analysisByReview.get(r.id)!;
        const urgencyOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return { review: r, sentiment: analysis.sentiment, urgencyScore: urgencyOrder[analysis.urgency] ?? 4 };
      })
      .sort((a, b) => {
        if (a.sentiment === "negative" && b.sentiment !== "negative") return -1;
        if (a.sentiment !== "negative" && b.sentiment === "negative") return 1;
        return a.urgencyScore - b.urgencyScore;
      })
      .slice(0, 4)
      .map((item) => item.review);
    return scored;
  }, [reviews, analysisByReview]);

  const totalAnalyzed = analyses.length;
  const maxUrgency = Math.max(1, ...Object.values(urgencyCounts));

  const topicSentimentStats = useMemo(() => {
    const stats = new Map<string, { positive: number; neutral: number; negative: number; mixed: number }>();
    analyses.forEach((a) => {
      a.topics.forEach((topic) => {
        if (!stats.has(topic)) stats.set(topic, { positive: 0, neutral: 0, negative: 0, mixed: 0 });
        const entry = stats.get(topic)!;
        if (a.sentiment === "positive") entry.positive += 1;
        else if (a.sentiment === "neutral") entry.neutral += 1;
        else if (a.sentiment === "negative") entry.negative += 1;
        else if (a.sentiment === "mixed") entry.mixed += 1;
      });
    });
    return stats;
  }, [analyses]);

  return (
    <section className="dashboard-grid">
      <div className="settings-stack">
        <div className="metric-grid">
          <Metric label="好评率" value={totalAnalyzed > 0 ? toPercent(sentimentCounts.positive / totalAnalyzed) : "0%"} />
          <Metric label="中评率" value={totalAnalyzed > 0 ? toPercent(sentimentCounts.neutral / totalAnalyzed) : "0%"} />
          <Metric label="差评率" value={totalAnalyzed > 0 ? toPercent(sentimentCounts.negative / totalAnalyzed) : "0%"} />
          <Metric label="已分析评论" value={totalAnalyzed} />
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>紧迫度分布</h2>
          </div>
          {(["critical" as const, "high" as const, "medium" as const, "low" as const]).map((level) => (
            <Bar key={level} label={urgencyLabels[level]} value={urgencyCounts[level]} max={maxUrgency} />
          ))}
        </div>

        {platformStats.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h2>各平台表现</h2>
            </div>
            <div className="insight-list">
              {platformStats.map(([platform, stats]) => {
                const total = stats.positive + stats.neutral + stats.negative + stats.mixed;
                return (
                  <div className="review-card" key={platform}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div className="card-title">{platform}</div>
                      <span style={{ fontSize: 22, fontWeight: 700 }}>{total}</span>
                    </div>
                    <div style={{ fontSize: 13, marginTop: 6, color: "var(--muted)" }}>
                      <span className="sentiment-positive">好评 {stats.positive}</span>
                      {" / "}
                      <span>中评 {stats.neutral}</span>
                      {" / "}
                      <span className="sentiment-negative">差评 {stats.negative}</span>
                      {stats.mixed > 0 && <>{" / "}<span>混合 {stats.mixed}</span></>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {productStats.length > 0 && (
          <div className="panel">
            <div className="panel-header">
              <h2>产品评分分布</h2>
            </div>
            <div className="insight-list">
              {productStats.map((product) => (
                <div className="review-card" key={product.name}>
                  <div className="card-title">
                    {product.name}
                    <span className="tag">{product.avgRating.toFixed(1)} 分</span>
                    {product.negativeRate > 0.3 && <span className="tag urgency-critical">需关注</span>}
                  </div>
                  <div className="star-rating">
                    {Array.from({ length: 5 }, (_, i) => (i < Math.round(product.avgRating) ? "★" : "☆"))}
                  </div>
                  <p>共 {product.total} 条评论，差评率 {toPercent(product.negativeRate)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="settings-stack">
        <div className="panel">
          <div className="panel-header">
            <h2>高频主题</h2>
          </div>
          <div className="insight-list">
            {topicCounts.slice(0, 5).map(([topic, count]) => {
              const sent = topicSentimentStats.get(topic);
              const parts: string[] = [];
              if (sent) {
                if (sent.positive > 0) parts.push(`好评 ${sent.positive}`);
                if (sent.neutral > 0) parts.push(`中评 ${sent.neutral}`);
                if (sent.negative > 0) parts.push(`差评 ${sent.negative}`);
                if (sent.mixed > 0) parts.push(`混合 ${sent.mixed}`);
              }
              return (
                <div className="review-card" key={topic}>
                  <div className="card-title">{topic}</div>
                  <p>{topicSuggestions[topic] ?? "建议优化相关产品描述或服务流程。"}</p>
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>
                    出现 {count} 次{parts.length > 0 && <>（{parts.join(" / ")}）</>}
                  </div>
                </div>
              );
            })}
            {topicCounts.length === 0 && <EmptyWithPet message="暂无主题数据" />}
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <h2>代表性评论</h2>
          </div>
          <div className="insight-list">
            {representativeReviews.map((review) => {
              const analysis = analysisByReview.get(review.id);
              return (
                <div className="review-card" key={review.id}>
                  <div className="card-title">
                    {formatUnknown(review.productName)}
                    {analysis && (
                      <span className={`pill sentiment-${analysis.sentiment}`}>
                        {sentimentLabels[analysis.sentiment]}
                      </span>
                    )}
                  </div>
                  <div className="star-rating">
                    {Array.from({ length: 5 }, (_, i) => (i < (review.rating ?? 0) ? "★" : "☆"))}
                    {analysis && (
                      <span className={`paw-print sentiment-${analysis.sentiment}`}> 🐾</span>
                    )}
                  </div>
                  <p>{review.content}</p>
                </div>
              );
            })}
            {analyses.length === 0 && <EmptyWithPet message="先选择评论执行分析" />}
          </div>
        </div>
      </div>
    </section>
  );
}

function ReplyStudio({
  replies,
  reviews,
  onUpdate,
  onAction,
  onGenerate,
  busy,
  generatingCount,
  selectedCount,
  replyStudioTab,
  onReplyStudioTabChange,
  submittingReplyId
}: {
  replies: ReplyDraft[];
  reviews: Review[];
  onUpdate: (id: string, patch: Partial<ReplyDraft>) => void;
  onAction: (type: "approved", replyId: string) => void;
  onGenerate: () => void;
  busy: string | null;
  generatingCount: number;
  selectedCount: number;
  replyStudioTab: "pending" | "approved";
  onReplyStudioTabChange: (tab: "pending" | "approved") => void;
  submittingReplyId: string | null;
}) {
  const reviewMap = useMemo(() => new Map(reviews.map((review) => [review.id, review])), [reviews]);
  const [confirmDialogReplyId, setConfirmDialogReplyId] = useState<string | null>(null);

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
            导出已提交
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
          已提交（{replies.filter((r) => r.status === "approved").length}）
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
              {reply.status === "approved" ? (
                <div className="reply-text-readonly">{reply.editedText ?? reply.replyText}</div>
              ) : (
                <textarea
                  className="text-area"
                  defaultValue={reply.editedText ?? reply.replyText}
                  onBlur={(event) => onUpdate(reply.id, { editedText: event.target.value })}
                />
              )}
              <p>{reply.reasoningSummary}</p>
              {reply.status !== "approved" && (
              <div className="toolbar">
                <button className="primary-button"
                  disabled={submittingReplyId === reply.id}
                  onClick={() => {
                if (reply.riskFlags.length > 0) {
                  setConfirmDialogReplyId(reply.id);
                } else {
                  onAction("approved", reply.id);
                }
              }}
                  type="button"
                >
                  {submittingReplyId === reply.id ? <Loader size={16} className="loader-icon" /> : <Check size={16} />}
                  {submittingReplyId === reply.id ? "提交中..." : "提交"}
                </button>
              </div>
              )}
            </article>
          );
        })}
        {replies.length === 0 && <EmptyWithPet message="选择评论后生成回复草稿" />}
      </div>
      {confirmDialogReplyId && (() => {
        const reply = replies.find((r) => r.id === confirmDialogReplyId);
        if (!reply) return null;
        const riskLabels = reply.riskFlags.map((f) => riskFlagLabels[f] ?? f).join("、");
        return (
          <ConfirmDialog
            title="提交确认"
            message={`该回复包含风险：${riskLabels}，确定要提交吗？`}
            onConfirm={() => {
              setConfirmDialogReplyId(null);
              onAction("approved", confirmDialogReplyId);
            }}
            onCancel={() => setConfirmDialogReplyId(null)}
          />
        );
      })()}
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
  const [baseUrl, setBaseUrl] = useState(aiConfig.baseUrl ?? "https://api.minimaxi.com/v1");
  const [model, setModel] = useState(aiConfig.model ?? "MiniMax-M2.7");
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState("");
  const [testMessage, setTestMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [urlError, setUrlError] = useState("");

  const validateUrl = (url: string) => {
    try {
      new URL(url);
      setUrlError("");
    } catch {
      setUrlError("请输入有效的 API 地址");
    }
  };

  useEffect(() => {
    setBaseUrl(aiConfig.baseUrl ?? "https://api.minimaxi.com/v1");
    setModel(aiConfig.model ?? "MiniMax-M2.7");
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
        <label className={`field${urlError ? " has-error" : baseUrl && !urlError ? " has-success" : ""}`}>
          <span>接口地址</span>
          <input
            className="search-input"
            onChange={(event) => {
              setBaseUrl(event.target.value);
              if (urlError) setUrlError("");
            }}
            onBlur={() => validateUrl(baseUrl)}
            placeholder="https://api.minimaxi.com/v1"
            value={baseUrl}
          />
          {urlError && <span className="field-error-text">{urlError}</span>}
        </label>
        <label className="field">
          <span>模型名称</span>
          <input
            className="search-input"
            onChange={(event) => setModel(event.target.value)}
            placeholder="MiniMax-M2.7"
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
        {saving && (
          <span className="auto-save-indicator">
            <span className="auto-save-dot" />
            保存中...
          </span>
        )}
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
    return "模拟 / OpenAI 兼容";
  }

  return `${config.model ?? "未命名模型"}（${config.sourceLabel}）`;
}

function formatReplySource(reply: ReplyDraft) {
  const mode = reply.generationParams?.mode;
  const model = reply.generationParams?.model;

  if (mode === "runtime" || mode === "environment") {
    return String(model ?? "真实模型");
  }

  return "模拟";
}

function SkeletonReviewList({ count = 3 }: { count?: number }) {
  return (
    <div className="review-list">
      {Array.from({ length: count }).map((_, i) => (
        <div className="review-card" key={i}>
          <div className="skeleton skeleton-text" style={{ width: "40%" }} />
          <div className="skeleton skeleton-text" />
          <div className="skeleton skeleton-text-sm" />
        </div>
      ))}
    </div>
  );
}

function EmptyWithPet({ message }: { message: string }) {
  return (
    <div className="empty-pet-state">
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="28" fill="#f0ebe4" stroke="#e0d8cf" strokeWidth="2"/>
        <path d="M22 24 L18 10 L30 20Z" fill="#f0ebe4" stroke="#e0d8cf" strokeWidth="1.5"/>
        <path d="M58 24 L62 10 L50 20Z" fill="#f0ebe4" stroke="#e0d8cf" strokeWidth="1.5"/>
        <circle cx="32" cy="36" r="3" fill="#c4956a"/>
        <circle cx="48" cy="36" r="3" fill="#c4956a"/>
        <path d="M38 42 L42 42 L40 45Z" fill="#c4956a"/>
        <line x1="20" y1="40" x2="30" y2="42" stroke="#e0d8cf" strokeWidth="1.5"/>
        <line x1="20" y1="46" x2="30" y2="44" stroke="#e0d8cf" strokeWidth="1.5"/>
        <line x1="60" y1="40" x2="50" y2="42" stroke="#e0d8cf" strokeWidth="1.5"/>
        <line x1="60" y1="46" x2="50" y2="44" stroke="#e0d8cf" strokeWidth="1.5"/>
      </svg>
      <p>{message}</p>
    </div>
  );
}

function ToastContainer({ toasts }: { toasts: Array<{ id: string; type: "success" | "error" | "info"; message: string; exiting?: boolean }> }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast-${toast.type}${toast.exiting ? " toast-exit" : ""}`}
          role="alert"
        >
          {toast.type === "error" && <AlertTriangle size={18} />}
          {toast.type === "success" && <Check size={18} />}
          {toast.message}
        </div>
      ))}
    </div>
  );
}

function SideCat() {
  const [clicked, setClicked] = useState(false);
  const [showBubble, setShowBubble] = useState(false);

  const handleClick = () => {
    setClicked(true);
    setShowBubble(true);
    setTimeout(() => {
      setClicked(false);
      setTimeout(() => setShowBubble(false), 400);
    }, 700);
  };

  return (
    <div className="side-cat">
    <div className="cat-message">我放了一只小猫在这里<br />不要欺负它哦</div>
    <div
      className={`${clicked ? "cat-jump" : ""}`}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") handleClick(); }}
      aria-label="点击小猫互动"
    >
      {showBubble && <div className="cat-bubble">喵~</div>}
      <svg viewBox="0 0 320 320" xmlns="http://www.w3.org/2000/svg" className="cat-pixel-svg">
        <g id="cat">
          <rect x="90" y="20" width="20" height="20" fill="#3a2f2b"/>
          <rect x="110" y="20" width="20" height="20" fill="#3a2f2b"/>
          <rect x="210" y="20" width="20" height="20" fill="#3a2f2b"/>
          <rect x="230" y="20" width="20" height="20" fill="#3a2f2b"/>
          <rect x="70" y="40" width="20" height="20" fill="#3a2f2b"/>
          <rect x="90" y="40" width="20" height="20" fill="#9c877d"/>
          <rect x="110" y="40" width="20" height="20" fill="#b7a49b"/>
          <rect x="130" y="40" width="20" height="20" fill="#3a2f2b"/>
          <rect x="190" y="40" width="20" height="20" fill="#3a2f2b"/>
          <rect x="210" y="40" width="20" height="20" fill="#b7a49b"/>
          <rect x="230" y="40" width="20" height="20" fill="#9c877d"/>
          <rect x="250" y="40" width="20" height="20" fill="#3a2f2b"/>
          <rect x="50" y="60" width="220" height="180" rx="0" fill="#f4eee7"/>
          <rect x="50" y="60" width="20" height="180" fill="#3a2f2b"/>
          <rect x="250" y="60" width="20" height="180" fill="#3a2f2b"/>
          <rect x="90" y="60" width="140" height="20" fill="#f4eee7"/>
          <rect x="70" y="80" width="40" height="40" fill="#c8b5aa"/>
          <rect x="210" y="80" width="40" height="40" fill="#c8b5aa"/>
          <rect x="110" y="100" width="40" height="60" fill="#111"/>
          <rect x="170" y="100" width="40" height="60" fill="#111"/>
          <rect x="110" y="140" width="40" height="20" fill="#62a8ff"/>
          <rect x="170" y="140" width="40" height="20" fill="#62a8ff"/>
          <rect x="150" y="150" width="20" height="20" fill="#f2a6b9"/>
          <rect x="30" y="170" width="40" height="10" fill="#fff"/>
          <rect x="250" y="170" width="40" height="10" fill="#fff"/>
          <rect x="30" y="190" width="40" height="10" fill="#fff"/>
          <rect x="250" y="190" width="40" height="10" fill="#fff"/>
          <rect x="70" y="220" width="180" height="60" fill="#efe7dc"/>
          <rect x="130" y="200" width="60" height="80" fill="#fff"/>
          <rect x="90" y="280" width="20" height="20" fill="#3a2f2b"/>
          <rect x="130" y="280" width="20" height="20" fill="#3a2f2b"/>
          <rect x="170" y="280" width="20" height="20" fill="#3a2f2b"/>
          <rect x="210" y="280" width="20" height="20" fill="#3a2f2b"/>
          {/* tail */}
          <g className="cat-tail">
            <rect x="270" y="190" width="20" height="90" fill="#3a2f2b"/>
            <rect x="290" y="170" width="20" height="110" fill="#9c877d"/>
          </g>
        </g>
      </svg>
    </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  message,
  onConfirm,
  onCancel
}: {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <AlertTriangle size={20} className="modal-icon" />
          <h3>{title}</h3>
        </div>
        <div className="modal-body">{message}</div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onCancel} type="button">
            取消
          </button>
          <button className="primary-button" onClick={onConfirm} type="button">
            确定提交
          </button>
        </div>
      </div>
    </div>
  );
}
