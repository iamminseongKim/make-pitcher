# ACE PROJECT

모바일 브라우저 투수 육성 게임. 원안은 [prd.md](./prd.md), 규칙은 [GAME_PLAN.md](./GAME_PLAN.md).

## 실행

```bash
pnpm install
pnpm dev        # http://localhost:5173
pnpm build
pnpm sim        # 투구 전략별 K% / BB% / 피안타율 밸런스 시뮬레이션
pnpm sim:platoon # 구종 × 같은 손/반대 손 헛스윙률 점검
```

## 플레이

1. 이름·키·투구 손·팔 각도·주무기(1~3개)·난이도를 정하고 등판합니다.
2. 상대 팀 9명 타선이 순서대로 들어옵니다. 타자마다 우타/좌타/스위치, 핫존, 약점 구종이 다릅니다.
3. 구종 칩을 고르고 존(안이든 밖이든)을 터치한 뒤, **투구 → 릴리스!** 두 번 탭합니다. 데스크톱은 스페이스바도 됩니다.
4. 3아웃이면 우리 타선 공격이 자동으로 진행되고, 9회가 끝나면 승패가 결정됩니다. 이길수록 상대 리그가 강해집니다.
5. TP로 훈련실에서 구속·제구·무브먼트를 올리고 새 구종을 해금합니다.

## 수싸움 요소

- **유인구**: 타자는 공이 "어디로 올 것처럼 보이는지"로 스윙을 결정합니다. 존 밖으로 빠지는 공도 스트라이크처럼 보이면 헛스윙, 참으면 볼입니다. 2스트라이크 이후 타자는 더 넓게 휘두릅니다.
- **하이 패스트볼**: 포심의 라이징은 타자가 끝까지 믿지 않아 존 위쪽 경계에서 배트가 공 아래로 지나갑니다.
- **피치 터널**: 직전 공과 타자의 판단 시점까지 같은 길로 오다 갈라지면 `TUNNEL` 표시가 뜨고, 타자가 구종을 읽지 못할 확률이 올라갑니다.
- **눈높이**: 높은 직구 다음 낮은 변화구는 인식률이 떨어집니다.
- **플래툰**: 같은 손 타자에겐 바깥으로 도망가는 슬라이더·스위퍼, 반대 손 타자에겐 체인지업·스플리터가 강합니다. 싱커는 같은 손, 커터는 반대 손 타자 몸쪽에서 먹힌 타구를 만듭니다.
- **타이밍**: 타자는 가장 빠른 공에 맞추고 본 공의 구속에 적응합니다. 같은 구종을 연속으로 던지면 타이밍을 잡힙니다.

진행 상황은 `localStorage`(`ace-project-save-v2`)에 저장되며 v1 세이브의 투수 정보는 자동으로 이어집니다.

## Season and pitch systems

Five-game seasons begin in Amateur and progress through KBO Futures, KBO League,
Triple-A, and MLB. At season end, choose promotion or repeat the current tier;
at MLB, repeat starts another MLB season. Rosters are fictional, tier-themed
opponents, not a live roster feed. Difficulty selection is an additional modifier.

The final screen plots every recorded pitch in catcher-view coordinates, with a
nine-cell strike zone, plate, pitch colors, counts, and percentages. Upgrade Pitch
Arsenal opens the existing training shop without dismissing the result. Game rewards
and season records are committed when continuing, avoiding duplicate rewards on reload.

Season ERA uses all runs allowed (the game has no errors/unearned runs), WHIP uses
hits plus walks and excludes HBP, and BAA excludes walks/HBP. Rates use recorded
outs rather than decimal baseball innings. Ties count as games but not wins/losses.
Older saves retain career data; unavailable historical pitch locations are not invented.

Modules: `physics.ts` owns continuous trajectories and tunneling; `game.ts` owns
pitch resolution and game rules; `season.ts` owns tiers and season aggregation;
`render.ts` draws the canvas; `PitchChart.tsx` draws the SVG chart; `audio.ts` owns
sound generation; `App.tsx` coordinates UI. Strike-three slowdown changes visual
time only, preserving the AI's physical flight duration. Reduced-motion preferences
suppress the slowdown and impact camera zoom.

Validation: `pnpm test`, `pnpm build`, and `pnpm sim:platoon`. The regression suite
checks smooth trajectories across all pitches, arm slots, hands and movement levels,
stat accounting, completed-season aggregation, old-save migration, chart coordinates,
and seeded pitch-recognition behavior. The platoon simulation reports distributions
for manual balance review rather than asserting exact random outcomes.
