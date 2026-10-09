/* In-frame FX overlays for protester animations (M4b) — drawn after the ink outline.
 * Muzzle flashes, camera flash pops, molotov flame, vape clouds, fuse sparks, bazooka
 * backblast. Keys: FX_KEYS. Big explosions / blood / KO stars are M5's job. Do not reformat. */

export const FX_KEYS: Readonly<Record<string, string>> = {
  w: 'white',
  f: 'ochre4',
  F: 'ochre3',
  o: 'ochre2',
  x: 'rust3',
  r: 'rust2',
  g: 'gray6',
  G: 'gray7',
  s: 'stone5',
  k: 'gray4',
  l: 'gray5',
};

export const FX_BOOK = `
== fx.muzzle 0,1
.fF..
wffFx
.fF..

== fx.muzzlebig 0,2
..f....
.fwfF..
fwwwfFx
.fwfF..
..f....

== fx.flash 2,2
..w..
.www.
wwwww
.www.
..w..

== fx.flashbig 4,4
....w....
.w..w..w.
..wwfww..
..wfwfw..
wwwwfwwww
..wfwfw..
..wwfww..
.w..w..w.
....w....

== fx.flame 1,3
.f.
fFf
.F.
.x.

== fx.flame2 1,3
f..
.Ff
fF.
.x.

== fx.vape1 0,2
.G.
GsG

== fx.vape2 0,4
..G.
.GsG
.Gs.
..G.

== fx.vape3 0,5
.GG..
GsGG.
.GsG.
..G..
.....

== fx.spark 1,1
f.F
.w.
F.f

== fx.spark2 1,1
.F.
FwF
.F.

== fx.backblast 6,2
..g.....
gGGsfo..
GsswfFxx
gGGsfo..
..g.....

== fx.smoke 5,3
..gg..
.gGGg.
gGsGGg
.gGGl.
..ll..

== fx.dust 4,0
k......k
.l....l.

== fx.sweat 0,0
s.
.s
`;
