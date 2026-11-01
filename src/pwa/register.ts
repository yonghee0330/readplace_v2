// 서비스워커 등록. 개발 모드에서는 등록하지 않는다(빌드 결과물에서만).
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    // 문서 기준 상대 경로라 GitHub Pages 하위 경로에서도 sw.js와 범위가 맞는다
    navigator.serviceWorker
      .register('./sw.js', { scope: './' })
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        // 첫 방문에는 서비스워커가 붙기 전에 받은 파일(글꼴 등)이 캐시되지 않으므로 목록을 넘겨 담게 한다
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin));
        reg.active?.postMessage({ type: 'cache', urls });
      })
      .catch(() => {
        /* 등록 실패(사생활 보호 모드 등)는 조용히 넘어간다 */
      });
  });
}
