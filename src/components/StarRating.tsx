import { Star, StarHalf } from "lucide-react";

export function StarRating({
  value,
  size = 16,
  tamano,
  interactive = false,
  onChange,
}: {
  value: number;
  size?: number;
  tamano?: number;
  interactive?: boolean;
  onChange?: (v: number) => void;
}) {
  const px = tamano ?? size;
  const stars = [];
  for (let i = 1; i <= 5; i++) {
    let icon: React.ReactNode;
    if (value >= i) {
      icon = <Star className="fill-current" style={{ width: px, height: px }} />;
    } else if (value >= i - 0.5) {
      icon = <StarHalf className="fill-current" style={{ width: px, height: px }} />;
    } else {
      icon = <Star className="opacity-30" style={{ width: px, height: px }} />;
    }
    stars.push(
      <button
        key={i}
        type="button"
        disabled={!interactive}
        onClick={() => onChange?.(i)}
        className={
          interactive ? "cursor-pointer transition-transform hover:scale-110" : "cursor-default"
        }
        aria-label={`${i} star${i > 1 ? "s" : ""}`}
      >
        {icon}
      </button>,
    );
  }
  return (
    <span
      className="inline-flex items-center gap-0.5 text-primary"
      role="img"
      aria-label={`${value} of 5 stars`}
    >
      {stars}
    </span>
  );
}
