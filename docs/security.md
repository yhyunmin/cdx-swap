# 보안 기준

가장 민감한 자산은 Codex `auth.json`과 그 안의 access token, refresh token, account id다. 이 값의 원문은 UI, tray label, toast, 테스트 로그, 설치 로그, 릴리즈 노트에 나오면 안 된다.

프로필 auth 파일은 사용자가 명시적으로 Login한 프로필 home에 저장된다. 계정 전환은 저장된 프로필 auth를 Windows 기본 Codex home으로 복사하지만, 토큰 내용을 파싱해서 로그로 남기거나 사용자에게 보여주지 않는다.

현재 계정 판별은 파일 내용 비교, account id, email 순서로 수행한다. account id가 있으면 email보다 우선한다. email만으로 비교할 때는 같은 email이 여러 프로필에 저장될 수 있다는 한계를 인정하고, 토큰 원문을 표시하는 방식으로 문제를 해결하면 안 된다.

SSH 동기화는 Windows 기본 auth 파일을 원격 `~/.codex/auth.json`으로 복사한다. 복사 후 권한은 `600`이어야 한다. 원격 검증은 파일 hash 또는 계정 identity로 해야 하며, 원격 파일 원문을 stdout으로 회수해서 비교하면 안 된다.

SSH 실패는 성공으로 포장하지 않는다. 연결 실패, 복사 실패, 검증 실패, 원격 런타임 재시작 실패는 서로 다른 상태로 표시한다. 사용자가 재시도할 수는 있지만, 검증 실패 상태에서 "동기화 완료"라고 표시하면 안 된다.

프로필 삭제는 허용된 프로필 root 안에서만 가능하다. modern 프로필은 `%USERPROFILE%\.cdx\profiles\<profile>` 아래, legacy 프로필은 안전한 `.codex<number>` 형식만 삭제 대상이다. 이 조건을 만족하지 않으면 삭제하지 않는다.

