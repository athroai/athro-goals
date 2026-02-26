"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

export function ConversationChat({
  initialPathwayId,
  initialMessages,
  initialGoal,
  initialTarget,
  initialAttainments,
  initialLimitReached,
}: {
  initialPathwayId?: string;
  initialMessages?: Message[];
  initialGoal?: string;
  initialTarget?: string;
  initialAttainments?: string[];
  initialLimitReached?: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages || []);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pathwayId, setPathwayId] = useState<string | undefined>(initialPathwayId);
  const [toolStatus, setToolStatus] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [buildProgress, setBuildProgress] = useState<{
    phase: "structure" | "enriching" | "finalizing";
    totalSteps: number;
    completedSteps: number;
    stepTitles: string[];
  } | null>(null);
  const [showBuildButton, setShowBuildButton] = useState(false);
  const [buildLoading, setBuildLoading] = useState(false);
  const [inputLocked, setInputLocked] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const limitReached = showUpgrade || (initialLimitReached ?? false);
  const [goal, setGoal] = useState<string | null>(initialGoal ?? null);
  const [target, setTarget] = useState<string | null>(initialTarget ?? null);
  const [attainments, setAttainments] = useState<string[]>(initialAttainments ?? []);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText, scrollToBottom]);

  // Build button only when agent offers it (offerBuild) — not from intake alone

  useEffect(() => {
    if (!loading && inputRef.current) inputRef.current.focus();
  }, [loading]);

  async function handleBuildPathway() {
    if (!pathwayId || buildLoading) return;
    setBuildLoading(true);
    setShowBuildButton(false);

    try {
      const putRes = await fetch(`/api/pathway/${pathwayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "GENERATING" }),
      });

      if (putRes.status === 429) {
        setBuildLoading(false);
        setShowBuildButton(false);
        setShowUpgrade(true);
        return;
      }

      if (!putRes.ok) {
        const putErr = await putRes.json().catch(() => ({}));
        throw new Error(putErr.message || putErr.error || `Start build failed (${putRes.status})`);
      }

      setGenerating(true);
      setBuildProgress({ phase: "structure", totalSteps: 0, completedSteps: 0, stepTitles: [] });

      const buildRes = await fetch("/api/pathway/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathwayId }),
      });

      if (!buildRes.ok) {
        const buildErr = await buildRes.json().catch(() => ({}));
        throw new Error(buildErr.error || buildErr.message || `Build failed (${buildRes.status})`);
      }

      const skeleton = await buildRes.json();

      setBuildProgress({
        phase: "enriching",
        totalSteps: skeleton.steps.length,
        completedSteps: 0,
        stepTitles: skeleton.steps.map((s: { title: string }) => s.title),
      });

      let completed = 0;
      const enrichmentResults = await Promise.all(
        skeleton.steps.map(
          async (step: {
            id: string;
            title: string;
            stageLabel: string;
            definiteDate: string | null;
            estimatedCost: number | null;
          }) => {
            try {
              const res = await fetch("/api/pathway/build/step", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  stepId: step.id,
                  goal: skeleton.goal,
                  conversationSummary: skeleton.conversationSummary,
                  stepTitle: step.title,
                  stepDate: step.definiteDate ?? "",
                  stepStage: step.stageLabel,
                  estimatedCost: step.estimatedCost,
                  groundingType: skeleton.groundingType,
                }),
              });

              const data = await res.json();
              completed++;
              setBuildProgress((prev) =>
                prev ? { ...prev, completedSteps: completed } : null
              );

              if (!res.ok) {
                console.error(`Step enrichment failed for "${step.title}":`, data.error);
                return null;
              }
              return data;
            } catch (err) {
              completed++;
              setBuildProgress((prev) =>
                prev ? { ...prev, completedSteps: completed } : null
              );
              console.error(`Step enrichment error for "${step.title}":`, err);
              return null;
            }
          }
        )
      );

      setBuildProgress((prev) => (prev ? { ...prev, phase: "finalizing" } : null));

      const mergedSteps = (
        skeleton.pathwayData?.steps as Record<string, unknown>[] | undefined
      )?.map((s: Record<string, unknown>, i: number) => {
        const enriched = enrichmentResults[i];
        if (!enriched) return s;
        return {
          ...s,
          description: enriched.description,
          checklist: enriched.checklist,
          costBreakdown: enriched.costBreakdown,
          costNote: enriched.costNote,
          savingsTarget: enriched.savingsTarget,
          recommendations: enriched.recommendations,
          tips: enriched.tips,
          sources: enriched.sources,
          sourceType: enriched.sourceType,
        };
      });

      await fetch(`/api/pathway/${pathwayId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "COMPLETE",
          pathwayData: { ...skeleton.pathwayData, steps: mergedSteps },
        }),
      });

      router.push(`/pathway/${pathwayId}`);
    } catch (err) {
      setGenerating(false);
      setBuildLoading(false);
      setBuildProgress(null);
      setShowBuildButton(true);
      const msg = err instanceof Error ? err.message : "Failed to start building. Try again.";
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "system", content: msg },
      ]);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const userMessage = input.trim();
    setInput("");
    setLoading(true);
    setStreamingText("");
    setToolStatus(null);
    setShowBuildButton(false);

    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", content: userMessage },
    ]);
    if (!goal && userMessage.length < 100) setGoal(userMessage);

    try {
      const res = await fetch("/api/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathwayId, message: userMessage }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: "Request failed" }));
        if (res.status === 429 && errData.error === "limit_reached") {
          setShowUpgrade(true);
        } else {
          setMessages((prev) => [
            ...prev,
            { id: `err-${Date.now()}`, role: "system", content: errData.error || "Something went wrong." },
          ]);
        }
        setLoading(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";
      let currentText = "";
      let gotResponse = false;
      let gotErrorEvent = false;
      const finalTextRef = { current: "" };

      const toolNames: Record<string, string> = {
        mortgage_affordability: "Checking mortgage guidance",
        isa_lisa_rules: "Looking up ISA rules",
        debt_management: "Checking debt options",
        retrieve_knowledge: "Searching knowledge base",
      };

      function processEvent(eventType: string, eventData: string) {
        try {
          const data = JSON.parse(eventData);
          switch (eventType) {
            case "pathwayId":
              setPathwayId(data.pathwayId);
              break;
            case "pathway":
              if (data.goal) setGoal(data.goal);
              if (data.targetDate) setTarget(`By ${data.targetDate}`);
              else if (data.targetAge != null) setTarget(`By age ${data.targetAge}`);
              if (Array.isArray(data.attainments)) setAttainments(data.attainments);
              break;
            case "text": {
              const text = typeof data.text === "string" ? data.text : String(data.text ?? "");
              currentText = text;
              finalTextRef.current = text;
              gotResponse = true;
              setStreamingText(text);
              break;
            }
            case "tool_start":
              setToolStatus(toolNames[data.tool] || "Looking something up...");
              break;
            case "tool_end":
              setToolStatus(null);
              break;
            case "done": {
              const textToAdd = (currentText || finalTextRef.current || "").trim();
              if (textToAdd) {
                const msgId = `assistant-${Date.now()}`;
                setMessages((prev) => [
                  ...prev,
                  { id: msgId, role: "assistant", content: textToAdd },
                ]);
              }
              setStreamingText("");
              currentText = "";
              finalTextRef.current = "";
              if (data.inputLocked) {
                setInputLocked(true);
                setShowBuildButton(true);
              } else if (data.offerBuild) {
                setShowBuildButton(true);
              }
              break;
            }
            case "heartbeat":
              gotResponse = true;
              break;
            case "error":
              gotErrorEvent = true;
              setMessages((prev) => [
                ...prev,
                { id: `err-${Date.now()}`, role: "system", content: data.error || "An error occurred." },
              ]);
              break;
          }
        } catch {
          /* skip malformed */
        }
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const eventBlocks = buffer.split("\n\n");
        buffer = eventBlocks.pop() || "";
        for (const block of eventBlocks) {
          if (!block.trim()) continue;
          let eventType = "";
          let eventData = "";
          for (const line of block.split("\n")) {
            if (line.startsWith("event: ")) eventType = line.slice(7).trim();
            else if (line.startsWith("data: ")) eventData = line.slice(6);
          }
          if (eventType && eventData) processEvent(eventType, eventData);
        }
      }

      const textToAdd = (currentText || finalTextRef.current || "").trim();
      if (textToAdd) {
        setMessages((prev) => [
          ...prev,
          { id: `assistant-${Date.now()}`, role: "assistant", content: textToAdd },
        ]);
      }
      setStreamingText("");
      if (!textToAdd && !gotResponse && !gotErrorEvent) {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "system", content: "Response timed out. Please try again." },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: "system", content: "Connection lost. Please try again." },
      ]);
    } finally {
      setLoading(false);
      setToolStatus(null);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  if (generating) {
    const bp = buildProgress;
    const phaseLabel =
      bp?.phase === "structure"
        ? "Planning your pathway structure..."
        : bp?.phase === "enriching"
          ? `Enriching step ${Math.min(bp.completedSteps + 1, bp.totalSteps)} of ${bp.totalSteps}`
          : bp?.phase === "finalizing"
            ? "Saving your pathway..."
            : "Building your pathway...";

    const progressPercent =
      bp?.phase === "structure"
        ? 10
        : bp?.phase === "enriching"
          ? 15 + Math.round((bp.completedSteps / Math.max(bp.totalSteps, 1)) * 75)
          : 95;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-[rgba(228,201,126,0.3)] border-t-[var(--gold)]" />
        <div className="w-full max-w-sm text-center">
          <h2 className="text-xl font-semibold text-[var(--light)]">Building your pathway</h2>
          <p className="mt-2 text-sm text-[var(--gold)]">{phaseLabel}</p>

          <div className="mx-auto mt-4 h-2 w-full overflow-hidden rounded-full bg-[rgba(228,201,126,0.15)]">
            <div
              className="h-full rounded-full bg-[var(--gold)] transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {bp?.phase === "enriching" && bp.stepTitles.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-left">
              {bp.stepTitles.map((title, i) => {
                const done = i < bp.completedSteps;
                const active = i === bp.completedSteps && bp.completedSteps < bp.totalSteps;
                return (
                  <li key={i} className="flex items-center gap-2 text-xs">
                    {done ? (
                      <span className="text-[var(--bright-green)]">&#10003;</span>
                    ) : active ? (
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--gold)]" />
                    ) : (
                      <span className="inline-block h-2 w-2 rounded-full bg-[var(--muted)]/30" />
                    )}
                    <span
                      className={
                        done
                          ? "text-[var(--bright-green)]"
                          : active
                            ? "text-[var(--gold)]"
                            : "text-[var(--muted)]"
                      }
                    >
                      {title}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-[var(--gold)] underline underline-offset-2 hover:opacity-80"
        >
          Go back
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed inset-x-0 overflow-y-auto px-4 md:left-20"
        style={{ top: 64, bottom: 176, WebkitOverflowScrolling: "touch" }}
      >
        <div className="mx-auto w-full max-w-4xl space-y-4 py-4">
          {(goal || target || attainments.length > 0) && (
            <div className="rounded-xl border border-[rgba(228,201,126,0.3)] bg-[var(--card-bg)] px-4 py-3">
              {goal && (
                <p className="text-sm">
                  <span className="text-[var(--muted)]">Goal:</span>{" "}
                  <span className="font-medium text-[var(--gold)]">{goal}</span>
                </p>
              )}
              {target && (
                <p className="mt-1 text-sm">
                  <span className="text-[var(--muted)]">Target:</span>{" "}
                  <span className="font-medium text-[var(--bright-green)]">{target}</span>
                </p>
              )}
              {attainments.length > 0 && (
                <p className="mt-1 text-sm">
                  <span className="text-[var(--muted)]">Hope to get:</span>{" "}
                  <span className="text-[var(--light)]">{attainments.join(", ")}</span>
                </p>
              )}
            </div>
          )}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center pb-4 pt-8 text-center md:pt-16">
              <h1 className="text-2xl font-semibold text-[var(--light)]">
                What&apos;s your goal?
              </h1>
              <p className="mt-3 max-w-md text-sm text-[var(--muted)]">
                Tell me any life goal — mortgage, quit smoking, run a marathon, get a dog — and
                when you want to achieve it. I&apos;ll build you a step-by-step pathway with
                real dates and costs.
              </p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-[rgba(228,201,126,0.15)] text-[var(--light)]"
                    : m.role === "system"
                      ? "bg-red-900/20 text-red-300"
                      : "bg-[var(--darker-bg)] text-[var(--light)]"
                }`}
              >
                {m.role === "assistant" ? (
                  <div className="prose-chat text-sm leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                )}
              </div>
            </div>
          ))}

          {showBuildButton && !limitReached && !loading && messages.filter((m) => m.role === "user").length >= 2 && (
            <div className="flex justify-center py-3">
              <button
                onClick={handleBuildPathway}
                disabled={buildLoading}
                className="btn-cta flex items-center gap-2 rounded-xl px-6 py-3 text-base font-semibold shadow-lg transition-all hover:scale-[1.02] disabled:opacity-50"
              >
                {buildLoading ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--dark)] border-t-transparent" />
                    Building...
                  </>
                ) : (
                  <>
                    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                      <path
                        d="M10 2L13 8H18L14 12L15.5 18L10 14.5L4.5 18L6 12L2 8H7L10 2Z"
                        fill="currentColor"
                      />
                    </svg>
                    Build my pathway
                  </>
                )}
              </button>
            </div>
          )}

          {limitReached && (
            <div className="mx-auto max-w-md rounded-2xl border border-[rgba(228,201,126,0.3)] bg-[rgba(228,201,126,0.05)] p-6 text-center">
              <h3 className="text-lg font-semibold text-[var(--gold)]">
                You&apos;ve used your pathway allowance
              </h3>
              <p className="mt-2 text-sm text-[var(--muted)]">
                Upgrade to continue building pathways and return to this one.
              </p>
              <a
                href={pathwayId ? `/upgrade?returnTo=${encodeURIComponent(`/goal/new?resume=${pathwayId}`)}` : "/upgrade"}
                className="btn-cta mt-4 inline-block rounded-xl px-6 py-3 font-semibold"
              >
                Upgrade to continue
              </a>
            </div>
          )}

          {streamingText && (
            <div className="flex justify-start">
              <div className="max-w-[85%] rounded-2xl bg-[var(--darker-bg)] px-4 py-3">
                <div className="prose-chat text-sm leading-relaxed text-[var(--light)]">
                  <ReactMarkdown>{streamingText}</ReactMarkdown>
                  <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-[var(--gold)]" />
                </div>
              </div>
            </div>
          )}

          {toolStatus && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-full bg-[rgba(228,201,126,0.1)] px-4 py-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-[var(--gold)]" />
                <span className="text-xs text-[var(--gold)]">{toolStatus}...</span>
              </div>
            </div>
          )}

          {loading && !streamingText && !toolStatus && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl bg-[var(--darker-bg)] px-4 py-3">
                <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:0ms]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:150ms]" />
                <div className="h-2 w-2 animate-bounce rounded-full bg-[var(--muted)] [animation-delay:300ms]" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[rgba(228,201,126,0.15)] bg-[var(--card-bg)] px-4 py-3 md:left-20">
        {limitReached ? (
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 py-1">
            <p className="text-sm text-[var(--muted)]">Chat locked until you upgrade</p>
            <a
              href={pathwayId ? `/upgrade?returnTo=${encodeURIComponent(`/goal/new?resume=${pathwayId}`)}` : "/upgrade"}
              className="btn-cta flex w-full max-w-sm items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold"
            >
              Upgrade to continue
            </a>
          </div>
        ) : inputLocked ? (
          <div className="mx-auto flex max-w-4xl flex-col items-center gap-2 py-1">
            <button
              onClick={handleBuildPathway}
              disabled={buildLoading}
              className="btn-cta flex w-full max-w-sm items-center justify-center gap-2 rounded-xl px-6 py-3 text-base font-semibold"
            >
              {buildLoading ? "Building..." : "Build my pathway"}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mx-auto flex max-w-4xl items-end gap-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                messages.length === 0
                  ? "I want to get a mortgage by 2028..."
                  : "Type your message..."
              }
              className="input-athro flex-1 resize-none overflow-y-auto px-4 py-3"
              rows={3}
              style={{
                minHeight: "4.5rem",
                maxHeight: "9rem",
                lineHeight: 1.5,
              }}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="btn-cta shrink-0 self-end rounded-xl px-5 py-2.5 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </>
  );
}
