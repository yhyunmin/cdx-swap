# 미해결 문제

현재 제품 코드 안에서 원인이 확인됐지만 이번 범위에 남겨 둔 미해결 문제는 없다.

환경상 주의할 점은 있다. Linux/WSL 일반 Rust 검사는 GTK 개발 패키지와 `pkg-config`가 없으면 실행 전 단계에서 실패한다. 제품 배포 기준은 Windows이므로 Windows target 검사와 GitHub Windows 빌드를 기준으로 삼는다.