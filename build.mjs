/**
 * Gera o index.html standalone a partir de src/app.html.
 *
 * src/app.html é o arquivo publicado como Artifact no Claude: ele NÃO tem
 * <!doctype>, <html>, <head> nem <body>, porque a plataforma envolve o
 * conteúdo nesse esqueleto na hora de publicar. Este script reproduz o mesmo
 * esqueleto para que o app também funcione aberto direto do disco ou servido
 * pelo GitHub Pages.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = dirname(fileURLToPath(import.meta.url));
const body = readFileSync(join(root, "src", "app.html"), "utf8");

const SKELETON_HEAD = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<meta name="description" content="Controle pessoal de ganhos, despesas, perdas, investimentos e metas.">
<style>
  :root { color-scheme: light; padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
  body { margin: 0; font: 14px system-ui, -apple-system, "Segoe UI", sans-serif; background: #fafaf9; }
  img { max-width: 100%; }
  [hidden] { display: none !important; }
</style>`;

const html = `<!doctype html>
<html lang="pt-BR">
<head>
${SKELETON_HEAD}
</head>
<body>
${body}
</body>
</html>
`;

writeFileSync(join(root, "index.html"), html);
console.log("index.html gerado (" + html.length + " bytes)");
