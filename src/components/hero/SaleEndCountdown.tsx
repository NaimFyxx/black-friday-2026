import { useEffect, useState } from "react";

import { formatCountdown } from "@/lib/teaser";

/** During the sale, under "Up to X% off": "Ends at midnight 13h 59m 59s". */
export function SaleEndCountdown({
  end,
  label,
  onDone,
}: {
  end: string;
  label: string;
  onDone: () => void;
}) {
  const target = new Date(end).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = now === null ? null : target - now;
  useEffect(() => {
    if (left !== null && left <= 0) onDone();
  }, [left !== null && left <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <p className="ff-subline text-base text-ff-black md:text-lg" aria-live="off">
      {label}{" "}
      {left === null ? (
        <span className="ff-num invisible text-ff-red" aria-hidden>
          00h 00m 00s
        </span>
      ) : (
        <span className="ff-num text-ff-red">{formatCountdown(left)}</span>
      )}
    </p>
  );
}
