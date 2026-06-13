# 개발 기준

계정 전환 코드는 성공/실패를 하나의 문자열로만 반환하면 안 된다. Windows auth 전환, Desktop 재시작, SSH 동기화는 각각 구조화된 결과를 반환해야 한다.

프로필 목록과 사용량 행은 각 프로필 home에서 읽어야 한다. UI에서 활성 프로필을 알고 있다는 이유로 모든 행에 Windows 기본 auth 정보를 섞으면 안 된다.

OS 프로세스 실행 코드는 실패 메시지에 어떤 단계가 실패했는지 포함해야 한다. `failed` 하나만 반환하는 오류는 사용자가 직접 복구할 수 없다.

tray 메뉴에 들어가는 상태는 React 쪽 모델에서 만들어 Rust로 전달한다. Rust tray 메뉴가 별도로 프로필을 다시 추론하면 React 패널과 tray 메뉴가 서로 다른 진실을 갖게 된다.

프론트 타입과 Rust serde 구조체는 같은 camelCase 계약을 유지해야 한다. Tauri 명령 응답 필드를 바꾸면 `src/types/domain.ts`, browser preview fallback, 관련 테스트를 같이 바꾼다.

릴리즈 전 최소 검증은 `npm test`, `npm run build`, `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, Windows 대상 Rust 검사 또는 GitHub Windows 빌드다. Linux에서 GTK 계열 시스템 패키지가 없어 `cargo check`가 실행 전 실패하는 것은 제품 코드 통과로 해석하지 않고, Windows 대상 검사로 대체한다.