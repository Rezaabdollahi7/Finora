/**
 * The people in the household (see the `Member` model in schema.prisma).
 *
 * Finora starts with nobody. Every record has an owner, which is either
 * {@link SHARED_OWNER} — the household's own money — or the id of a member
 * the household added itself. A household of one never adds anyone and
 * never sees an owner picker at all.
 */

/** The owner of everything that belongs to the household as a whole. */
export const SHARED_OWNER = "SHARED";

export const SHARED_LABEL = "مشترک";

/** `"SHARED"` or a member id. */
export type Owner = string;

export type MemberDto = {
  id: string;
  name: string;
  createdAt: string;
};

export type OwnerOption = { value: Owner; label: string };

/** Shared first, then the people in the order they were added. */
export function ownerOptions(members: readonly MemberDto[]): OwnerOption[] {
  return [
    { value: SHARED_OWNER, label: SHARED_LABEL },
    ...members.map((member) => ({ value: member.id, label: member.name })),
  ];
}

/**
 * The name to show for an owner.
 *
 * An id that matches nobody should not happen — a member who still owns
 * records cannot be deleted — but a stale client list can lag a rename or
 * an add, and a blank label is worse than a neutral one.
 */
export function ownerLabel(owner: Owner, members: readonly MemberDto[]): string {
  if (owner === SHARED_OWNER) return SHARED_LABEL;
  return members.find((member) => member.id === owner)?.name ?? "عضو خانوار";
}

/** Owner pickers and filters only make sense once there is someone to pick. */
export function hasMembers(members: readonly MemberDto[]): boolean {
  return members.length > 0;
}
