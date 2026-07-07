package de.morgendrot.messenger;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MessengerFgSyncPlugin.class);
        WebView.setWebContentsDebuggingEnabled(true);
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onResume() {
        super.onResume();
        allowLanHttpFromHttpsShell();
    }

    /** Capacitor shell is https://localhost — Boss-LAN API is cleartext HTTP (§ H.36 P1). */
    private void allowLanHttpFromHttpsShell() {
        WebView webView = bridge != null ? bridge.getWebView() : null;
        if (webView != null) {
            webView.getSettings().setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }
    }
}
