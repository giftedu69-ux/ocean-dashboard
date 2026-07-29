# GitHub Pages + Cloudflare Worker 해양 대시보드

PC에서 서버를 실행하지 않는 배포 구성입니다. GitHub Pages는 화면을 제공하고, Cloudflare Worker가 서비스키를 숨긴 채 수온·염분·해수유동 API를 병렬 호출합니다.

## 1. Cloudflare Worker 설정 (한 번만)

1. Cloudflare 가입 후 **Workers & Pages → Create → Worker**에서 Worker를 만듭니다.
2. `worker/src/index.js` 내용을 붙여 넣고 배포합니다.
3. Worker **Settings → Variables and Secrets → Add**에서 `DATA_GO_KR_SERVICE_KEY`를 **Secret**으로 추가합니다. 공공데이터포털의 *Decoding* 인증키 원문을 넣습니다.
4. 배포된 Worker 주소를 `site/index.html`의 `API_BASE`에 입력합니다.

## 2. GitHub Pages 배포

1. 이 폴더의 내용을 새 GitHub 저장소에 올립니다.
2. GitHub **Settings → Pages → Source**에서 **GitHub Actions**를 선택합니다.
3. `Actions` 탭의 **Deploy GitHub Pages**가 완료되면, 완료 화면의 Pages 주소에서 지도를 엽니다.

## 3. 자동 Worker 배포 (선택)

GitHub 저장소 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`를 추가한 뒤 **Actions → Deploy Cloudflare Worker → Run workflow**로 실행할 수 있습니다. 서비스키 `DATA_GO_KR_SERVICE_KEY`는 GitHub Secret이 아니라 Cloudflare Worker Secret으로 저장하세요.

## API 경로 주의

주신 4개 URL은 서비스 기본 경로입니다. Worker에는 관례상 operation을 붙인 경로를 넣었습니다: `getOpnTgcw15`, `getOpnTgcsy15`, `getOpnContOc15`, `getOpnG2s`. 공공데이터포털 활용신청 상세의 **요청주소**가 다르면 `SERVICES` 값만 실제 요청주소로 교체해야 합니다. 현재 대시보드는 고정 격자코드를 사용하므로 G2s API는 아직 호출하지 않습니다.
