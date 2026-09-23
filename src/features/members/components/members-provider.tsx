"use client";

import * as React from "react";

import {
  hasMembers,
  ownerLabel,
  ownerOptions,
  type MemberDto,
  type Owner,
  type OwnerOption,
} from "@/features/members/types";

/**
 * The household's people, for every client component that shows an owner.
 *
 * Read once per request by the app layout and handed down here, so a
 * picker, a filter tab or a badge never fetches the list itself. Settings
 * calls `router.refresh()` after an add or a rename, which re-renders the
 * layout and with it this list.
 */
const MembersContext = React.createContext<readonly MemberDto[]>([]);

export function MembersProvider({
  members,
  children,
}: {
  members: MemberDto[];
  children: React.ReactNode;
}) {
  return <MembersContext.Provider value={members}>{children}</MembersContext.Provider>;
}

export function useMembers(): readonly MemberDto[] {
  return React.useContext(MembersContext);
}

export function useOwners(): {
  members: readonly MemberDto[];
  /** Whether there is anyone besides the household to choose between. */
  enabled: boolean;
  options: OwnerOption[];
  label: (owner: Owner) => string;
} {
  const members = useMembers();

  return React.useMemo(
    () => ({
      members,
      enabled: hasMembers(members),
      options: ownerOptions(members),
      label: (owner: Owner) => ownerLabel(owner, members),
    }),
    [members],
  );
}
