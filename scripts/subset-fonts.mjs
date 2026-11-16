// 3D 간판용 한글 폰트 서브셋 생성 스크립트
// 사용법: FONT_SRC=<원본 폰트 폴더> npm run fonts
//   원본 폴더에 NotoSansKR.ttf, NotoSerifKR.ttf (Google Fonts, OFL 라이선스 가변 폰트)를 두세요.
// 결과: public/fonts/sans-kr.woff, public/fonts/serif-kr.woff (간판에 쓰인 글자만 포함)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import subsetFont from 'subset-font';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = process.env.FONT_SRC || path.join(root, 'fonts-src');
const texts = JSON.parse(fs.readFileSync(path.join(root, 'src/config/signTexts.json'), 'utf8'));
const basic = ' 0123456789!~-.,';

const jobs = [
  { in: 'NotoSerifKR.ttf', out: 'serif-kr.woff', text: texts.serif.join('') + basic, wght: 800 },
  { in: 'NotoSansKR.ttf', out: 'sans-kr.woff', text: texts.sans.join('') + basic, wght: 800 },
];

fs.mkdirSync(path.join(root, 'public/fonts'), { recursive: true });
for (const job of jobs) {
  const input = fs.readFileSync(path.join(src, job.in));
  const chars = [...new Set([...job.text])].join('');
  const out = await subsetFont(input, chars, {
    targetFormat: 'woff',
    variationAxes: { wght: job.wght },
  });
  fs.writeFileSync(path.join(root, 'public/fonts', job.out), out);
  console.log(`${job.out}: ${chars.length} glyphs, ${(out.length / 1024).toFixed(1)} KB`);
}
