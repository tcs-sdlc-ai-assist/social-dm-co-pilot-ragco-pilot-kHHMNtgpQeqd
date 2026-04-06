import React from "react";
import type { DMStatus } from "@/lib/constants";
import { STATUS_COLORS } from "@/lib/constants";

export interface StatusTagProps {
  status: DMStatus;
  size?: "sm" | "md";
}

const STATUS_LABELS: Record<DMStatus, string> = {
  new: "New",
  drafted: "Drafted",
  sent: "Sent",
  escalated: "Escalated",
};

export default function StatusTag({ status, size = "md" }: StatusTagProps) {
  const colors = STATUS_COLORS[status];

  const sizeClasses =
    size === "sm"
      ? "px-1.5 py-0.5 text-2xs"
      : "px-2.5 py-1 text-caption";

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${colors.text} ${colors.bg} ${colors.border} ${sizeClasses}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}