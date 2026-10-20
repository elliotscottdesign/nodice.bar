// No Dice pool tournament HOUSE RULES.
//
// Single source of truth for the public /pool "Rules" tab. Mirrored
// from the team hub (team.nodice.bar → src/tournament/houseRules.js),
// itself taken from the founder's PLONK-HOUSE-RULES-TOURNAMENT-V2 PDF
// (8 Oct 2026) with three founder amendments baked in: doubles are
// SCOTCH DOUBLES; the golden break is NOT a win (8-ball respots and the
// turn passes); shown on every team page.
//
// If the team hub rules change, update this copy to match — the two
// live in separate repos so there's no shared import.

export type HouseRule = { t: string; body: string };

export const POOL_HOUSE_RULES: HouseRule[] = [
  {
    t: "The Object of the Game",
    body: "Eight Ball is played with a cue ball and fifteen object balls, numbered 1 through 15. One player must pocket the group numbered 1–7 (solid colours), the other the 9–15 group (stripes). THE PLAYER WHO POCKETS THEIR GROUP FIRST AND THEN LEGALLY POCKETS THE 8-BALL WINS THE GAME.",
  },
  {
    t: "Doubles — Scotch Doubles",
    body: "All doubles games are played SCOTCH DOUBLES: the two teammates alternate shots, one shot each, for as long as the team’s visit lasts. If your partner pots a ball, the visit continues — but it’s YOUR cue next, not theirs. No conferring over the shot in progress beyond normal table-talk; play your own shot. The alternating order within a team stays fixed for the whole game.",
  },
  {
    t: "Racking the Balls",
    body: "The balls are racked in a triangle at the foot of the table: the 8-ball in the centre of the triangle, the first ball of the rack on the foot spot, a stripe in one corner of the rack and a solid in the other corner.",
  },
  {
    t: "Alternating Break",
    body: "Winner of the coin toss has the option to break. During individual competition, players alternate the break on each subsequent game.",
  },
  {
    t: "Jump & Massé Shots",
    body: "No jump or massé shots are allowed — attempting one is a foul.",
  },
  {
    t: "Legal Break",
    body: "With the cue ball behind the headstring, the breaker must either pocket a ball or drive at least four numbered balls to a rail. Failing that is a foul: the incoming player may accept the table as it lies and shoot, or have the balls re-racked and choose to break themselves or send the offender back to re-break.",
  },
  {
    t: "Foul on a Legal Break",
    body: "If a player fouls on an otherwise legal break, all pocketed balls stay down (exception: the 8-ball — see the golden break rule), it is a foul, and the table is open. The incoming player has cue ball in hand behind the headstring, and may not shoot an object ball behind the headstring unless the cue ball first crosses the headstring and comes back.",
  },
  {
    t: "The Golden Break — NOT a win",
    body: "Potting the 8-ball on the break does NOT win the game here. The 8-ball is respotted, every other pocketed ball stays down — and the breaker’s turn ENDS there: no second shot. The incoming player takes over with the table as it lies (table still open). If the breaker also fouled, the incoming player instead takes cue ball in hand behind the headstring.",
  },
  {
    t: "Balls Jumped Off on the Break",
    body: "Jumping an object ball off the table on the break is a foul. The incoming player may accept the table as it lies, or take cue ball in hand behind the headstring.",
  },
  {
    t: "Open Table & Choice of Group",
    body: "The table is ALWAYS open immediately after the break — the break never decides groups, even if balls drop from one or both groups. While open, you may hit a solid first to make a stripe or vice versa; your group is fixed only when you legally pocket an object ball after the break. On an open table the 8-ball may never be struck first — doing so loses the turn, pocketed balls stay down, and the table remains open for the incoming player.",
  },
  {
    t: "Legal Shot",
    body: "On every shot after the break (table not open), you must hit one of YOUR group first, and then either pocket a numbered ball or send the cue ball or any numbered ball to a rail. Banking the cue ball off a rail first is fine — the after-contact requirement still applies. Anything less is a foul.",
  },
  {
    t: "Safety Shot",
    body: 'You may pocket an obvious object ball and give up your turn by declaring "safety" BEFORE the shot. Forget to declare it and pot one of your balls, and you must shoot again. Balls pocketed on a safety stay down.',
  },
  {
    t: "Scoring a Visit",
    body: "You keep shooting for as long as you legally pocket balls of your group. Clear your group, then pocket the 8-ball to win.",
  },
  {
    t: "Foul Penalty — Ball in Hand",
    body: 'After a foul, the opposing player gets cue ball IN HAND — placed anywhere on the table. That first shot is a "free table": any ball may be struck, and no foul is given for potting the opponent’s ball on it.',
  },
  {
    t: "Combination Shots",
    body: "Combinations are allowed, but the 8-ball may never be the FIRST ball in the combination — except when the table is open.",
  },
  {
    t: "Illegally Pocketed Balls",
    body: "A ball is illegally pocketed when the shot fouled, or a safety was declared. Illegally pocketed balls stay down. NOTE: you do NOT call pockets on your own group here — any legal pot counts, in any pocket. The only ball you must call is the BLACK.",
  },
  {
    t: "Balls Jumped Off the Table",
    body: "Jumping any object ball off the table is a foul and loss of turn — unless it’s the 8-ball, which is loss of GAME. Jumped balls are respotted in numerical order.",
  },
  {
    t: "Calling Your Shots — the black only",
    body: "Pots on your own group do NOT need calling: hit your group first, pot anything of yours in any pocket, and it counts. The ONE shot you must call is the BLACK — name the pocket out loud to your opponent before you play it, and it must go in that pocket. Call it wrong and it is loss of game.",
  },
  {
    t: "Playing the 8-Ball",
    body: "When shooting the 8-ball, a foul is NOT loss of game provided the 8-ball itself is neither pocketed nor jumped off — the incoming player just takes ball in hand. A combination can never legally pocket the 8-ball.",
  },
  {
    t: "Loss of Game",
    body: "You LOSE the game if you: (a) foul while pocketing the 8-ball; (b) pocket the 8-ball on the same stroke as the last of your group; (c) jump the 8-ball off the table at any time; (d) pocket the 8-ball in a pocket other than the one you CALLED; or (e) pocket the 8-ball when it isn’t your legal object ball. (The golden break is the exception — see above: respot, no win, turn over.) All infractions must be called before the next shot is taken, or no infraction occurred.",
  },
];
