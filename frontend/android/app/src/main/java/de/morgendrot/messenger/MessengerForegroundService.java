package de.morgendrot.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.BatteryManager;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;

/**
 * § H.6f — hält den Prozess im Vordergrund; ersetzt keine BLE/WebView-Logik.
 */
public class MessengerForegroundService extends Service {

    public static final String ACTION_START = "de.morgendrot.messenger.fg.START";
    public static final String ACTION_STOP = "de.morgendrot.messenger.fg.STOP";
    public static final String EXTRA_REASON = "reason";

    private static final String CHANNEL_ID = "morgendrot_messenger_sync";
    private static final int NOTIFICATION_ID = 61001;

    private static volatile boolean running = false;

    public static boolean isRunning() {
        return running;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            stopForegroundAndSelf();
            return START_NOT_STICKY;
        }

        if (!canStartByBatteryPolicy()) {
            running = false;
            stopSelf();
            return START_NOT_STICKY;
        }

        String reason =
            intent != null && intent.getStringExtra(EXTRA_REASON) != null
                ? intent.getStringExtra(EXTRA_REASON)
                : getString(R.string.fg_sync_notification_text);

        Notification notification = buildNotification(reason);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            );
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }
        running = true;
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    private void stopForegroundAndSelf() {
        running = false;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    private boolean canStartByBatteryPolicy() {
        BatteryManager bm = (BatteryManager) getSystemService(Context.BATTERY_SERVICE);
        if (bm == null) return true;
        int level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY);
        if (level < 0 || level >= 15) return true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            int status = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_STATUS);
            if (status == BatteryManager.BATTERY_STATUS_CHARGING
                || status == BatteryManager.BATTERY_STATUS_FULL) {
                return true;
            }
        }
        return false;
    }

    private Notification buildNotification(String text) {
        ensureChannel();
        Intent launch = new Intent(this, MainActivity.class);
        launch.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pending =
            PendingIntent.getActivity(
                this,
                0,
                launch,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.fg_sync_notification_title))
            .setContentText(text)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setOngoing(true)
            .setContentIntent(pending)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch =
            new NotificationChannel(
                CHANNEL_ID,
                getString(R.string.fg_sync_channel_name),
                NotificationManager.IMPORTANCE_LOW
            );
        ch.setDescription(getString(R.string.fg_sync_channel_desc));
        nm.createNotificationChannel(ch);
    }
}
