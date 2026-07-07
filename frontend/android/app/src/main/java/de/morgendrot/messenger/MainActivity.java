package de.morgendrot.messenger;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MessengerFgSyncPlugin.class);
        WebView.setWebContentsDebuggingEnabled(true);
        super.onCreate(savedInstanceState);
    }
}
