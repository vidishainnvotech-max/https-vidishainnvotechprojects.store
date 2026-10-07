import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const cssFile = process.argv[2] || "src/styles/global.css";
const walk = (d) => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? walk(p) : /\.(jsx?|tsx?)$/.test(f) ? [p] : [];
});

const code = walk("src").map((f) => readFileSync(f, "utf8")).join("\n");
const css = readFileSync(cssFile, "utf8");
const classes = [...new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map((m) => m[1]))];
const unused = classes.filter((c) => !code.includes(c));

console.log(`${unused.length} classes in ${cssFile} not found in any JS/JSX:\n`);
console.log(unused.sort().join("\n"));
