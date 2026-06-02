package de.morgendrot.messenger;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(MessengerFgSyncPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
