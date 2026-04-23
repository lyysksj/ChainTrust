import { cn } from "@/lib/utils/cn";

type Props = {
  status: number;
  isClaimed?: boolean;
};

export function StatusChip({ status, isClaimed }: Props) {
  if (isClaimed || status === 2) {
    return <span className={cn("chip chip-claimed")}>Claimed</span>;
  }
  if (status === 1) {
    return <span className={cn("chip chip-verified")}>Platform verified</span>;
  }
  return <span className={cn("chip chip-unverified")}>Unverified</span>;
}
