"""Official 2026 FIFA World Cup structure: groups, knockout bracket, third-place rule.

Verified against Wikipedia "2026 FIFA World Cup draw" and "...knockout stage".
Hosts: Mexico = A1, Canada = B1, United States = D1.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Tuple

# Official December 2025 draw (position 1..4 within each group).
GROUPS: Dict[str, List[str]] = {
    "A": ["Mexico", "South Africa", "South Korea", "Czech Republic"],
    "B": ["Canada", "Bosnia and Herzegovina", "Qatar", "Switzerland"],
    "C": ["Brazil", "Morocco", "Haiti", "Scotland"],
    "D": ["United States", "Paraguay", "Australia", "Turkey"],
    "E": ["Germany", "Curaçao", "Ivory Coast", "Ecuador"],
    "F": ["Netherlands", "Japan", "Sweden", "Tunisia"],
    "G": ["Belgium", "Egypt", "Iran", "New Zealand"],
    "H": ["Spain", "Cape Verde", "Saudi Arabia", "Uruguay"],
    "I": ["France", "Senegal", "Iraq", "Norway"],
    "J": ["Argentina", "Algeria", "Austria", "Jordan"],
    "K": ["Portugal", "DR Congo", "Uzbekistan", "Colombia"],
    "L": ["England", "Croatia", "Ghana", "Panama"],
}

HOSTS = {"Mexico": "Mexico", "Canada": "Canada", "United States": "United States"}

# Round of 32: (match_no, slot_a, slot_b). "1A"=winner A, "2B"=runner-up B,
# "T74"=the best-third assigned to match 74's third-place slot.
R32: List[Tuple[int, str, str]] = [
    (73, "2A", "2B"), (74, "1E", "T74"), (75, "1F", "2C"), (76, "1C", "2F"),
    (77, "1I", "T77"), (78, "2E", "2I"), (79, "1A", "T79"), (80, "1L", "T80"),
    (81, "1D", "T81"), (82, "1G", "T82"), (83, "2K", "2L"), (84, "1H", "2J"),
    (85, "1B", "T85"), (86, "1J", "2H"), (87, "1K", "T87"), (88, "2D", "2G"),
]

# Which group letters' third-placed team may fill each third-place slot.
THIRD_ELIGIBILITY: Dict[int, str] = {
    74: "ABCDF", 77: "CDFGH", 79: "CEFHI", 80: "EHIJK",
    81: "BEFIJ", 82: "AEHIJ", 85: "EFGIJ", 87: "DEIJL",
}

# Knockout tree: match_no -> (feeder_match_a, feeder_match_b) winners meet.
R16 = {89: (74, 77), 90: (73, 75), 91: (76, 78), 92: (79, 80),
       93: (83, 84), 94: (81, 82), 95: (88, 86), 96: (85, 87)}
QF = {97: (89, 90), 98: (93, 94), 99: (91, 92), 100: (95, 96)}
SF = {101: (97, 98), 102: (99, 100)}
FINAL = 104          # winners of 101, 102
THIRD_PLACE = 103    # losers of 101, 102

# Round each knockout match belongs to (for tallying advancement odds).
ROUND_OF = (
    {m: "R32" for m, _, _ in R32}
    | {m: "R16" for m in R16}
    | {m: "QF" for m in QF}
    | {m: "SF" for m in SF}
    | {FINAL: "Final", THIRD_PLACE: "ThirdPlace"}
)


def assign_thirds(qualified_groups: List[str]) -> Optional[Dict[int, str]]:
    """Match the 8 best third-placed groups to the 8 third-place slots.

    Returns {match_no: group_letter} or None if no valid assignment exists.
    Solved as a small bipartite perfect matching over THIRD_ELIGIBILITY.
    """
    slots = list(THIRD_ELIGIBILITY.keys())
    groups = list(qualified_groups)
    assignment: Dict[int, str] = {}
    used = set()

    def backtrack(i: int) -> bool:
        if i == len(slots):
            return True
        slot = slots[i]
        for g in groups:
            if g not in used and g in THIRD_ELIGIBILITY[slot]:
                used.add(g)
                assignment[slot] = g
                if backtrack(i + 1):
                    return True
                used.discard(g)
                del assignment[slot]
        return False

    # Order slots by fewest eligible qualified groups first (faster, more robust).
    slots.sort(key=lambda s: sum(1 for g in groups if g in THIRD_ELIGIBILITY[s]))
    return assignment if backtrack(0) else None
