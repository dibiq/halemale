import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "skewer-master",
  brand: {
    displayName: "전설의 꼬치왕", // 화면에 노출될 앱의 한글 이름으로 바꿔주세요.
    primaryColor: "#3182F6", // 화면에 노출될 앱의 기본 색상으로 바꿔주세요.
    icon: "https://cushi-assets.onrender.com/images/icon.png", // 화면에 노출될 앱의 아이콘 이미지 주소로 바꿔주세요.
  },
  web: {
    //host: "192.168.10.113",
    host: "0.0.0.0",
    port: 5173,
    commands: {
      //dev: "node index.js --host",
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
