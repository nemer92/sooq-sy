
package com.sooqsy.app.plugins;

import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;

import java.security.KeyPairGenerator;
import java.security.KeyStore;
import java.security.Signature;
import java.security.cert.Certificate;

import java.nio.charset.StandardCharsets;
import java.security.spec.ECGenParameterSpec;

@CapacitorPlugin(name = "DeviceKey")
public class DeviceKeyPlugin extends Plugin {

    private static final String KEY_ALIAS = "sooq_sy_referral_device_key";
    private static final String ATTESTED_KEY_ALIAS = "sooq_sy_referral_attested_key_v1";

@PluginMethod
public void hasAttestedKey(PluginCall call) {
    try {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        JSObject result = new JSObject();
        result.put("exists", keyStore.containsAlias(ATTESTED_KEY_ALIAS));

        call.resolve(result);
    } catch (Exception e) {
        call.reject("DEVICE_KEY_CHECK_ERROR: " + e.getMessage());
    }
}

    @PluginMethod
    public void getAttestedKeyMaterial(PluginCall call) {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);

            if (!keyStore.containsAlias(ATTESTED_KEY_ALIAS)) {
                call.reject("ATTESTED_KEY_NOT_FOUND");
                return;
            }

            Certificate[] chain =
                keyStore.getCertificateChain(ATTESTED_KEY_ALIAS);

            if (chain == null || chain.length < 2) {
                call.reject("ATTESTATION_CERTIFICATE_CHAIN_UNAVAILABLE");
                return;
            }

            JSArray certificateChain = new JSArray();

            for (Certificate certificate : chain) {
                certificateChain.put(
                    Base64.encodeToString(
                        certificate.getEncoded(),
                        Base64.NO_WRAP
                    )
                );
            }

            JSObject result = new JSObject();

            result.put(
                "publicKey",
                Base64.encodeToString(
                    chain[0].getPublicKey().getEncoded(),
                    Base64.NO_WRAP
                )
            );

            result.put("certificateChain", certificateChain);

            call.resolve(result);

        } catch (Exception e) {
            call.reject("ATTESTED_KEY_MATERIAL_ERROR: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getPublicKey(PluginCall call) {
        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);

            if (!keyStore.containsAlias(KEY_ALIAS)) {
                KeyPairGenerator generator = KeyPairGenerator.getInstance(
                    KeyProperties.KEY_ALGORITHM_EC,
                    "AndroidKeyStore"
                );

                KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY
                )
                    .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                    .setDigests(KeyProperties.DIGEST_SHA256)
                    .build();

                generator.initialize(spec);
                generator.generateKeyPair();
            }

            Certificate certificate = keyStore.getCertificate(KEY_ALIAS);

            JSObject result = new JSObject();
            result.put("publicKey", Base64.encodeToString(
                certificate.getPublicKey().getEncoded(),
                Base64.NO_WRAP
            ));

            call.resolve(result);

        } catch (Exception e) {
            call.reject("DEVICE_KEY_ERROR: " + e.getMessage());
        }
    }

    @PluginMethod
    public void createAttestedKey(PluginCall call) {
        String challenge = call.getString("challenge");

        if (challenge == null || challenge.isEmpty()) {
            call.reject("Attestation challenge is required");
            return;
        }

        if (Build.VERSION.SDK_INT < 24) {
            call.reject("Hardware key attestation requires Android 7.0 or newer");
            return;
        }

        try {
            byte[] challengeBytes = Base64.decode(
                challenge,
                Base64.URL_SAFE | Base64.NO_WRAP | Base64.NO_PADDING
            );

            if (challengeBytes.length < 16 || challengeBytes.length > 128) {
                call.reject("Invalid attestation challenge length");
                return;
            }

            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);

if (keyStore.containsAlias(ATTESTED_KEY_ALIAS)) {
    call.reject("ATTESTED_KEY_ALREADY_EXISTS");
    return;
}

            KeyPairGenerator generator = KeyPairGenerator.getInstance(
                KeyProperties.KEY_ALGORITHM_EC,
                "AndroidKeyStore"
            );

            KeyGenParameterSpec spec = new KeyGenParameterSpec.Builder(
                ATTESTED_KEY_ALIAS,
                KeyProperties.PURPOSE_SIGN | KeyProperties.PURPOSE_VERIFY
            )
                .setAlgorithmParameterSpec(new ECGenParameterSpec("secp256r1"))
                .setDigests(KeyProperties.DIGEST_SHA256)
                .setAttestationChallenge(challengeBytes)
                .build();

            generator.initialize(spec);
            generator.generateKeyPair();

            Certificate[] chain =
                keyStore.getCertificateChain(ATTESTED_KEY_ALIAS);

            if (chain == null || chain.length == 0) {
                call.reject("Attestation certificate chain unavailable");
                return;
            }

            JSArray certificateChain = new JSArray();

            for (Certificate certificate : chain) {
                certificateChain.put(
                    Base64.encodeToString(
                        certificate.getEncoded(),
                        Base64.NO_WRAP
                    )
                );
            }

            Certificate leaf = chain[0];

            JSObject result = new JSObject();
            result.put("publicKey", Base64.encodeToString(
                leaf.getPublicKey().getEncoded(),
                Base64.NO_WRAP
            ));
            result.put("certificateChain", certificateChain);

            call.resolve(result);

        } catch (Exception e) {
            call.reject("KEY_ATTESTATION_ERROR: " + e.getMessage());
        }
    }

    @PluginMethod
    public void signChallenge(PluginCall call) {
        signWithAlias(call, KEY_ALIAS);
    }

    @PluginMethod
    public void signAttestedChallenge(PluginCall call) {
        signWithAlias(call, ATTESTED_KEY_ALIAS);
    }

    private void signWithAlias(PluginCall call, String alias) {
        String challenge = call.getString("challenge");

        if (challenge == null || challenge.isEmpty()) {
            call.reject("Challenge is required");
            return;
        }

        try {
            KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
            keyStore.load(null);

            java.security.Key key = keyStore.getKey(alias, null);

            if (!(key instanceof java.security.PrivateKey)) {
                call.reject("Device key not found");
                return;
            }

            Signature signer = Signature.getInstance("SHA256withECDSA");
            signer.initSign((java.security.PrivateKey) key);
            signer.update(challenge.getBytes(StandardCharsets.UTF_8));

            String signature = Base64.encodeToString(
                signer.sign(),
                Base64.NO_WRAP
            );

            JSObject result = new JSObject();
            result.put("signature", signature);
            call.resolve(result);

        } catch (Exception e) {
            call.reject("DEVICE_SIGN_ERROR: " + e.getMessage());
        }
    }
}
