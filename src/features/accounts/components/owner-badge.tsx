import { Badge } from "@/components/ui/badge";
import { OWNER_LABELS, type Owner } from "@/features/accounts/types";

/**
 * Who an account belongs to.
 *
 * Shared money is the household's default, so it takes the primary accent;
 * the two personal owners are neutral. Deliberately not one colour per
 * person: the design system keeps purple special (§5), and colour-coding
 * people invites reading a household ledger as a scoreboard, which rule 7.7
 * rules out.
 */
function OwnerBadge({ owner }: { owner: Owner }) {
  return (
    <Badge variant={owner === "SHARED" ? "default" : "neutral"}>
      {OWNER_LABELS[owner]}
    </Badge>
  );
}

export { OwnerBadge };
