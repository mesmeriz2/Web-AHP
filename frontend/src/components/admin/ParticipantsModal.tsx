import React, { useState, useCallback } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import { FiCheck, FiClock } from "react-icons/fi";
import Badge from "../common/Badge";

interface ParticipantDetail {
  participant_code: string;
  has_participated: boolean;
  completed_nodes: string[];
  total_nodes: number;
  completion_rate: number;
}

interface ParticipantsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName: string;
  participants: ParticipantDetail[];
}

const COPY_TOAST_MESSAGE = "클립보드에 복사되었습니다";

const ParticipantsModal: React.FC<ParticipantsModalProps> = ({
  isOpen,
  onClose,
  projectName,
  participants,
}) => {
  const [toastOpen, setToastOpen] = useState(false);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToastOpen(true);
    } catch {
      setToastOpen(false);
    }
  }, []);

  const getParticipantStatus = (participant: ParticipantDetail): "미참여" | "설문중" | "완료" => {
    if (!participant.has_participated) {
      return "미참여";
    }
    if (participant.completion_rate >= 1.0) {
      return "완료";
    }
    return "설문중";
  };

  const statusCounts = {
    미참여: participants.filter((p) => getParticipantStatus(p) === "미참여").length,
    설문중: participants.filter((p) => getParticipantStatus(p) === "설문중").length,
    완료: participants.filter((p) => getParticipantStatus(p) === "완료").length,
  };

  return (
    <Dialog open={isOpen} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Typography variant="h6" component="span">
          참여 현황 – {projectName}
        </Typography>
        <IconButton aria-label="닫기" onClick={onClose} size="small" />
      </DialogTitle>
      <DialogContent dividers>
        {participants.length === 0 ? (
          <Typography color="text.disabled" align="center" sx={{ py: 4 }}>
            참여자가 없습니다.
          </Typography>
        ) : (
          <Box sx={{ "& > * + *": { mt: 2 } }}>
            <Paper
              variant="outlined"
              sx={{
                p: 1.5,
                borderRadius: 2,
                bgcolor: "action.hover",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "wrap" }}>
                <Typography variant="body2" color="text.secondary">
                  참여 현황 요약:
                </Typography>
                <Typography variant="body2">
                  전체 {participants.length}명 |
                  <Box component="span" sx={{ color: "error.main", ml: 0.5 }}>
                    미참여 {statusCounts.미참여}명
                  </Box>
                  |
                  <Box component="span" sx={{ color: "warning.main", ml: 0.5 }}>
                    설문중 {statusCounts.설문중}명
                  </Box>
                  |
                  <Box component="span" sx={{ color: "success.main", ml: 0.5 }}>
                    완료 {statusCounts.완료}명
                  </Box>
                </Typography>
              </Box>
            </Paper>

            <List
              dense
              sx={{
                maxHeight: 400,
                overflow: "auto",
                "& > *": { borderBottom: 1, borderColor: "divider" },
              }}
            >
              {participants.map((participant) => {
                const status = getParticipantStatus(participant);
                const statusVariant =
                  status === "완료" ? "success" : status === "설문중" ? "warning" : "error";

                return (
                  <ListItem
                    key={participant.participant_code}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 1,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        component="button"
                        type="button"
                        onClick={() => copyToClipboard(participant.participant_code)}
                        sx={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 0.5,
                          border: "none",
                          background: "none",
                          padding: 0,
                          cursor: "pointer",
                          "&:hover": { opacity: 0.85 },
                        }}
                        title="클립보드에 복사"
                      >
                        <Typography
                          variant="caption"
                          component="span"
                          color="text.secondary"
                          sx={{ mr: 0.5 }}
                        >
                          참석자 ID:
                        </Typography>
                        <Typography
                          variant="body2"
                          component="span"
                          sx={{
                            fontFamily: "monospace",
                            fontWeight: 500,
                            fontSize: "0.875rem",
                            bgcolor: "action.hover",
                            px: 1,
                            py: 0.5,
                            borderRadius: 1,
                          }}
                        >
                          {participant.participant_code}
                        </Typography>
                      </Box>
                      <Badge variant={statusVariant}>
                        {status === "완료" && <FiCheck size={12} style={{ marginRight: 4 }} />}
                        {status === "설문중" && <FiClock size={12} style={{ marginRight: 4 }} />}
                        {status}
                      </Badge>
                    </Box>
                    {participant.has_participated && (
                      <Typography variant="body2" color="text.disabled">
                        {Math.min(
                          new Set(participant.completed_nodes).size,
                          participant.total_nodes
                        )} / {participant.total_nodes} 항목 완료
                      </Typography>
                    )}
                  </ListItem>
                );
              })}
            </List>
          </Box>
        )}
      </DialogContent>
      <Snackbar
        open={toastOpen}
        autoHideDuration={2500}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert onClose={() => setToastOpen(false)} severity="success" variant="filled">
          {COPY_TOAST_MESSAGE}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default ParticipantsModal;
