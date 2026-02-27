import { useEffect, useMemo, useState, useCallback, type CSSProperties } from "react";
import { FiCheckCircle, FiAlertCircle, FiSend } from "react-icons/fi";

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

type PairwiseSelection = {
  direction: PairwiseDirection;
  magnitude: number;
};

type PairwisePair = {
  key: string;
  leftIndex: number;
  rightIndex: number;
  left: ParticipantTaskNode;
  right: ParticipantTaskNode;
};

const crThresholdRaw = import.meta.env.VITE_CR_THRESHOLD as string;
const pairwiseScaleRaw = import.meta.env.VITE_PAIRWISE_SCALE as string;

if (!crThresholdRaw) {
  throw new Error("VITE_CR_THRESHOLD is not defined");
}

if (!pairwiseScaleRaw) {
  throw new Error("VITE_PAIRWISE_SCALE is not defined");
}

const crThreshold = Number(crThresholdRaw);

const parsePairwiseScale = (raw: string) => {
  const values = raw
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => !Number.isNaN(value));
  const hasZero = values.some((value) => value === 0);
  if (hasZero) {
    throw new Error("VITE_PAIRWISE_SCALE must not include 0");
  }
  const uniqueValues = Array.from(new Set(values.map((value) => Math.abs(value))));
  if (uniqueValues.length === 0) {
    throw new Error("VITE_PAIRWISE_SCALE is invalid");
  }
  const hasInvalid = uniqueValues.some((value) => value <= 0);
  if (hasInvalid) {
    throw new Error("VITE_PAIRWISE_SCALE must contain non-zero numbers");
  }
  uniqueValues.sort((a, b) => a - b);
  if (!uniqueValues.includes(1)) {
    throw new Error("VITE_PAIRWISE_SCALE must include 1");
  }
  return uniqueValues;
};

const pairwiseScale = parsePairwiseScale(pairwiseScaleRaw);
const pairwiseEqualValue = pairwiseScale.find((value) => value === 1);

if (!pairwiseEqualValue) {
  throw new Error("VITE_PAIRWISE_SCALE must include 1");
}

const pairwiseScaleWithoutEqual = pairwiseScale.filter((value) => value !== pairwiseEqualValue);
const pairwiseScaleAscending = [...pairwiseScaleWithoutEqual];
const pairwiseScaleDescending = [...pairwiseScaleWithoutEqual].reverse();
const pairwiseScaleColumnCount = pairwiseScaleDescending.length + 1 + pairwiseScaleAscending.length;

function buildDepthMap(nodes: ParticipantTaskNode[]): Map<string, number> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depthMap = new Map<string, number>();
  const getDepth = (nodeId: string): number => {
    const cached = depthMap.get(nodeId);
    if (cached !== undefined) return cached;
    const node = byId.get(nodeId);
    if (!node) return 0;
    const d = node.parent_id == null ? 0 : 1 + getDepth(node.parent_id);
    depthMap.set(nodeId, d);
    return d;
  };
  nodes.forEach((n) => getDepth(n.id));
  return depthMap;
}

const buildPairwisePairs = (items: ParticipantTaskNode[]) => {
  const pairs: PairwisePair[] = [];
  items.forEach((left, leftIndex) => {
    items.slice(leftIndex + 1).forEach((right, offset) => {
      const rightIndex = leftIndex + offset + 1;
      pairs.push({
        key: `${left.id}__${right.id}`,
        leftIndex,
        rightIndex,
        left,
        right,
      });
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
  const matrix = Array.from({ length: size }, (_, rowIndex) =>
    Array.from({ length: size }, (_, colIndex) => (rowIndex === colIndex ? equalValue : 0))
  );
  const missingKeys: string[] = [];

  pairs.forEach((pair) => {
    const selection = selections[pair.key];
    if (!selection) {
      missingKeys.push(pair.key);
      return;
    }

    if (selection.direction === "equal") {
      matrix[pair.leftIndex][pair.rightIndex] = equalValue;
      matrix[pair.rightIndex][pair.leftIndex] = equalValue;
      return;
    }

    if (selection.direction === "right") {
      matrix[pair.leftIndex][pair.rightIndex] = equalValue / selection.magnitude;
      matrix[pair.rightIndex][pair.leftIndex] = selection.magnitude;
      return;
    }

    matrix[pair.leftIndex][pair.rightIndex] = selection.magnitude;
    matrix[pair.rightIndex][pair.leftIndex] = equalValue / selection.magnitude;
  });

  return { matrix, missingKeys };
};

const computePriorityVector = (matrix: number[][]) => {
  const size = matrix.length;
  const geometricMeans = matrix.map((row) => {
    const product = row.reduce((acc, value) => acc * value, 1);
    return Math.pow(product, 1 / size);
  });
  const total = geometricMeans.reduce((acc, value) => acc + value, 0);
  if (total === 0) {
    return geometricMeans.map(() => 0);
  }
  return geometricMeans.map((value) => value / total);
};

const findMostInconsistentPair = (matrix: number[][], pairs: PairwisePair[]) => {
  if (pairs.length === 0) {
    return null;
  }
  const weights = computePriorityVector(matrix);
  let maxPair: PairwisePair | null = null;
  let maxDeviation = -Infinity;

  pairs.forEach((pair) => {
    const expected = weights[pair.leftIndex] / weights[pair.rightIndex];
    const observed = matrix[pair.leftIndex][pair.rightIndex];
    if (expected <= 0 || observed <= 0) {
      return;
    }
    const deviation = Math.abs(Math.log(observed / expected));
    if (deviation > maxDeviation) {
      maxDeviation = deviation;
      maxPair = pair;
    }
  });

  return maxPair;
};

// CR 계산을 위한 Random Index 테이블
const RANDOM_INDEX: { [key: number]: number } = {
  1: 0.0,
  2: 0.0,
  3: 0.58,
  4: 0.9,
  5: 1.12,
  6: 1.24,
  7: 1.32,
  8: 1.41,
  9: 1.45,
  10: 1.49,
};

const computeConsistencyRatio = (matrix: number[][]): { ci: number; cr: number } => {
  const n = matrix.length;
  if (n <= 2) {
    return { ci: 0, cr: 0 };
  }

  const weights = computePriorityVector(matrix);
  
  // λmax 계산
  let lambdaMax = 0;
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      sum += matrix[i][j] * weights[j];
    }
    lambdaMax += sum / weights[i];
  }
  lambdaMax /= n;

  // CI 계산
  const ci = (lambdaMax - n) / (n - 1);
  
  // CR 계산
  const ri = RANDOM_INDEX[n] || 1.49;
  const cr = ci / ri;

  return { ci, cr };
};

// 매트릭스에서 쌍대비교 선택 상태를 복원하는 함수
const restoreSelectionsFromMatrix = (
  matrix: number[][],
  pairwisePairs: PairwisePair[],
  pairwiseEqualValue: number
): Record<string, PairwiseSelection> => {
  const selections: Record<string, PairwiseSelection> = {};
  
  pairwisePairs.forEach((pair) => {
    const value = matrix[pair.leftIndex][pair.rightIndex];
    
    if (value === pairwiseEqualValue) {
      selections[pair.key] = {
        direction: "equal",
        magnitude: pairwiseEqualValue,
      };
    } else if (value > pairwiseEqualValue) {
      selections[pair.key] = {
        direction: "left",
        magnitude: value,
      };
    } else if (value < pairwiseEqualValue) {
      selections[pair.key] = {
        direction: "right",
        magnitude: 1 / value,
      };
    }
  });
  
  return selections;
};

const ParticipantPage = () => {
  const [participantCode, setParticipantCode] = useState("");
  const [tasks, setTasks] = useState<TasksResponse | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [pairwiseSelections, setPairwiseSelections] = useState<Record<string, PairwiseSelection>>({});
  const [submitResult, setSubmitResult] = useState<SubmitResponse | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [realtimeCR, setRealtimeCR] = useState<{ ci: number; cr: number } | null>(null);

  const selectedNode = useMemo(
    () => tasks?.nodes.find((node) => node.id === selectedNodeId) ?? null,
    [tasks, selectedNodeId]
  );
  const rootGoalNode = useMemo(
    () => tasks?.nodes.find((node) => node.parent_id == null) ?? null,
    [tasks]
  );

  const nodeMap = useMemo(() => new Map(tasks?.nodes.map((node) => [node.id, node]) ?? []), [tasks]);

  const childNodes = useMemo(() => {
    if (!selectedNode) {
      return [];
    }
    const resolved = selectedNode.child_ids
      .map((childId) => nodeMap.get(childId))
      .filter((node): node is ParticipantTaskNode => Boolean(node));
    return resolved.sort((first, second) => first.sort_order - second.sort_order);
  }, [nodeMap, selectedNode]);

  const pairwisePairs = useMemo(() => buildPairwisePairs(childNodes), [childNodes]);

  // pairwiseSelections의 key들을 문자열로 변환하여 안정적인 dependency 제공
  const selectionsKeys = useMemo(
    () => Object.keys(pairwiseSelections).sort().join(','),
    [pairwiseSelections]
  );
  
  const selectionsValues = useMemo(
    () => JSON.stringify(pairwiseSelections),
    [pairwiseSelections]
  );

  const matrixResult = useMemo(
    () => buildMatrixFromSelections(childNodes.length, pairwisePairs, pairwiseSelections, pairwiseEqualValue),
    [childNodes.length, pairwisePairs, selectionsKeys, selectionsValues, pairwiseEqualValue]
  );

  const selectedPairCount = Object.keys(pairwiseSelections).length;
  const isComplete = pairwisePairs.length === 0 || selectedPairCount === pairwisePairs.length;

  const mostInconsistentPair = useMemo(() => {
    if (!isComplete) {
      return null;
    }
    return findMostInconsistentPair(matrixResult.matrix, pairwisePairs);
  }, [isComplete, matrixResult.matrix, pairwisePairs]);

  // 실시간 CR 계산 - CR 결과를 메모이제이션하여 불필요한 재계산 방지
  const realtimeCRCalculation = useMemo(() => {
    if (isComplete && matrixResult.matrix.length > 0) {
      return computeConsistencyRatio(matrixResult.matrix);
    }
    return null;
  }, [isComplete, matrixResult.matrix]);
  
  useEffect(() => {
    setRealtimeCR(realtimeCRCalculation);
  }, [realtimeCRCalculation]);

  const loadTasks = useCallback(async () => {
    try {
      setMessage(null);
      const data = await apiGet<TasksResponse>(
        Endpoints.participant.tasks(participantCode),
        { cache: "no-store" }
      );
      setTasks(data);

      // comparables와 동일 조건: 자식 2명 이상, depth·sort_order 정렬 후 첫 미완료(또는 첫 항목) 선택
      const depthMap = buildDepthMap(data.nodes);
      const comparableNodes = data.nodes
        .filter((node) => node.child_ids.length >= 2)
        .sort((a, b) => {
          const da = depthMap.get(a.id) ?? 0;
          const db = depthMap.get(b.id) ?? 0;
          if (da !== db) return da - db;
          return a.sort_order - b.sort_order;
        });
      if (comparableNodes.length > 0) {
        const incompleteNode = comparableNodes.find(
          (node) => node.consistency_ratio == null
        );
        if (incompleteNode) {
          const firstNodeToSelect = incompleteNode;
          setSelectedNodeId(firstNodeToSelect.id);
          // 새로 선택된 노드에 matrix가 있으면 복원 (buildPairwisePairs와 동일 key 사용)
          const childNodesForNext = data.nodes
            .filter((n) => firstNodeToSelect.child_ids.includes(n.id))
            .sort((a, b) => a.sort_order - b.sort_order);
          const pairsForNext = buildPairwisePairs(childNodesForNext);
          if (firstNodeToSelect.matrix) {
            setPairwiseSelections(
              restoreSelectionsFromMatrix(firstNodeToSelect.matrix, pairsForNext, pairwiseEqualValue)
            );
          } else {
            setPairwiseSelections({});
          }
        } else {
          // 모든 설문 완료: 선택 해제 후 완료 메시지 표시
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

  const handleParticipantCodeKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      loadTasks();
    }
  };

  const handleParticipantCodeChange = (code: string) => {
    setParticipantCode(code);
  };

  const selectNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    setSubmitResult(null);
    setMessage(null);
    
    // 선택된 노드의 기존 매트릭스 데이터가 있으면 복원
    const node = tasks?.nodes.find(n => n.id === nodeId);
    if (node && node.matrix) {
      // 자식 노드들을 가져와서 쌍대비교 쌍을 생성
      const childNodes = tasks.nodes.filter(n => node.child_ids.includes(n.id))
        .sort((a, b) => a.sort_order - b.sort_order);
      
      const pairs = buildPairwisePairs(childNodes);
      
      // 매트릭스에서 선택 상태 복원
      const restoredSelections = restoreSelectionsFromMatrix(node.matrix, pairs, pairwiseEqualValue);
      setPairwiseSelections(restoredSelections);
    } else {
      setPairwiseSelections({});
    }
  };

  const submitMatrix = async () => {
    if (!selectedNode) {
      return;
    }
    try {
      setMessage(null);
      if (pairwisePairs.length > 0 && selectedPairCount !== pairwisePairs.length) {
        setMessage("모든 비교 값을 선택하세요.");
        return;
      }
      const payload = {
        participant_code: participantCode,
        node_id: selectedNode.id,
        matrix: matrixResult.matrix,
      };
      const data = await apiPost<SubmitResponse, typeof payload>(Endpoints.participant.submit, payload);
      setSubmitResult(data);
      await loadTasks();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "응답 제출 오류");
    }
  };

  const updateSelection = (pairKey: string, direction: PairwiseDirection, magnitude: number) => {
    setPairwiseSelections((prev) => ({
      ...prev,
      [pairKey]: { direction, magnitude },
    }));
    setSubmitResult(null);
  };

  const depthMap = useMemo(
    () => (tasks?.nodes ? buildDepthMap(tasks.nodes) : new Map<string, number>()),
    [tasks?.nodes]
  );

  const comparables = useMemo(() => {
    if (!tasks?.nodes.length) return [];
    return tasks.nodes
      .filter((node) => node.child_ids.length >= 2)
      .sort((a, b) => {
        const da = depthMap.get(a.id) ?? 0;
        const db = depthMap.get(b.id) ?? 0;
        if (da !== db) return da - db;
        return a.sort_order - b.sort_order;
      });
  }, [tasks?.nodes, depthMap]);

  const isLastStep = useMemo(() => {
    if (!selectedNodeId || !comparables.length) return false;
    const incompleteExcludingCurrent = comparables.filter(
      (n) => n.id !== selectedNodeId && n.consistency_ratio == null
    );
    return incompleteExcludingCurrent.length === 0;
  }, [comparables, selectedNodeId]);

  const crThresholdLabel = Number.isFinite(crThreshold) ? crThreshold.toFixed(2) : String(crThreshold);
  
  // 실시간 CR을 우선적으로 사용
  const currentCrValue = realtimeCR?.cr ?? submitResult?.consistency_ratio ?? selectedNode?.consistency_ratio ?? null;
  const hasCurrentCr = currentCrValue !== null;
  const isCurrentCrHigh = hasCurrentCr && currentCrValue > crThreshold;
  const currentCrLabel = currentCrValue !== null ? currentCrValue.toFixed(4) : "-";

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          {/* 헤더에서 제목을 표시하므로 중복 제거 */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Input
              value={participantCode}
              onChange={(e) => handleParticipantCodeChange(e.target.value)}
              onKeyDown={handleParticipantCodeKeyDown}
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
          <div className="grid grid-cols-1 gap-6">
            <Card className="border-l-4 border-l-[var(--color-primary)]">
              <div className="form-stack">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">설문 정보</h2>
                  {comparables.length > 0 && (
                    <span className="text-sm font-medium text-[var(--color-text-secondary)]">
                      진행: {comparables.filter((n) => n.consistency_ratio != null).length} / {comparables.length} 노드 완료
                    </span>
                  )}
                </div>
                <div className="participant-project-summary">
                  <p className="participant-project-summary-line">
                    프로젝트 : <span className="participant-project-summary-value">{tasks.project_name}</span>
                  </p>
                  <p className="participant-project-summary-line">
                    AHP목표 : <span className="participant-project-summary-value">{rootGoalNode?.name ?? "-"}</span>
                  </p>
                </div>
                {comparables.length > 0 && (
                  <div className="space-y-2">
                  {comparables.map((node) => {
                    const depth = depthMap.get(node.id) ?? 0;
                    const isHigh =
                      node.consistency_ratio !== null &&
                      node.consistency_ratio !== undefined &&
                      node.consistency_ratio > crThreshold;
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
                        style={{
                          marginLeft: depth > 0 ? depth * 1.25 + "rem" : 0,
                          ...(depth > 0
                            ? {
                                borderLeft: "2px solid var(--color-border)",
                                paddingLeft: "0.75rem",
                              }
                            : {}),
                        }}
                        className={`p-3 rounded-lg border-2 border-l-4 transition-all cursor-pointer ${
                          isSelected
                            ? "border-[var(--color-primary)] bg-blue-50"
                            : "border-[var(--color-border)] bg-[var(--color-bg-primary)] hover:border-[var(--color-primary-light)]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">{node.name}</span>
                            {isHigh && (
                              <Badge variant="error">
                                <FiAlertCircle className="w-3 h-3 mr-1" />
                                기준 초과
                              </Badge>
                            )}
                          </div>
                          {node.consistency_ratio != null && (
                            <FiCheckCircle className="w-5 h-5 text-[var(--color-success)] flex-shrink-0" aria-hidden />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            </Card>

            <Card>
              {selectedNode ? (
                <div className="form-stack">
                  <div className="p-3 bg-[var(--color-bg-tertiary)] rounded-lg border border-[var(--color-border)]">
                    <h3 className="font-semibold text-base text-[var(--color-text-primary)]">
                      현재 비교 계층 : {selectedNode.name}
                    </h3>
                  </div>

                  <div className="cr-status-card">
                    <div className="cr-status-header">
                      <span className="text-base font-semibold text-[var(--color-text-primary)]">
                        일관성 지수(CR, 기준값 {crThresholdLabel})
                      </span>
                      {hasCurrentCr ? (
                        <Badge variant={isCurrentCrHigh ? "error" : "success"}>
                          {isCurrentCrHigh ? "기준 초과" : "기준 통과"}
                        </Badge>
                      ) : (
                        <Badge variant="info">계산 대기</Badge>
                      )}
                    </div>
                    <div className={`cr-status-value mb-2 ${hasCurrentCr ? (isCurrentCrHigh ? "is-error" : "is-success") : ""}`}>
                      {currentCrLabel}
                    </div>
                  </div>

                  <div className="pairwise-guide-box">
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      왼쪽 항목이 더 중요하면 왼쪽 숫자를, 오른쪽 항목이 더 중요하면 오른쪽 숫자를 선택하세요.
                    </p>
                  </div>
                  
                  {pairwisePairs.length === 0 ? (
                    <Alert variant="info">비교할 쌍이 없습니다.</Alert>
                  ) : (
                    <>
                      {isComplete && isCurrentCrHigh && mostInconsistentPair && (
                        <Alert variant="warning">
                          가장 비일관성이 높은 비교를 재검토해보세요: {mostInconsistentPair.left.name} vs {mostInconsistentPair.right.name}
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
                          const isAlert = isComplete && isCurrentCrHigh && mostInconsistentPair?.key === pair.key;
                          return (
                            <div key={pair.key} className={`pairwise-comparison ${isAlert ? "is-alert" : ""}`}>
                              <div className="pairwise-container">
                                <span className="pairwise-name-left">{pair.left.name}</span>
                                <div
                                  className="pairwise-scale"
                                  style={
                                    { ["--pairwise-column-count" as string]: String(pairwiseScaleColumnCount) } as CSSProperties
                                  }
                                >
                                {/* 좌측 버튼들: env 스케일에서 1 제외, 내림차순 */}
                                {pairwiseScaleDescending.map((value) => (
                                  <button
                                    key={`left-${pair.key}-${value}`}
                                    type="button"
                                    className={`scale-button left ${
                                      selection?.direction === "left" && selection.magnitude === value
                                        ? "active"
                                        : ""
                                    }`}
                                    onClick={() => updateSelection(pair.key, "left", value)}
                                    title={`${pair.left.name}이 ${value}배 더 중요`}
                                  >
                                    -{value}
                                  </button>
                                ))}
                                {/* 중앙 버튼 (동일) */}
                                <button
                                  type="button"
                                  className={`scale-button equal ${
                                    selection?.direction === "equal" ? "active" : ""
                                  }`}
                                  onClick={() => updateSelection(pair.key, "equal", pairwiseEqualValue)}
                                  title="동일한 중요도"
                                >
                                  {pairwiseEqualValue}
                                </button>
                                {/* 우측 버튼들: env 스케일에서 1 제외, 오름차순 */}
                                {pairwiseScaleAscending.map((value) => (
                                  <button
                                    key={`right-${pair.key}-${value}`}
                                    type="button"
                                    className={`scale-button right ${
                                      selection?.direction === "right" && selection.magnitude === value
                                        ? "active"
                                        : ""
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
                        <FiSend className="w-4 h-4 mr-1" />
                        {isLastStep ? "제출" : "다음"}
                      </Button>
                      {!isComplete && pairwisePairs.length > 0 && (
                        <Alert variant="info">
                          모든 비교 값을 선택해야 제출할 수 있습니다. ({selectedPairCount} / {pairwisePairs.length} 완료)
                        </Alert>
                      )}
                      {submitResult && (
                        <Card className="bg-[var(--color-bg-tertiary)]">
                          <h3 className="font-semibold mb-2">제출 결과</h3>
                          <div className="space-y-1 text-sm">
                            <p>CI: {submitResult.consistency_index.toFixed(4)}</p>
                          <p
                            className={
                              submitResult.consistency_ratio > crThreshold
                                ? "text-[var(--color-error)] font-semibold"
                                : "text-[var(--color-success)] font-semibold"
                            }
                          >
                            CR(기준값: {crThresholdLabel}): {submitResult.consistency_ratio.toFixed(4)}
                            {submitResult.consistency_ratio > crThreshold ? " (기준 초과)" : " (기준 통과)"}
                          </p>
                          </div>
                        </Card>
                      )}
                    </>
                  )}
                </div>
              ) : comparables.length > 0 ? (
                <div className="text-center py-8">
                  <p className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
                    모든 설문이 제출되었습니다.
                  </p>
                  <p className="text-[var(--color-text-secondary)]">
                    참여해 주셔서 감사합니다.
                  </p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-[var(--color-text-secondary)]">비교할 항목을 선택하세요.</p>
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
