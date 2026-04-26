/**
 * Pure helpers for `MetricCards`: status palettes and dominant-status
 * resolution per card. Kept out of the component so JSX stays declarative
 * (C12).
 */
import type { DataPoint, StatusColor } from "@darkscore/types";

export const STATUS_BORDER: Record<StatusColor, string> = {
  green: "border-[#00dc82]/40",
  red: "border-[#ff4757]/40",
  amber: "border-[#ffc107]/40",
  blue: "border-[#06b6d4]/40",
};

export const STATUS_VALUE: Record<StatusColor, string> = {
  green: "text-[#00dc82]",
  red: "text-[#ff4757]",
  amber: "text-[#ffc107]",
  blue: "text-[#06b6d4]",
};

export function dominantStatus(
  items: ReadonlyArray<DataPoint>,
): StatusColor | null {
  let red = 0;
  let amber = 0;
  let green = 0;
  for (const item of items) {
    if (item.status === "red") red++;
    else if (item.status === "amber") amber++;
    else if (item.status === "green") green++;
  }
  if (red >= Math.max(amber, green) && red > 0) return "red";
  if (amber >= green && amber > 0) return "amber";
  if (green > 0) return "green";
  return null;
}

