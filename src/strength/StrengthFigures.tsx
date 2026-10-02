import { type StrengthCounts, sumOf } from "./strength";

/** Die Stärke F/UF/E/G in der Ansicht: G unterstrichen statt „//" davor. */
export function StrengthFigures({ counts }: { counts: StrengthCounts }) {
  return (
    <>
      {`${counts.leaders}/${counts.subLeaders}/${counts.crew}/`}
      <u>{sumOf(counts)}</u>
    </>
  );
}
