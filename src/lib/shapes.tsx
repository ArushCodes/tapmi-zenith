/** Shape language: circles are reserved for classes, every other event kind
 *  gets its own silhouette so a glance is enough to read a dense calendar. */
import type { DeadlineType } from "@/lib/deadlines";

export type MarkerShape =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "star"
  | "bar"
  | "pentagon";

const CLIP: Partial<Record<MarkerShape, string>> = {
  triangle: "polygon(50% 0%, 100% 100%, 0% 100%)",
  diamond: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
  star: "polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)",
  pentagon: "polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)",
};

export function shapeForDeadline(type: DeadlineType): MarkerShape {
  switch (type) {
    case "quiz":
      return "triangle";
    case "assignment":
      return "square";
    case "presentation":
      return "diamond";
    case "midterm":
    case "endterm":
      return "star";
    case "guest_lecture":
      return "pentagon";
    default:
      return "pentagon";
  }
}

export const SHAPE_LABEL: Record<MarkerShape, string> = {
  circle: "Class",
  triangle: "Quiz",
  square: "Assignment",
  diamond: "Presentation",
  star: "Midterm / Endterm",
  pentagon: "Lecture / Other",
  bar: "Holiday",
};

/** Renders a coloured marker. `color` is a CSS colour; `className` may carry a
 *  Tailwind background token instead (leave `color` undefined then). */
export function Marker({
  shape,
  color,
  size = 8,
  className = "",
  title,
  pulse = false,
}: {
  shape: MarkerShape;
  color?: string;
  size?: number;
  className?: string;
  title?: string;
  pulse?: boolean;
}) {
  const style: React.CSSProperties = {
    width: shape === "bar" ? size * 2 : size,
    height: shape === "bar" ? Math.max(3, Math.round(size / 2.5)) : size,
    backgroundColor: color,
    clipPath: CLIP[shape],
    borderRadius:
      shape === "circle" ? "9999px" : shape === "bar" ? "9999px" : shape === "square" ? "2px" : undefined,
  };
  return (
    <span
      title={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 ${pulse ? "pulse-dot" : ""} ${className}`}
      style={style}
    />
  );
}
