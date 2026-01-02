/**
 * Enoki OAuth 診斷工具
 * 
 * 這個工具會檢查 Enoki 設定並提供診斷資訊
 */

export function diagnoseEnokiSetup() {
    console.log('=== Enoki OAuth 診斷 ===\n');

    // 1. 檢查環境變數
    console.log('1️⃣ 環境變數檢查:');
    const apiKey = import.meta.env.VITE_ENOKI_PUBLIC_KEY;
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

    console.log('  VITE_ENOKI_PUBLIC_KEY:', apiKey ? '✅ 已設定' : '❌ 未設定');
    console.log('  VITE_GOOGLE_CLIENT_ID:', googleClientId ? '✅ 已設定' : '❌ 未設定');

    if (googleClientId) {
        console.log('  Client ID:', googleClientId);
    }

    // 2. 檢查當前 URL
    console.log('\n2️⃣ 當前頁面資訊:');
    console.log('  URL:', window.location.href);
    console.log('  Origin:', window.location.origin);
    console.log('  Pathname:', window.location.pathname);
    console.log('  Hash:', window.location.hash || '(無)');

    // 3. 檢查 window.opener
    console.log('\n3️⃣ Popup 狀態:');
    console.log('  是否為 popup:', !!window.opener);
    if (window.opener) {
        try {
            console.log('  父視窗是否關閉:', window.opener.closed);
        } catch (e) {
            console.log('  無法檢查父視窗狀態 (COOP 限制):', e);
        }
    }

    // 4. 建議的 redirect URIs
    console.log('\n4️⃣ 建議在 Google Cloud Console 設定的 Redirect URIs:');
    const baseUrl = window.location.origin;
    const suggestedUris = [
        `${baseUrl}/bowheadwhale/user`,
        `${baseUrl}/auth`,
        `${baseUrl}/`,
    ];
    suggestedUris.forEach(uri => console.log('  -', uri));

    // 5. 檢查 COOP headers
    console.log('\n5️⃣ 檢查 COOP Headers:');
    console.log('  注意：如果看到 COOP 錯誤，請確認:');
    console.log('  - vite.config.ts 中的 headers 已註解');
    console.log('  - 已清除瀏覽器快取');
    console.log('  - 已重新啟動 dev server');

    console.log('\n=== 診斷完成 ===\n');
}
