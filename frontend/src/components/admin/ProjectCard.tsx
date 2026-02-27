import React, { useEffect, useMemo, useRef, useState } from "react";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import { toJpeg, toPng } from "html-to-image";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Card from "../common/Card";
import Button from "../common/Button";
import Badge from "../common/Badge";
import { FiArchive, FiDownload, FiLayers, FiRefreshCw, FiUsers, FiTrash2 } from "react-icons/fi";

interface HierarchyTreeNode {
  id: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  sort_order: number;
  children?: HierarchyTreeNode[];
}

interface TreeNodeWithWeight extends HierarchyTreeNode {
  weight: number;
  children?: TreeNodeWithWeight[];
}

type FlattenedWeightNode = {
  id: string;
  name: string;
  node_type: string;
  parent_id?: string | null;
  depth: number;
  weight: number;
};

type GraphType = "bar" | "pie";
type DownloadFormat = "png" | "jpg";
type ResultTab = "weights" | "graph";

const CHART_COLORS = [
  "#2563eb",
  "#0891b2",
  "#16a34a",
  "#ca8a04",
  "#dc2626",
  "#9333ea",
  "#7c3aed",
  "#0f766e",
  "#ea580c",
  "#475569",
];

function buildTreeWithWeights(
  hierarchy: HierarchyTreeNode,
  alternativeWeights: { node_id: string; name?: string; weight: number }[]
): TreeNodeWithWeight {
  const weightMap: Record<string, number> = {};
  alternativeWeights.forEach((item) => {
    weightMap[item.node_id] = item.weight;
  });

  function augment(node: HierarchyTreeNode): TreeNodeWithWeight {
    const sortedChildren = node.children?.length
      ? [...node.children].sort((left, right) => left.sort_order - right.sort_order)
      : undefined;
    const children = sortedChildren?.length ? sortedChildren.map(augment) : undefined;
    const weight = children
      ? children.reduce((sum, c) => sum + c.weight, 0)
      : weightMap[node.id] ?? 0;
    return {
      ...node,
      weight,
      children,
    };
  }

  return augment(hierarchy);
}

function flattenWeightedTree(node: TreeNodeWithWeight, depth = 0): FlattenedWeightNode[] {
  const current: FlattenedWeightNode = {
    id: node.id,
    name: node.name,
    node_type: node.node_type,
    parent_id: node.parent_id,
    depth,
    weight: node.weight,
  };
  const children = (node.children ?? []).flatMap((child) => flattenWeightedTree(child, depth + 1));
  return [current, ...children];
}

function truncateLabel(label: string, maxLength = 12): string {
  return label.length > maxLength ? `${label.slice(0, maxLength)}...` : label;
}

function wrapLabelByLength(label: string, maxCharsPerLine: number, maxLines = 3): string[] {
  if (label.length <= maxCharsPerLine) {
    return [label];
  }

  const lines: string[] = [];
  let cursor = 0;
  while (cursor < label.length && lines.length < maxLines) {
    lines.push(label.slice(cursor, cursor + maxCharsPerLine));
    cursor += maxCharsPerLine;
  }

  if (cursor < label.length) {
    const lastIndex = lines.length - 1;
    const lastLine = lines[lastIndex] ?? "";
    lines[lastIndex] = lastLine.length > 1 ? `${lastLine.slice(0, -1)}…` : "…";
  }

  return lines;
}

function sanitizeFileNamePart(value: string): string {
  const cleaned = value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/^_+|_+$/g, "");
  return cleaned.length > 0 ? cleaned : "untitled";
}

interface ProjectCardProps {
  project: {
    id: string;
    name: string;
    description?: string;
    status: string;
    participant_count: number;
    admin_code: string;
    responded_count?: number;
    owner_username?: string;
  };
  onManageHierarchy: () => void;
  onFetchResults: () => void;
  onViewParticipants: () => void;
  onArchive: () => void;
  onRestore?: () => void;
  onDelete: () => void;
  results?: {
    alternative_weights: { node_id: string; name?: string; weight: number }[];
    missing_nodes: string[];
  };
  hierarchy?: HierarchyTreeNode | null;
  maxWeight: number;
  isSuperAdmin?: boolean;
}

const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onManageHierarchy,
  onFetchResults,
  onViewParticipants,
  onArchive,
  onRestore,
  onDelete,
  results,
  hierarchy,
  maxWeight,
  isSuperAdmin = false,
}) => {
  const barMax = maxWeight || 1;
  const [resultTab, setResultTab] = useState<ResultTab>("weights");
  const [graphType, setGraphType] = useState<GraphType>("bar");
  const [selectedDepth, setSelectedDepth] = useState<number | null>(null);
  const [isDownloadingChart, setIsDownloadingChart] = useState(false);
  const graphCaptureRef = useRef<HTMLDivElement | null>(null);

  const weightedTree = useMemo(() => {
    if (!results || !hierarchy) {
      return null;
    }
    return buildTreeWithWeights(hierarchy, results.alternative_weights);
  }, [hierarchy, results]);

  const depthGroups = useMemo(() => {
    if (!weightedTree) {
      return [] as Array<{ depth: number; nodes: FlattenedWeightNode[] }>;
    }
    const grouped = new Map<number, FlattenedWeightNode[]>();
    const flattened = flattenWeightedTree(weightedTree);

    flattened.forEach((node) => {
      if (node.depth === 0) {
        return;
      }
      const existing = grouped.get(node.depth) ?? [];
      grouped.set(node.depth, [...existing, node]);
    });

    if (grouped.size === 0) {
      return [{ depth: 0, nodes: [flattened[0]] }];
    }

    return [...grouped.entries()]
      .sort(([leftDepth], [rightDepth]) => leftDepth - rightDepth)
      .map(([depth, nodes]) => ({
        depth,
        nodes,
      }));
  }, [weightedTree]);

  useEffect(() => {
    if (depthGroups.length === 0) {
      setSelectedDepth(null);
      return;
    }
    const hasCurrentDepth =
      selectedDepth !== null && depthGroups.some((group) => group.depth === selectedDepth);
    if (!hasCurrentDepth) {
      const firstComparableDepth = depthGroups.find((group) => group.nodes.length > 1) ?? depthGroups[0];
      setSelectedDepth(firstComparableDepth.depth);
    }
  }, [depthGroups, selectedDepth]);

  const selectedDepthGroup = useMemo(() => {
    if (depthGroups.length === 0) {
      return null;
    }
    if (selectedDepth === null) {
      return depthGroups[0];
    }
    return depthGroups.find((group) => group.depth === selectedDepth) ?? depthGroups[0];
  }, [depthGroups, selectedDepth]);

  const selectedDepthNodes = useMemo(() => {
    if (!selectedDepthGroup) {
      return [] as FlattenedWeightNode[];
    }
    return selectedDepthGroup.nodes;
  }, [selectedDepthGroup]);

  const sortedDepthGroups = useMemo(
    () =>
      depthGroups.map((group) => ({
        ...group,
        nodes: [...group.nodes].sort((left, right) => right.weight - left.weight),
      })),
    [depthGroups]
  );

  const fallbackChartNodes = useMemo(
    () =>
      (results?.alternative_weights ?? [])
        .map((item) => ({
          id: item.node_id,
          name: item.name ?? item.node_id,
          weight: item.weight,
        })),
    [results]
  );

  const chartSourceNodes = weightedTree ? selectedDepthNodes : fallbackChartNodes;
  const chartNodes = useMemo(() => chartSourceNodes.slice(0, 16), [chartSourceNodes]);
  const hiddenChartNodeCount = Math.max(chartSourceNodes.length - chartNodes.length, 0);

  const chartData = useMemo(
    () =>
      chartNodes.map((node) => ({
        id: node.id,
        name: node.name,
        weight: Number(node.weight.toFixed(6)),
      })),
    [chartNodes]
  );

  const barChartWidth = useMemo(() => {
    if (chartData.length <= 1) {
      return "48%";
    }
    if (chartData.length <= 2) {
      return "58%";
    }
    if (chartData.length <= 3) {
      return "68%";
    }
    if (chartData.length <= 4) {
      return "78%";
    }
    if (chartData.length <= 6) {
      return "88%";
    }
    return "100%";
  }, [chartData.length]);

  const pieChartWidth = useMemo(() => {
    if (chartData.length <= 4) {
      return 360;
    }
    if (chartData.length <= 8) {
      return 420;
    }
    return 500;
  }, [chartData.length]);

  const xAxisLabelCharLimit = useMemo(() => {
    if (chartData.length <= 3) {
      return 14;
    }
    if (chartData.length <= 6) {
      return 10;
    }
    if (chartData.length <= 10) {
      return 8;
    }
    return 6;
  }, [chartData.length]);

  const xAxisLineCount = useMemo(
    () =>
      chartData.reduce(
        (maxLineCount, item) => Math.max(maxLineCount, wrapLabelByLength(item.name, xAxisLabelCharLimit).length),
        1
      ),
    [chartData, xAxisLabelCharLimit]
  );

  const xAxisHeight = useMemo(() => Math.max(32, 14 + xAxisLineCount * 12), [xAxisLineCount]);

  const handleDepthChange = (event: SelectChangeEvent<string>) => {
    const nextDepth = Number(event.target.value);
    if (Number.isNaN(nextDepth)) {
      return;
    }
    setSelectedDepth(nextDepth);
  };

  const handleResultTabChange = (_event: React.SyntheticEvent, nextValue: ResultTab) => {
    setResultTab(nextValue);
  };

  const handleDownloadChart = async (format: DownloadFormat) => {
    const chartTarget = graphCaptureRef.current;
    if (!chartTarget || isDownloadingChart) {
      return;
    }
    setIsDownloadingChart(true);

    try {
      // 폰트/레이아웃 반영 직후 캡처하면 잘리는 사례가 있어 프레임을 한 번 더 대기한다.
      if ("fonts" in document && document.fonts?.ready) {
        await document.fonts.ready;
      }
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const rect = chartTarget.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const options = {
        backgroundColor: "#ffffff",
        cacheBust: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        width,
        height,
        canvasWidth: width,
        canvasHeight: height,
      };

      const depthLabel = selectedDepthGroup ? `${selectedDepthGroup.depth}계층` : "전체계층";
      const graphTypeLabel = graphType === "bar" ? "bar" : "pie";
      const fileName = `${sanitizeFileNamePart(project.name)}_${sanitizeFileNamePart(depthLabel)}_${graphTypeLabel}.${format}`;
      const dataUrl =
        format === "png"
          ? await toPng(chartTarget, options)
          : await toJpeg(chartTarget, { ...options, quality: 0.95 });
      const downloadLink = document.createElement("a");
      downloadLink.download = fileName;
      downloadLink.href = dataUrl;
      downloadLink.click();
    } catch (error) {
      // 다운로드 실패 시 화면 기능 영향 없이 콘솔 로깅
      console.error("차트 다운로드에 실패했습니다.", error);
    } finally {
      setIsDownloadingChart(false);
    }
  };

  const renderWeightRow = (node: FlattenedWeightNode) => {
    return (
      <Box key={node.id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {node.name}
          </Typography>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, bgcolor: "divider", borderRadius: 1, height: 8, overflow: "hidden" }}>
          <Box
            component="span"
            sx={{
              display: "block",
              height: "100%",
              bgcolor: "primary.main",
              width: `${(node.weight / barMax) * 100}%`,
              transition: "width 0.2s",
            }}
          />
        </Box>
        <Typography variant="body2" fontWeight={500} sx={{ width: 72, textAlign: "right", flexShrink: 0 }}>
          {node.weight.toFixed(4)}
        </Typography>
      </Box>
    );
  };

  const renderWrappedXAxisTick = (props: { x?: number; y?: number; payload?: { value?: string } }) => {
    const x = props.x ?? 0;
    const y = props.y ?? 0;
    const label = String(props.payload?.value ?? "");
    const lines = wrapLabelByLength(label, xAxisLabelCharLimit);

    return (
      <g transform={`translate(${x},${y})`}>
        <text textAnchor="middle" fill="currentColor" fontSize={11}>
          {lines.map((line, index) => (
            <tspan key={`${label}-${index}`} x={0} dy={index === 0 ? 10 : 12}>
              {line}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <Card hover className="transition-shadow">
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <Typography variant="h6" component="h3" fontWeight={600}>
              {project.name}
            </Typography>
            <Badge variant={project.status === "active" ? "success" : "default"}>
              {project.status}
            </Badge>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {project.description || "설명 없음"}
          </Typography>
          <Typography variant="body2" color="text.disabled">
            참여 인원: {project.participant_count}명
          </Typography>
          {isSuperAdmin && project.owner_username && (
            <Typography variant="body2" color="text.disabled" sx={{ mt: 0.25 }}>
              소유자: {project.owner_username}
            </Typography>
          )}
          {project.status === "archived" && (
            <Typography variant="body2" color="error.main" sx={{ mt: 0.5 }}>
              참여자 설문 불가
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {project.status === "archived" ? (
            onRestore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRestore}
                sx={{ color: "primary.main", minWidth: "auto", px: 1 }}
                title="프로젝트 복원"
              >
                <FiRefreshCw size={16} />
              </Button>
            )
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={onArchive}
              sx={{ color: "warning.main", minWidth: "auto", px: 1 }}
              title="프로젝트 보관"
            >
              <FiArchive size={16} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            sx={{ color: "error.main", minWidth: "auto", px: 1 }}
            title="프로젝트 삭제"
          >
            <FiTrash2 size={16} />
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        <Button variant="outline" size="sm" onClick={onManageHierarchy} sx={{ flex: 1 }} startIcon={<FiLayers size={16} />}>
          계층구조 관리
        </Button>
        <Button variant="outline" size="sm" onClick={onViewParticipants} sx={{ flex: 1 }} startIcon={<FiUsers size={16} />}>
          참여 현황
        </Button>
        <Button variant="outline" size="sm" onClick={onFetchResults} sx={{ flex: 1 }} startIcon={<FiRefreshCw size={16} />}>
          결과 조회
        </Button>
      </Box>

      {results && (
        <Box sx={{ mt: 2, p: 1.5, bgcolor: "action.hover", borderRadius: 1 }}>
          <Tabs
            value={resultTab}
            onChange={handleResultTabChange}
            variant="fullWidth"
            sx={{
              mb: 1,
              minHeight: 36,
              "& .MuiTabs-indicator": { height: 3 },
              "& .MuiTab-root": { minHeight: 36, py: 0.5, fontSize: 13, fontWeight: 600 },
            }}
          >
            <Tab value="weights" label="가중치 결과" />
            <Tab value="graph" label="그래프" />
          </Tabs>

          {resultTab === "weights" ? (
            weightedTree ? (
              sortedDepthGroups.length > 0 ? (
                <Box sx={{ "& > * + *": { mt: 1 } }}>
                  {sortedDepthGroups.map((group) => (
                    <Box
                      key={`${project.id}-weight-depth-${group.depth}`}
                      sx={{
                        p: 1.25,
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                      }}
                    >
                      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                        <Typography variant="subtitle2" fontWeight={700}>
                          {group.depth}계층
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {group.nodes.length}개 항목
                        </Typography>
                      </Box>
                      <Box sx={{ "& > * + *": { mt: 0.75 } }}>
                        {group.nodes.map((node) => renderWeightRow(node))}
                      </Box>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  표시할 계층 가중치가 없습니다.
                </Typography>
              )
            ) : (
              <Box sx={{ "& > * + *": { mt: 1 } }}>
                {results.alternative_weights.map((item) => (
                  <Box key={item.node_id} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography variant="body2" sx={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name || item.node_id}
                    </Typography>
                    <Box sx={{ flex: 1, bgcolor: "divider", borderRadius: 1, height: 8, overflow: "hidden" }}>
                      <Box
                        component="span"
                        sx={{
                          display: "block",
                          height: "100%",
                          bgcolor: "primary.main",
                          width: `${(item.weight / barMax) * 100}%`,
                          transition: "width 0.2s",
                        }}
                      />
                    </Box>
                    <Typography variant="body2" fontWeight={500} sx={{ width: 64, textAlign: "right" }}>
                      {item.weight.toFixed(4)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )
          ) : (
            <>
              {(selectedDepthGroup || !weightedTree) && (
                <Box
                  sx={{
                    p: 1.5,
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "background.paper",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
                    {weightedTree && depthGroups.length > 1 && selectedDepthGroup && (
                      <FormControl size="small" sx={{ minWidth: 160 }}>
                        <InputLabel id={`depth-select-${project.id}`}>계층 선택</InputLabel>
                        <Select
                          labelId={`depth-select-${project.id}`}
                          value={String(selectedDepthGroup.depth)}
                          label="계층 선택"
                          onChange={handleDepthChange}
                        >
                          {depthGroups.map((group) => (
                            <MenuItem key={`${project.id}-depth-${group.depth}`} value={String(group.depth)}>
                              {`${group.depth}계층 (${group.nodes.length}개)`}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}

                    <Box sx={{ display: "inline-flex", gap: 0.75 }}>
                      <Button
                        variant={graphType === "bar" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setGraphType("bar")}
                      >
                        바 그래프
                      </Button>
                      <Button
                        variant={graphType === "pie" ? "primary" : "outline"}
                        size="sm"
                        onClick={() => setGraphType("pie")}
                      >
                        파이 그래프
                      </Button>
                    </Box>

                    <Box sx={{ display: "inline-flex", gap: 0.75, ml: "auto" }}>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadChart("png")} disabled={isDownloadingChart}>
                        <FiDownload size={14} style={{ marginRight: 4 }} />
                        PNG
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDownloadChart("jpg")} disabled={isDownloadingChart}>
                        <FiDownload size={14} style={{ marginRight: 4 }} />
                        JPG
                      </Button>
                    </Box>
                  </Box>

                  {selectedDepthGroup && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      선택 계층: {selectedDepthGroup.depth}계층
                    </Typography>
                  )}

                  <Box
                    ref={graphCaptureRef}
                    sx={{
                      width: "100%",
                      height: 300,
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 1,
                      p: 0.75,
                      bgcolor: "background.default",
                    }}
                  >
                    {chartData.length === 0 ? (
                      <Box
                        sx={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Typography variant="body2" color="text.secondary">
                          그래프 데이터가 없습니다.
                        </Typography>
                      </Box>
                    ) : graphType === "bar" ? (
                      <Box
                        sx={{
                          width: barChartWidth,
                          maxWidth: "100%",
                          height: "100%",
                          mx: "auto",
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              dataKey="name"
                              tick={renderWrappedXAxisTick}
                              interval={0}
                              height={xAxisHeight}
                            />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(value: number) => value.toFixed(4)} />
                            <Bar dataKey="weight">
                              {chartData.map((entry, index) => (
                                <Cell key={`${entry.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          width: pieChartWidth,
                          maxWidth: "100%",
                          height: "100%",
                          mx: "auto",
                        }}
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <Pie
                              data={chartData}
                              dataKey="weight"
                              nameKey="name"
                              cx="50%"
                              cy="50%"
                              innerRadius={46}
                              outerRadius={98}
                              paddingAngle={2}
                              labelLine={false}
                              label={({ percent }) => (percent && percent >= 0.05 ? `${(percent * 100).toFixed(1)}%` : "")}
                            >
                              {chartData.map((entry, index) => (
                                <Cell key={`${entry.id}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(value: number) => value.toFixed(4)} />
                            <Legend formatter={(value) => truncateLabel(String(value), 16)} />
                          </PieChart>
                        </ResponsiveContainer>
                      </Box>
                    )}
                  </Box>

                  {hiddenChartNodeCount > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      그래프 가독성을 위해 상위 16개 항목만 표시했습니다. (나머지 {hiddenChartNodeCount}개)
                    </Typography>
                  )}
                </Box>
              )}
            </>
          )}
          {results.missing_nodes.length > 0 && (
            <Typography variant="body2" color="warning.main" sx={{ mt: 1 }}>
              누락 노드: {results.missing_nodes.join(", ")}
            </Typography>
          )}
        </Box>
      )}
    </Card>
  );
};

export default ProjectCard;
