import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const dist = new URL("dist/", root);
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["game/src/main.tsx"],
  outfile: "dist/app.js",
  bundle: true,
  write: false,
  jsx: "automatic",
  minify: true,
  charset: "utf8",
  alias: {
    react: "preact/compat",
    "react-dom/client": "preact/compat/client",
    "react/jsx-runtime": "preact/jsx-runtime",
  },
  define: { "process.env.NODE_ENV": '"production"' },
});

const js = outputFiles.find((file) => file.path.endsWith(".js")).text;
const css = outputFiles.find((file) => file.path.endsWith(".css")).text;
await mkdir(dist, { recursive: true });
await writeFile(new URL("index.html", dist), `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Agro Sim Economy</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>${js.replaceAll("</script", "<\\/script")}</script>
</body>
</html>
`);
