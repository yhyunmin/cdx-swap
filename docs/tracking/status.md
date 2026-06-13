# 현재 상태

완료:

- v0.2.0 기준 기본 Codex/Claude 사용량 조회와 Windows release pipeline이 존재한다.
- Codex 계정 전환은 Windows auth 복사, Desktop 재시작, SSH 동기화를 구조화된 결과로 나눠 표시한다.
- SSH Codex 동기화는 복사, 재시작, hash 검증을 분리하고 실패 이유를 UI와 tray 메뉴 상태에 남긴다.
- tray 메뉴는 전체 프로필의 5H/Week 값을 표시하고 최근 전환 실패 이유를 담을 수 있다.
- tray icon은 window/app icon을 그대로 쓰지 않고 작은 크기용 RGBA 이미지를 사용한다.
- React 패널은 사용량 중심 UI로 바뀌었다. 프로필 카드 목록은 제거됐고, 로그인은 다이얼로그 기반, 전환은 확인 다이얼로그 기반, Run/Logout/Hide/Rename은 icon action 기반이다.
- 디자인 토큰은 4px spacing scale, 24px shell radius, 4px/8px 내부 radius, `#333` 기본 텍스트, `#888` placeholder, `#fff0f3` 활성 행 배경 기준을 따른다.
- Windows installer는 `installer/CdxSwap.Setup` WPF bootstrapper로 변경됐다. Tauri MSI를 embedded payload로 포함하고, silent MSI 실행, 로그 경로, 실패 exit code, 설치 후 Launch 흐름을 제공한다.
- release pipeline은 기본 NSIS setup 대신 custom setup exe, portable zip, update MSI를 생성한다.

검증됨:

- `npm test` 통과.
- `npm run build` 통과.
- Rust 포맷 검사 통과.
- Windows target Rust 검사 통과.
- 브라우저 preview에서 대시보드, 로그인 다이얼로그, rename 다이얼로그, 전환 확인 다이얼로그, hover tooltip, SSH/Claude 설정 화면을 확인했다.
- WPF installer의 Linux 로컬 빌드는 이 환경에 .NET SDK가 없어 실행하지 못했고, Windows GitHub Actions에서 최종 확인해야 한다.

남은 일:

- 실제 Windows tray rendering, Codex Desktop launch, SSH host 동기화는 릴리즈 artifact 또는 Windows 실기에서 최종 확인해야 한다.
- setup exe clean install, offline install, forced failure, scaling 100/125/150 percent 검수는 Windows 실기 또는 VM에서 확인해야 한다.

막힘:

- 없음.
