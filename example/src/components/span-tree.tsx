import { CompleteTrace } from "convex-tracer";
import { SpanCard } from "./span-card";

interface SpanTreeProps {
  span: CompleteTrace["spans"][number];
  depth: number;
  onSpanClick: (spanId: CompleteTrace["spans"][number]) => void;
  isLast?: boolean;
}

export function SpanTree({
  span,
  depth,
  onSpanClick,
  isLast = true,
}: SpanTreeProps) {
  return (
    <div className="relative">
      {/* Vertical and horizontal connecting lines */}
      {depth > 0 && (
        <>
          {/* Horizontal line to the span */}
          <div
            className="absolute top-4 border-t-2 border-gray-300"
            style={{
              left: `${(depth - 1) * 24 + 12}px`,
              width: "12px",
            }}
          />
          {/* Vertical line from parent */}
          <div
            className="absolute -top-2 bottom-0 border-l-2 border-gray-300"
            style={{
              left: `${(depth - 1) * 24 + 12}px`,
              height: isLast ? "24px" : undefined,
            }}
          />
        </>
      )}

      <div style={{ marginLeft: `${depth * 24}px` }}>
        <SpanCard span={span} onClick={() => onSpanClick(span)} />
      </div>

      {span.children && span.children.length > 0 && (
        <div className="space-y-2 mt-2 relative">
          {/* Vertical line for children */}
          {depth >= 0 && (
            <div
              className="absolute -top-2 h-6 border-l-2 border-gray-300"
              style={{
                left: `${depth * 24 + 12}px`,
              }}
            />
          )}
          {span.children.map((child: any, index: number) => (
            <SpanTree
              key={child._id}
              span={child}
              depth={depth + 1}
              onSpanClick={onSpanClick}
              isLast={index === (span.children?.length ?? 1) - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
