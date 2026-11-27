package com.sooqsy.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import com.sooqsy.app.plugins.DeviceKeyPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(DeviceKeyPlugin.class);
        super.onCreate(savedInstanceState);

        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView()
                .getSettings()
                .setMediaPlaybackRequiresUserGesture(false);
        }
    }
}
