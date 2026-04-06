"use client";

import React from "react";

export interface ConfidenceMeterProps {
  confidence: number;
  showLabel?: boolean;
}

function getConfidenceLevel(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.8) {
    return "high";
  }
  if (confidence >= 0.6) {
    return "medium";
  }
  return "low";
}

function getBarColorClass(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "bg-confidence-high";
    case "medium":
      return "bg-confidence-medium";
    case "low":
      return "bg-confidence-low";
  }
}

function getTextColorClass(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "text-confidence-high";
    case "medium":
      return "text-confidence-medium";
    case "low":
      return "text-confidence-low";
  }
}

function getBgColorClass(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "bg-confidence-high-bg";
    case "medium":
      return "bg-confidence-medium-bg";
    case "low":
      return "bg-confidence-low-bg";
  }
}

function getBorderColorClass(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "border-confidence-high-border";
    case "medium":
      return "border-confidence-medium-border";
    case "low":
      return "border-confidence-low-border";
  }
}

function getLabelText(level: "high" | "medium" | "low"): string {
  switch (level) {
    case "high":
      return "High Confidence";
    case "medium":
      return "Medium Confidence";
    case "low":
      return "Low Confidence";
  }
}

function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className="w-4 h-4 flex-shrink-0"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function ConfidenceMeter({
  confidence,
  showLabel = true,
}: ConfidenceMeterProps) {
  const clampedConfidence = Math.max(0, Math.min(1, confidence));
  const percentage = Math.round(clampedConfidence * 100);
  const level = getConfidenceLevel(clampedConfidence);

  const barColor = getBarColorClass(level);
  const textColor = getTextColorClass(level);
  const bgColor = getBgColorClass(level);
  const borderColor = getBorderColorClass(level);
  const label = getLabelText(level);
  const isLow = level === "low";

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isLow && (
            <span className={textColor}>
              <WarningIcon />
            </span>
          )}
          {showLabel && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-2xs font-medium ${textColor} ${bgColor} ${borderColor}`}
            >
              {label}
            </span>
          )}
        </div>
        <span className={`text-body-sm font-semibold ${textColor}`}>
          {percentage}%
        </span>
      </div>
      <div
        className="w-full h-2 rounded-full bg-gray-100 overflow-hidden"
        role="progressbar"
        aria-valuenow={percentage}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Confidence: ${percentage}%`}
      >
        <div
          className={`h-full rounded-full transition-all duration-350 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {isLow && (
        <p className={`text-2xs ${textColor} flex items-center gap-1`}>
          Low confidence — thorough human review recommended
        </p>
      )}
    </div>
  );
}