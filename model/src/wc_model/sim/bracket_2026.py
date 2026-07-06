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

# Official knockout schedule: match_no -> (date, city, country). Used only as
# metadata for synthesized fixture rows whose pairing is known before the
# dataset lists the fixture — a real CSV row always takes precedence. R32/R16
# entries verified against dataset rows 2026-07-06; QF 98/100, SFs, third place
# and the final are from the official FIFA schedule fixed at the draw.
KO_SCHEDULE: Dict[int, Tuple[str, str, str]] = {
    73: ("2026-06-28", "Inglewood", "United States"),
    74: ("2026-06-29", "Foxborough", "United States"),
    75: ("2026-06-29", "Guadalupe", "Mexico"),
    76: ("2026-06-29", "Houston", "United States"),
    77: ("2026-06-30", "East Rutherford", "United States"),
    78: ("2026-06-30", "Arlington", "United States"),
    79: ("2026-06-30", "Mexico City", "Mexico"),
    80: ("2026-07-01", "Atlanta", "United States"),
    81: ("2026-07-01", "Santa Clara", "United States"),
    82: ("2026-07-01", "Seattle", "United States"),
    83: ("2026-07-02", "Toronto", "Canada"),
    84: ("2026-07-02", "Inglewood", "United States"),
    85: ("2026-07-02", "Vancouver", "Canada"),
    86: ("2026-07-03", "Miami Gardens", "United States"),
    87: ("2026-07-03", "Kansas City", "United States"),
    88: ("2026-07-03", "Arlington", "United States"),
    89: ("2026-07-04", "Philadelphia", "United States"),
    90: ("2026-07-04", "Houston", "United States"),
    91: ("2026-07-05", "East Rutherford", "United States"),
    92: ("2026-07-05", "Mexico City", "Mexico"),
    93: ("2026-07-06", "Dallas", "United States"),
    94: ("2026-07-06", "Seattle", "United States"),
    95: ("2026-07-06", "Atlanta", "United States"),
    96: ("2026-07-06", "Vancouver", "Canada"),
    97: ("2026-07-09", "Foxborough", "United States"),
    98: ("2026-07-10", "Inglewood", "United States"),
    99: ("2026-07-11", "Miami Gardens", "United States"),
    100: ("2026-07-11", "Kansas City", "United States"),
    101: ("2026-07-14", "Arlington", "United States"),
    102: ("2026-07-15", "Atlanta", "United States"),
    103: ("2026-07-18", "Miami Gardens", "United States"),
    104: ("2026-07-19", "East Rutherford", "United States"),
}

# Round each knockout match belongs to (for tallying advancement odds).
ROUND_OF = (
    {m: "R32" for m, _, _ in R32}
    | {m: "R16" for m in R16}
    | {m: "QF" for m in QF}
    | {m: "SF" for m in SF}
    | {FINAL: "Final", THIRD_PLACE: "ThirdPlace"}
)


def assign_thirds(qualified_groups: List[str],
                  slots: Optional[List[int]] = None) -> Optional[Dict[int, str]]:
    """Match the best third-placed groups to the third-place slots.

    Returns {match_no: group_letter} or None if no valid assignment exists.
    Solved as a small bipartite perfect matching over THIRD_ELIGIBILITY.
    `slots` restricts the matching to a subset (used when live results have
    already pinned some slots' occupants).
    """
    slots = list(THIRD_ELIGIBILITY.keys()) if slots is None else list(slots)
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
