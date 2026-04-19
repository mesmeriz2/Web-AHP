import {
  useEffect,
  useMemo,
  useState,
  useCallback,
  type CSSProperties,
} from "react";
import { FiCheckCircle, FiAlertCircle, FiSend, FiChevronRight } from "react-icons/fi";

import { apiGet, apiPost } from "../api/client";
import { Endpoints } from "../api/endpoints";
import type { SubmitResponse, TasksResponse } from "../types/api";
import Layout from "../components/common/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Input from "../components/common/Input";
import Alert from "../components/common/Alert";
import Badge from "../components/common/Badge";

import type { ParticipantTaskNode } from "../types/api";

type PairwiseDirection = "left" | "right" | "equal";
type PairwiseSelection = { direction: PairwiseDirection; magnitude: number };
type PairwisePair = {
  key: string;
  leftIndex: number;
  rightIndex: number;
  left: ParticipantTaskNode;
  right: ParticipantTaskNode;
};

const crThresholdRaw = import.meta.env.VITE_CR_THRESHOLD as string;
const pairwiseScaleRaw = import.meta.env.VITE_PAIRWISE_SCALE as string;

if (!crThresholdRaw) throw new Error("VITE_CR_THRESHOLD is not defined");
if (!pairwiseScaleRaw) throw new Error("VITE_PAIRWISE_SCALE is not defined");

const crThreshold = Number(crThresholdRaw);

const parsePairwiseScale = (raw: string) => {
  const values = raw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v));
  if (values.some((v) => v === 0)) throw new Error("VITE_PAIRWISE_SCALE must not include 0");
  const unique = Array.from(new Set(values.map((v) => Math.abs(v)))).sort((a, b) => a - b);
  if (unique.length === 0 || unique.some((v) => v <= 0)) throw new Error("VITE_PAIRWISE_SCALE is invalid");
  if (!unique.includes(1)) throw new Error("VITE_PAIRWISE_SCALE must include 1");
  return unique;
};

const pairwiseScale = parsePairwiseScale(pairwiseScaleRaw);
const pairwiseEqualValue = 1;
const pairwiseScaleWithoutEqual = pairwiseScale.filter((v) => v !== pairwiseEqualValue);
const pairwiseScaleAscending = [...pairwiseScaleWithoutEqual];
const pairwiseScaleDescending = [...pairwiseScaleWithoutEqual].reverse();
const pairwiseScaleColumnCount = pairwiseScaleDescending.length + 1 + pairwiseScaleAscending.length;

function buildDepthMap(nodes: ParticipantTaskNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthMap = new Map<string, number>();
  const getDepth = (id: string): number => {
    const cached = depthMap.get(id);
    if (cached !== undefined) return cached;
    const node = byId.get(id);
    if (!node) return 0;
    const d = node.parent_id == null ? 0 : 1 + getDepth(node.parent_id);
    depthMap.set(id, d);
    return d;
  };
  nodes.forEach((n) => getDepth(n.id));
  return depthMap;
}

const buildPairwisePairs = (items: ParticipantTaskNode[]) => {
  const pairs: PairwisePair[] = [];
  items.forEach((left, li) => {
    items.slice(li + 1).forEach((right, offset) => {
      pairs.push({ key: `${left.id}__${right.id}`, leftIndex: li, rightIndex: li + offset + 1, left, right });
    });
  });
  return pairs;
};

const buildMatrixFromSelections = (
  size: number,
  pairs: PairwisePair[],
  selections: Record<string, PairwiseSelection>,
  equalValue: number
) => {
  const matrix = Array.from({ length: size }, (_, r) =>
    Array.from({ length: size }, (_, c) => (r === c ? equalValue : 0))
  );
  const missingKeys: string[] = [];
  pairs.forEach((pair) => {
    const sel = selections[pair.key];
    if (!sel) { missingKeys.push(pair.key); return; }
    if (sel.direction === "equal") {
      matrix[pair.leftIndex][pair.rightIndex] = equalValue;
      matrix[pair.rightIndex][pair.leftIndex] = equalValue;
    } else if (sel.direction === "right") {
      matrix[pair.leftIndex][pair.rightIndex] = equalValue / sel.magnitude;
      matrix[pair.rightIndex][pair.leftIndex] = sel.magnitude;
    } else {
      matrix[pair.leftIndex][pair.rightIndex] = sel.magnitude;
      matrix[pair.rightIndex][pair.leftIndex] = equalValue / sel.magnitude;
    }
  });
  return { matrix, missingKeys };
};

const computePriorityVector = (matrix: number[][]) => {
  const size = matrix.length;
  const gm = matrix.map((row) => Math.pow(row.reduce((a, v) => a * v, 1), 1 / size));
  const total = gm.reduce((a, v) => a + v, 0);
  return total === 0 ? gm.map(() => 0) : gm.map((v) => v / total);
};

const findMostInconsistentPair = (matrix: number[][], pairs: PairwisePair[]) => {
  if (!pairs.length) return null;
  const weights = computePriorityVector(matrix);
  let maxPair: PairwisePair | null = null;
  let maxDev = -Infinity;
  pairs.forEach((pair) => {
    const expected = weights[pair.leftIndex] / weights[pair.rightIndex];
    const observed = matrix[pair.leftIndex][pair.rightIndex];
    if (expected <= 0 || observed <= 0) return;
    const dev = Math.abs(Math.log(observed / expected));
    if (dev > maxDev) { maxDev = dev; maxPair = pair; }
  });
  return maxPair;
};

const RANDOM_INDEX: Record<number, number> = {
  1: 0, 2: 0, 3: 0.58, 4: 0.9, 5: 1.12, 6: 1.24, 7: 1.32, 8: 1.41, 9: 1.45, 10: 1.49,
};

const computeConsistencyRatio = (matrix: number[][]): { ci: number; cr: number } => {
  const n = matrix.length;
  if (n <= 2) return { ci: 0, cr: 0 };
  const weights = computePriorityVector(matrix);
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) sum += matrix[i][j] * weights[j];
    lambdaMax += sum / weights[i];
  }
  lambdaMax /= n;
  const ci = (lambdaMax - n) / (n - 1);
  const cr = ci / (RANDOM_INDEX[n] ?? 1.49);
  return { ci, cr };
};

const restoreSelectionsFromMatrix = (
  matrix: number[][],
  pairs: PairwisePair[],
  equalValue: number
): Record<string, PairwiseSelection> => {
  const selections: Record<string, PairwiseSelection> = {};
  pairs.forEach((pair) => {
    const value = matrix[pair.leftIndex][pair.rightIndex];
    if (value === equalValue)     selections[pair.key] = { direction: "equal", magnitude: equalValue };
    else if (value > equalValue)  selections[pair.key] = { direction: "left",  magnitude: value };
    else                          selections[pair.key] = { direction: "right", magnitude: 1 / value };
  });
  return selections;
};

/* ── CR Gauge ──────────────────────────────────────────────────── */
const CRGauge = ({
  value,
  threshold,
  size = 72,
}: {
  value: number | null;
  threshold: number;
  size?: number;
}) => {
  const r = (size - 8) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = value !== null ? Math.min(value / threshold, 1.5) : 0;
  const dashOffset = circumference - (ratio / 1.5) * circumference;
  const isSuccess = value !== null && value <= threshold;
  const isError   = value !== null && value > threshold;

  return (
    <div className="cr-gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="cr-gauge-track"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={5}
        />
        <circle
          className={`cr-gauge-fill ${isSuccess ? "is-success" : isError ? "is-error" : "is-neutral"}`}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={5}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="cr-gauge-center" style={{ color: isSuccess ? "var(--color-success)" : isError ? "var(--color-error)" : undefined }}>
        {value !== null ? value.toFixed(3) : "—"}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════
   Main component
   ══════════════════════════════════════════════════════════════ */
const ParticipantPage = () => {
  const [participantCode, setParticipantCode] = useState("");
  const [tasks, setTasks] = useState<TasksResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pairwiseSelections, setPairwiseSelections] = useState<Record<string, PairwiseSelection>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [realtimeCR, setRealtimeCR] = useState<{ ci: number; cr: number } | null>(null);
  const [panelKey, setPanelKey] = useState(0);

  const selectedNode = useMemo(
    () => tasks?.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [tasks, selectedNodeId]
  );
  const rootGoalNode = useMemo(
    () => tasks?.nodes.find((n) => n.parent_id == null) ?? null,
    [tasks]
  );
  const nodeMap = useMemo(
    () => new Map(tasks?.nodes.map((n) => [n.id, n]) ?? []),
    [tasks]
  );
  const childNodes = useMemo(() => {
    if (!selectedNode) return [];
    return selectedNode.child_ids
      .map((id) => nodeMap.get(id))
      .filter((n): n is ParticipantTaskNode => Boolean(n))
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [nodeMap, selectedNode]);

  const pairwisePairs = useMemo(() => buildPairwisePairs(childNodes), [childNodes]);

  const selectionsKeys   = useMemo(() => Object.keys(pairwiseSelections).sort().join(","), [pairwiseSelections]);
  const selectionsValues = useMemo(() => JSON.stringify(pairwiseSelections), [pairwiseSelections]);

  const matrixResult = useMemo(
    () => buildMatrixFromSelections(childNodes.length, pairwisePairs, pairwiseSelections, pairwiseEqualValue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [childNodes.length, pairwisePairs, selectionsKeys, selectionsValues]
  );

  const selectedPairCount = Object.keys(pairwiseSelections).length;
  const isComplete = pairwisePairs.length === 0 || selectedPairCount === pairwisePairs.length;

  const mostInconsistentPair = useMemo(() => {
    if (!isComplete) return null;
    return findMostInconsistentPair(matrixResult.matrix, pairwisePairs);
  }, [isComplete, matrixResult.matrix, pairwisePairs]);

  const realtimeCRCalc = useMemo(() => {
    if (isComplete && matrixResult.matrix.length > 0)
      return computeConsistencyRatio(matrixResult.matrix);
    return null;
  }, [isComplete, matrixResult.matrix]);

  useEffect(() => { setRealtimeCR(realtimeCRCalc); }, [realtimeCRCalc]);

  const depthMap = useMemo(
    () => (tasks?.nodes ? buildDepthMap(tasks.nodes) : new Map<string, number>()),
    [tasks?.nodes]
  );

  const comparables = useMemo(() => {
    if (!tasks?.nodes.length) return [];
    return tasks.nodes
      .filter((n) => n.child_ids.length >= 2)
      .sort((a, b) => {
        const da = depthMap.get(a.id) ?? 0;
        const db = depthMap.get(b.id) ?? 0;
        return da !== db ? da - db : a.sort_order - b.sort_order;
      });
  }, [tasks?.nodes, depthMap]);

  const completedCount = comparables.filter((n) => n.consistency_ratio != null).length;
  const progressPct = comparables.length > 0 ? Math.round((completedCount / comparables.length) * 100) : 0;

  const isLastStep = useMemo(() => {
    if (!selectedNodeId || !comparables.length) return false;
    return comparables.filter((n) => n.id !== selectedNodeId && n.consistency_ratio == null).length === 0;
  }, [comparables, selectedNodeId]);

  const loadTasks = useCallback(async () => {
    try {
      setMessage(null);
      const data = await apiGet<TasksResponse>(Endpoints.participant.tasks(participantCode), { cache: "no-store" });
      setTasks(data);
      const dm = buildDepthMap(data.nodes);
      const comp = data.nodes
        .filter((n) => n.child_ids.length >= 2)
        .sort((a, b) => {
          const da = dm.get(a.id) ?? 0, db = dm.get(b.id) ?? 0;
          return da !== db ? da - db : a.sort_order - b.sort_order;
        });

      if (comp.length > 0) {
        const incomplete = comp.find((n) => n.consistency_ratio == null);
        if (incomplete) {
          setSelectedNodeId(incomplete.id);
          setPanelKey((k) => k + 1);
          const childList = data.nodes.filter((n) => incomplete.child_ids.includes(n.id)).sort((a, b) => a.sort_order - b.sort_order);
          const pairs = buildPairwisePairs(childList);
          setPairwiseSelections(incomplete.matrix ? restoreSelectionsFromMatrix(incomplete.matrix, pairs, pairwiseEqualValue) : {});
        } else {
          setSelectedNodeId(null);
          setPairwiseSelections({});
        }
      } else {
        setSelectedNodeId(null);
        setPairwiseSelections({});
      }
      setSubmitResult(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "참여자 정보 조회 오류");
    }
  }, [participantCode]);

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setPanelKey((k) => k + 1);
    setSubmitResult(null);
    setMessage(null);
    const node = tasks?.nodes.find((n) => n.id === nodeId);
    if (node?.matrix) {
      const cl = tasks!.nodes.filter((n) => node.child_ids.includes(n.id)).sort((a, b) => a.sort_order - b.sort_order);
      setPairwiseSelections(restoreSelectionsFromMatrix(node.matrix, buildPairwisePairs(cl), pairwiseEqualValue));
    } else {
      setPairwiseSelections({});
    }
  };

  const submitMatrix = async () => {
    if (!selectedNode) return;
    try {
      setMessage(null);
      if (pairwisePairs.length > 0 && selectedPairCount !== pairwisePairs.length) {
        setMessage("모든 비교 값을 선택하세요.");
        return;
      }
      const payload = { participant_code: participantCode, node_id: selectedNode.id, matrix: matrixResult.matrix };
      const data = await apiPost<SubmitResponse, typeof payload>(Endpoints.participant.submit, payload);
      setSubmitResult(data);
      await loadTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "응답 제출 오류");
    }
  };

  const updateSelection = (pairKey: string, direction: PairwiseDirection, magnitude: number) => {
    setPairwiseSelections((prev) => ({ ...prev, [pairKey]: { direction, magnitude } }));
    setSubmitResult(null);
  };

  const crThresholdLabel = Number.isFinite(crThreshold) ? crThreshold.toFixed(2) : String(crThreshold);
  const currentCrValue  = realtimeCR?.cr ?? submitResult?.consistency_ratio ?? selectedNode?.consistency_ratio ?? null;
  const hasCurrentCr    = currentCrValue !== null;
  const isCurrentCrHigh = hasCurrentCr && currentCrValue > crThreshold;
  const currentCrLabel  = currentCrValue !== null ? currentCrValue.toFixed(4) : "-";

  return (
    <Layout>
      <div className="space-y-5">

        {/* Code entry card */}
        <Card>
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              value={participantCode}
              onChange={(e) => setParticipantCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") loadTasks(); }}
              placeholder="참여자 코드를 입력하세요"
              label="참여자 코드"
              className="flex-1"
            />
            <div className="flex items-end">
              <Button variant="primary" onClick={loadTasks} className="w-full sm:w-auto">
                설문 불러오기
              </Button>
            </div>
          </div>
        </Card>

        {message && (
          <Alert variant="error" onClose={() => setMessage(null)}>
            {message}
          </Alert>
        )}

        {tasks && (
          <div className="grid grid-cols-1" style={{ gap: "1.5rem" }}>

            {/* Project info + node selector */}
            <Card>
              <div className="form-stack">
                {/* Header row */}
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2
                    style={{
                      margin: 0,
                      fontSize: "var(--font-size-lg)",
                      fontWeight: 700,
                      fontFamily: "var(--font-display)",
                      color: "var(--color-text-primary)",
                    }}
                  >
                    설문 정보
                  </h2>
                  {comparables.length > 0 && (
                    <span
                      style={{
                        fontFamily: "var(--font-family-mono)",
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 700,
                        color: "var(--color-primary)",
                        background: "var(--color-primary-pale)",
                        border: "1px solid var(--color-primary)",
                        borderRadius: "var(--radius-full)",
                        padding: "0.2rem 0.65rem",
                      }}
                    >
                      {completedCount} / {comparables.length}
                    </span>
                  )}
                </div>

                {/* Progress bar */}
                {comparables.length > 0 && (
                  <div className="survey-progress">
                    <div className="survey-progress-header">
                      <span className="survey-progress-label">진행률</span>
                      <span className="survey-progress-count">{progressPct}%</span>
                    </div>
                    <div className="survey-progress-track">
                      <div
                        className="survey-progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Project summary */}
                <div className="participant-project-summary">
                  <p className="participant-project-summary-line">
                    프로젝트&nbsp;: <span className="participant-project-summary-value">{tasks.project_name}</span>
                  </p>
                  <p className="participant-project-summary-line">
                    AHP 목표&nbsp;: <span className="participant-project-summary-value">{rootGoalNode?.name ?? "—"}</span>
                  </p>
                </div>

                {/* Node selector */}
                {comparables.length > 0 && (
                  <div className="space-y-2">
                    {comparables.map((node) => {
                      const depth = depthMap.get(node.id) ?? 0;
                      const isHighCr =
                        node.consistency_ratio != null && node.consistency_ratio > crThreshold;
                      const isDone = node.consistency_ratio != null;
                      const isSelected = selectedNodeId === node.id;

                      return (
                        <div
                          key={node.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => selectNode(node.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              selectNode(node.id);
                            }
                          }}
                          style={{ marginLeft: depth > 0 ? depth * 1.2 + "rem" : 0 }}
                          className={`node-selector-item ${
                            isSelected
                              ? "is-selected"
                              : isDone
                              ? isHighCr
                                ? "is-error"
                                : "is-complete"
                              : ""
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {/* Depth line indicator */}
                            {depth > 0 && (
                              <FiChevronRight
                                size={12}
                                style={{ flexShrink: 0, opacity: 0.5 }}
                              />
                            )}
                            <span
                              style={{
                                fontWeight: 600,
                                fontSize: "var(--font-size-sm)",
                                color: "var(--color-text-primary)",
                              }}
                            >
                              {node.name}
                            </span>
                            {isHighCr && (
                              <Badge variant="error">
                                <FiAlertCircle
                                  size={11}
                                  style={{ marginRight: "0.2rem" }}
                                />
                                기준 초과
                              </Badge>
                            )}
                          </div>
                          {isDone && (
                            <FiCheckCircle
                              size={18}
                              style={{
                                flexShrink: 0,
                                color: isHighCr
                                  ? "var(--color-error)"
                                  : "var(--color-success)",
                              }}
                              aria-hidden
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            {/* Survey panel — animates on node switch */}
            <Card>
              {selectedNode ? (
                <div key={panelKey} className="survey-panel-enter form-stack">
                  {/* Current node indicator */}
                  <div
                    style={{
                      padding: "var(--spacing-3) var(--spacing-4)",
                      background: "var(--color-primary-pale)",
                      borderRadius: "var(--radius-lg)",
                      borderLeft: "3px solid var(--color-primary)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 600,
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "var(--color-primary)",
                        opacity: 0.7,
                        marginBottom: "0.2rem",
                      }}
                    >
                      현재 비교 계층
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontWeight: 700,
                        fontFamily: "var(--font-display)",
                        color: "var(--color-text-primary)",
                        fontSize: "var(--font-size-lg)",
                      }}
                    >
                      {selectedNode.name}
                    </p>
                  </div>

                  {/* CR status */}
                  <div className="cr-status-card">
                    <div className="cr-status-left">
                      <div
                        style={{
                          fontSize: "var(--font-size-sm)",
                          fontWeight: 600,
                          color: "var(--color-text-secondary)",
                          marginBottom: "var(--spacing-1)",
                        }}
                      >
                        일관성 지수 (CR)
                      </div>
                      <div
                        className={`cr-status-value ${
                          hasCurrentCr ? (isCurrentCrHigh ? "is-error" : "is-success") : ""
                        }`}
                      >
                        {currentCrLabel}
                      </div>
                      <div className="cr-status-label">기준값 ≤ {crThresholdLabel}</div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "var(--spacing-3)" }}>
                      <CRGauge value={currentCrValue} threshold={crThreshold} size={72} />
                      {hasCurrentCr && (
                        <Badge variant={isCurrentCrHigh ? "error" : "success"}>
                          {isCurrentCrHigh ? "기준 초과" : "기준 통과"}
                        </Badge>
                      )}
                      {!hasCurrentCr && <Badge variant="info">계산 대기</Badge>}
                    </div>
                  </div>

                  {/* Guide */}
                  <div className="pairwise-guide-box">
                    <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                      왼쪽 항목이 더 중요하면 왼쪽 숫자를, 오른쪽 항목이 더 중요하면 오른쪽 숫자를 선택하세요.
                    </p>
                  </div>

                  {pairwisePairs.length === 0 ? (
                    <Alert variant="info">비교할 쌍이 없습니다.</Alert>
                  ) : (
                    <>
                      {isComplete && isCurrentCrHigh && mostInconsistentPair && (
                        <Alert variant="warning">
                          일관성이 낮습니다. 다음 비교를 재검토해보세요:{" "}
                          <strong>{mostInconsistentPair.left.name}</strong> vs{" "}
                          <strong>{mostInconsistentPair.right.name}</strong>
                        </Alert>
                      )}
                      {isComplete && !isCurrentCrHigh && (
                        <Alert variant="success">
                          일관성이 우수합니다! 제출하여 응답을 저장하세요.
                        </Alert>
                      )}

                      <div className="pairwise-list">
                        {pairwisePairs.map((pair) => {
                          const selection = pairwiseSelections[pair.key];
                          const isAlert =
                            isComplete && isCurrentCrHigh && mostInconsistentPair?.key === pair.key;
                          return (
                            <div key={pair.key} className={`pairwise-comparison ${isAlert ? "is-alert" : ""}`}>
                              <div
                                className="pairwise-container"
                              >
                                <span className="pairwise-name-left">{pair.left.name}</span>
                                <div
                                  className="pairwise-scale"
                                  style={
                                    { ["--pairwise-column-count" as string]: String(pairwiseScaleColumnCount) } as CSSProperties
                                  }
                                >
                                  {pairwiseScaleDescending.map((value) => (
                                    <button
                                      key={`left-${pair.key}-${value}`}
                                      type="button"
                                      className={`scale-button left ${
                                        selection?.direction === "left" && selection.magnitude === value ? "active" : ""
                                      }`}
                                      onClick={() => updateSelection(pair.key, "left", value)}
                                      title={`${pair.left.name}이 ${value}배 더 중요`}
                                    >
                                      {value}
                                    </button>
                                  ))}
                                  <button
                                    type="button"
                                    className={`scale-button equal ${selection?.direction === "equal" ? "active" : ""}`}
                                    onClick={() => updateSelection(pair.key, "equal", pairwiseEqualValue)}
                                    title="동일한 중요도"
                                  >
                                    {pairwiseEqualValue}
                                  </button>
                                  {pairwiseScaleAscending.map((value) => (
                                    <button
                                      key={`right-${pair.key}-${value}`}
                                      type="button"
                                      className={`scale-button right ${
                                        selection?.direction === "right" && selection.magnitude === value ? "active" : ""
                                      }`}
                                      onClick={() => updateSelection(pair.key, "right", value)}
                                      title={`${pair.right.name}이 ${value}배 더 중요`}
                                    >
                                      {value}
                                    </button>
                                  ))}
                                </div>
                                <span className="pairwise-name-right">{pair.right.name}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <Button
                        variant="primary"
                        onClick={submitMatrix}
                        disabled={pairwisePairs.length > 0 && !isComplete}
                        className="w-full"
                      >
                        <FiSend size={15} style={{ marginRight: "0.35rem" }} />
                        {isLastStep ? "최종 제출" : "저장하고 다음"}
                      </Button>

                      {!isComplete && pairwisePairs.length > 0 && (
                        <Alert variant="info">
                          모든 비교 값을 선택해야 제출할 수 있습니다. ({selectedPairCount} / {pairwisePairs.length} 완료)
                        </Alert>
                      )}

                      {submitResult && (
                        <div
                          style={{
                            border: "1px solid var(--color-border)",
                            borderRadius: "var(--radius-lg)",
                            background: "var(--color-bg-elevated)",
                            padding: "var(--spacing-4)",
                          }}
                        >
                          <p style={{ margin: "0 0 var(--spacing-2)", fontWeight: 600, fontSize: "var(--font-size-sm)" }}>
                            제출 결과
                          </p>
                          <p style={{ margin: "0 0 var(--spacing-1)", fontSize: "var(--font-size-sm)", fontFamily: "var(--font-family-mono)", color: "var(--color-text-secondary)" }}>
                            CI: {submitResult.consistency_index.toFixed(4)}
                          </p>
                          <p
                            style={{
                              margin: 0,
                              fontSize: "var(--font-size-sm)",
                              fontFamily: "var(--font-family-mono)",
                              fontWeight: 700,
                              color: submitResult.consistency_ratio > crThreshold
                                ? "var(--color-error)"
                                : "var(--color-success)",
                            }}
                          >
                            CR({crThresholdLabel}): {submitResult.consistency_ratio.toFixed(4)}
                            {submitResult.consistency_ratio > crThreshold ? " — 기준 초과" : " — 기준 통과"}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : comparables.length > 0 ? (
                <div key="complete" className="survey-complete-enter" style={{ textAlign: "center", padding: "var(--spacing-12) var(--spacing-8)" }}>
                  <FiCheckCircle
                    size={48}
                    style={{ color: "var(--color-success)", marginBottom: "var(--spacing-4)" }}
                  />
                  <p
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--font-size-xl)",
                      fontWeight: 700,
                      color: "var(--color-text-primary)",
                      marginBottom: "var(--spacing-2)",
                    }}
                  >
                    모든 설문이 완료되었습니다
                  </p>
                  <p style={{ color: "var(--color-text-secondary)", fontSize: "var(--font-size-base)" }}>
                    소중한 시간을 내어 참여해 주셔서 감사합니다.
                  </p>
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "var(--spacing-8)", color: "var(--color-text-muted)" }}>
                  비교할 항목을 선택하세요.
                </div>
              )}
            </Card>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ParticipantPage;
