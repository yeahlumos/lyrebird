import flock from "../../flowball/Bird Flock (Test).json";

type Shape = { v: number[][]; i: number[][]; o: number[][]; c: boolean };
type ShapeProperty = { a: number; k: Shape | { t: number; s: Shape[] }[] };
type Group = { it: { ty: string; ks?: ShapeProperty }[] };

function path(shape: Shape) {
  const { v, i, o } = shape;
  let result = `M${v[0].join(" ")}`;
  for (let n = 0; n < v.length; n++) {
    const next = (n + 1) % v.length;
    result += ` C${v[n][0] + o[n][0]} ${v[n][1] + o[n][1]} ${v[next][0] + i[next][0]} ${v[next][1] + i[next][1]} ${v[next].join(" ")}`;
  }
  return result + (shape.c ? " Z" : "");
}

const poses = flock.assets.map((asset) => {
  const shapes = (asset.layers[0].shapes as unknown as Group[]).flatMap((group) =>
    group.it.flatMap((item) => item.ty === "sh" && item.ks ? [item.ks] : []));
  const parts = shapes.map((property) => {
    if (!property.a) return { frames: [property.k as Shape], times: [0] };
    const keys = (property.k as { t: number; s: Shape[] }[]).slice(0, 3);
    const start = keys[0].t;
    const duration = keys[keys.length - 1].t - start;
    return { frames: keys.map((key) => key.s[0]), times: keys.map((key) => (key.t - start) / duration) };
  });
  const points = parts.flatMap((part) => part.frames.flatMap((frame) => frame.v.flatMap((point, n) =>
    [point, [point[0] + frame.i[n][0], point[1] + frame.i[n][1]], [point[0] + frame.o[n][0], point[1] + frame.o[n][1]]])));
  const minX = Math.min(...points.map((point) => point[0])) - 1;
  const minY = Math.min(...points.map((point) => point[1])) - 1;
  const width = Math.max(...points.map((point) => point[0])) - minX + 1;
  const height = Math.max(...points.map((point) => point[1])) - minY + 1;
  return { viewBox: `${minX} ${minY} ${width} ${height}`, parts: parts.map((part) => ({ paths: part.frames.map(path), times: part.times })) };
});

export default function FlockShape({ variant }: { variant: number }) {
  const pose = poses[variant % poses.length];
  return <svg viewBox={pose.viewBox} fill="currentColor" aria-hidden="true" style={variant % poses.length === 2 ? { transform: "rotate(-165.091deg)" } : undefined}>
    {pose.parts.map((part, index) => <path key={index} d={part.paths[0]}>
      {part.paths.length > 1 && <animate attributeName="d" values={part.paths.join(";")} keyTimes={part.times.join(";")} dur="2.4s" repeatCount="indefinite" />}
    </path>)}
  </svg>;
}
