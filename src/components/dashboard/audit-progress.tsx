"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui";
import { formatDuration } from "@/lib/format";

interface AuditProgressProps {
  auditId: string;
  initialStatus: string;
  initialProgress: string | null;
  initialPagesCrawled: number;
}

interface ProgressData {
  status: string;
  progress: string | null;
  stage: string;
  percentage: number;
  pagesCrawled: number;
  maxPages: number;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
  elapsedMs: number | null;
}

const POLL_INTERVAL_MS = 3000;

const STATUS_TONE: Record<string, string> = {
  queued: "indigo",
  running: "indigo",
  completed: "green",
  failed: "red",
  cancelled: "gray",
};

function initialData(props: AuditProgressProps): ProgressData {
  return {
    status: props.initialStatus,
    progress: props.initialProgress,
    stage:
      props.initialProgress ??
      (props.initialStatus === "queued" ? "Queued" : props.initialStatus),
    percentage: 0,
    pagesCrawled: props.initialPagesCrawled,
    maxPages: 0,
    startedAt: null,
    finishedAt: null,
    heartbeatAt: null,
    elapsedMs: null,
  };
}

export function AuditProgress({
  auditId,
  initialStatus,
  initialProgress,
  initialPagesCrawled,
}: AuditProgressProps) {
  const [data, setData] = useState<ProgressData>(() =>
    initialData({ auditId, initialStatus, initialProgress, initialPagesCrawled }),
  );
  const [polling, setPolling] = useState(true);
  const [elapsedText, setElapsedText] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function fetchProgress() {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/audits/${auditId}/progress`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as ProgressData;
        setData(json);
        const done =
          json.status === "completed" || json.status === "failed" || json.status === "cancelled";
        setPolling(!done);
        if (json.elapsedMs !== null && json.elapsedMs !== undefined && !done) {
          setElapsedText(
            `elapsed ${formatDuration(new Date(Date.now() - json.elapsedMs), new Date())}`,
          );
        }
      } catch {
        // Keep last known state; retry on next tick.
      }
      if (!cancelled && polling) {
        timer = window.setTimeout(fetchProgress, POLL_INTERVAL_MS);
      }
    }

    fetchProgress();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [auditId, polling]);

  const status = data.status;
  const stage = data.stage;
  const percentage = data.percentage;
  const pagesCrawled = data.pagesCrawled;
  const maxPages = data.maxPages;
  const done =
    status === "completed" || status === "failed" || status === "cancelled";
  const tone = STATUS_TONE[status] ?? "slate";

  return (
    <Card className="overflow-hidden">
      <div className="h-1.5 w-full overflow-hidden bg-slate-100">
        <div
          className="h-full bg-indigo-600 transition-all duration-500 ease-out"
          style={{ width: `${Math.min(100, percentage)}%` }}
        />
      </div>
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between p-5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">
              {status === "queued"
                ? "Audit queued"
                : status === "running"
                  ? "Audit in progress"
                  : status.charAt(0).toUpperCase() + status.slice(1)}
            </span>
            <span
              className={
                tone === "green"
                  ? "text-xs font-medium rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5"
                  : tone === "red"
                    ? "text-xs font-medium rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5"
                    : "text-xs font-medium rounded-full bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5"
              }
            >
              {status}
            </span>
            {done && data.finishedAt && data.startedAt && (
              <span className="text-xs text-slate-500">
                · finished {formatDuration(new Date(data.startedAt), new Date(data.finishedAt))}
              </span>
            )}
          </div>
          <p className="text-sm text-slate-600">{stage}</p>
          {!done && maxPages > 0 && (
            <p className="text-xs text-slate-500">
              {pagesCrawled} / {maxPages} pages crawled
            </p>
          )}
        </div>
        <div className="text-right hidden sm:block">
          <span className="text-lg font-bold text-slate-900">{percentage}%</span>
          {elapsedText && !done && <p className="text-xs text-slate-500 mt-0.5">{elapsedText}</p>}
        </div>
      </div>
    </Card>
  );
}
