package com.nexus.rectoc;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;
import io.capawesome.capacitorjs.plugins.firebase.firestore.FirebaseFirestorePlugin;
import com.capacitorjs.plugins.camera.CameraPlugin;
import com.capacitorjs.plugins.filesystem.FilesystemPlugin;
import android.webkit.WebView;
import android.webkit.WebSettings;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FirebaseAuthenticationPlugin.class);
        registerPlugin(FirebaseFirestorePlugin.class);
        registerPlugin(CameraPlugin.class);
        registerPlugin(FilesystemPlugin.class);
        
        // Enable mixed content in WebView for development
        WebView.setWebContentsDebuggingEnabled(true);
        WebSettings settings = bridge.getWebView().getSettings();
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
    }
}
