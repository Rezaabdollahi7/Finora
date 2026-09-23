"use client";

import { Badge } from "@/components/ui/badge";
import { useOwners } from "@/features/members/components/members-provider";
import { SHARED_OWNER, type Owner } from "@/features/members/types";

/**
 * Who a record belongs to.
 *
 * Shared money is the household's default, so it takes the primary accent;
 * the people are neutral. Deliberately not one colour per person: the
 * design system keeps purple special (§5), and colour-coding people invites
 * reading a household ledger as a scoreboard, which rule 7.7 rules out.
 *
 * In a household with no members every record is shared, and a "مشترک"
 * badge on every card says nothing, so cards drop it. A detail page, which
 * lists the owner as a fact, passes `always`.
 */
function OwnerBadge({ owner, always = false }: { owner: Owner; always?: boolean }) {
  const owners = useOwners();

  if (!owners.enabled && !always) return null;

  return (
    <Badge variant={owner === SHARED_OWNER ? "default" : "neutral"}>
      {owners.label(owner)}
    </Badge>
  );
}

export { OwnerBadge };
