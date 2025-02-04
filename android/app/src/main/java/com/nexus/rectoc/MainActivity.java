package com.nexus.rectoc;

import com.getcapacitor.BridgeActivity;
import android.os.Bundle;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;
import io.capawesome.capacitorjs.plugins.firebase.firestore.FirebaseFirestorePlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(FirebaseAuthenticationPlugin.class);
        registerPlugin(FirebaseFirestorePlugin.class);
    }
}
