import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "halemale",
  brand: {
    displayName: "할래말래", // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
    primaryColor: "#3182F6", // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
    icon: "", // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
  },
  web: {
    host: "localhost",
    port: 5173,
    commands: {
      dev: "vite --host",
      build: "vite build",
    },
  },
  permissions: [],
  outdir: "dist",
  webViewProps: {
    type: "game", // 게임 내비게이션
  },
});
