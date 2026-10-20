// デモ版（読者に触ってもらう用）を dist/ に組み立てるスクリプト
// photoframe.html 本体はそのまま使い、
//   - Googleログイン用のスクリプト読み込みを外す
//   - 本体スクリプトの直後に demo/demo.js（見本の写真で動かす上書き）を読み込ませる
// だけの変更をした index.html を作る。家族で使っている photoframe.html 自体は変更しない。
// 実行: node scripts/build-demo.mjs
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

function replaceOnce(html, from, to) {
  if (html.split(from).length !== 2) throw new Error(`photoframe.html に「${from}」がちょうど1か所見つかりません`);
  return html.replace(from, to);
}

let html = readFileSync(join(root, 'photoframe.html'), 'utf8');
html = replaceOnce(html, '<script src="https://accounts.google.com/gsi/client" async defer></script>\n', '');
html = replaceOnce(html, '<title>PhotoFrame</title>', '<title>PhotoFrame デモ</title>');
html = replaceOnce(html, '</body>', '<script src="demo.js"></script>\n</body>');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), html);
cpSync(join(root, 'demo', 'demo.js'), join(dist, 'demo.js'));
cpSync(join(root, 'demo', 'photos'), join(dist, 'photos'), { recursive: true });
console.log('dist/ にデモ版を書き出しました');
