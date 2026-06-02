package de.morgendrot.messenger;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "MessengerFgSync")
public class MessengerFgSyncPlugin extends Plugin {

    private static final int REQ_POST_NOTIFICATIONS = 61002;

    @PluginMethod
    public void start(PluginCall call) {
        if (getActivity() == null) {
            call.reject("Keine Activity — Foreground-Service nicht startbar.");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    getActivity(),
                    new String[] { Manifest.permission.POST_NOTIFICATIONS },
                    REQ_POST_NOTIFICATIONS
                );
            }
        }
        String reason = call.getString("reason");
        if (reason == null || reason.trim().isEmpty()) {
            reason = getContext().getString(R.string.fg_sync_notification_text);
        }
        Intent intent = new Intent(getContext(), MessengerForegroundService.class);
        intent.setAction(MessengerForegroundService.ACTION_START);
        intent.putExtra(MessengerForegroundService.EXTRA_REASON, reason);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("running", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        Intent intent = new Intent(getContext(), MessengerForegroundService.class);
        intent.setAction(MessengerForegroundService.ACTION_STOP);
        getContext().startService(intent);
        JSObject ret = new JSObject();
        ret.put("ok", true);
        ret.put("running", false);
        call.resolve(ret);
    }

    @PluginMethod
    public void getState(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("running", MessengerForegroundService.isRunning());
        call.resolve(ret);
    }
}
