# React 패널 기준

`src/`는 사용자가 보는 tray 패널, 설정 화면, usage 표시, toast/notice 상태를 맡는다. 파일시스템 auth 복사나 프로세스 종료 같은 OS 작업을 직접 구현하지 않는다.

프론트의 핵심 진실은 백엔드 명령 응답이다. `activeProfileId`는 사용자가 선택한 프로필 상태일 뿐이며, 현재 Windows 계정이 실제로 그 프로필과 맞는지는 `get_current_account_status`와 `switch_profile.windows` 결과로 확인한다.

`useAppController`는 Tauri 명령 호출과 화면 상태를 연결하는 소유자다. 개별 컴포넌트가 직접 native API를 호출하면 tray 메뉴 상태, 패널 notice, toast가 어긋난다.

계정 전환 UI는 세 결과를 분리해서 표시해야 한다. Windows 전환 실패는 오류이고, Desktop 재시작 실패와 SSH 동기화 실패는 전환 후 경고다. 경고를 `error` 하나에 합쳐 현재 계정 전환까지 실패한 것처럼 보이면 안 된다.

tray 메뉴 상태는 `trayMenuState`에서 만든다. 새 필드를 추가하면 Rust `TrayMenuState`, TypeScript type, browser preview fallback, 관련 테스트를 같이 바꾼다.

테스트는 적어도 버튼 wiring, tray action, 모델 변환을 확인해야 한다. UI 문구가 바뀔 때는 접근성 label이 유지되는지 같이 확인한다.

