# Complete Solana Mobile Wallet Adapter Setup Guide

Follow this guide to easily copy-paste the native Solana Mobile MWA integration into any Capacitor + React application.

## 1. Install Dependencies

In your React app terminal, install the required packages:

```bash
npm install @solana/web3.js @solana/wallet-adapter-base @solana/wallet-adapter-react bs58 lucide-react
```

## 2. Update Android Config files

**A. Add the Solana Maven Repository:**
Open `android/build.gradle` (Project Level) and add `maven { url "https://solanamobile.com/maven" }` inside `allprojects { repositories { ... } }`.

```gradle
allprojects {
    repositories {
        google()
        mavenCentral()
        maven { url "https://solanamobile.com/maven" }
    }
}
```

**B. Add the Solana Android Dependency:**
Open `android/app/build.gradle` (App Level) and add the `mobile-wallet-adapter-clientlib-ktx` dependency.

```gradle
dependencies {
    // ... existing ...
    implementation 'com.solanamobile:mobile-wallet-adapter-clientlib-ktx:1.1.0'
}
```

---

## 3. Create the Native Android Plugin

Create a new file at `android/app/src/main/java/com/YOUR_APP_ID/SolanaMobilePlugin.kt` and paste the following.
**(Remember to change the `package` name at the very top to match your actual app id!)**

```kotlin
package com.cryptospell.game // <--- CHANGE THIS TO YOUR APP PACKAGE NAME

import android.util.Base64
import android.util.Log
import androidx.core.net.toUri
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import com.solana.mobilewalletadapter.clientlib.ConnectionIdentity
import com.solana.mobilewalletadapter.clientlib.MobileWalletAdapter
import com.solana.mobilewalletadapter.clientlib.TransactionResult
import com.solana.mobilewalletadapter.clientlib.protocol.MobileWalletAdapterClient.AuthorizationResult
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.atomic.AtomicBoolean

@CapacitorPlugin(name = "SolanaMobile")
@Suppress("unused")
class SolanaMobilePlugin : Plugin() {
    private val tag = "SolanaMobilePlugin"

    // --- Sanitized identity (share-safe) ---
    private val identity = ConnectionIdentity(
        identityUri = "https://yourdomain.com/".toUri(), // <-- Update yours
        iconUri = "favicon.ico".toUri(),
        identityName = "Your App Name" // <-- Update yours
    )

    private val walletAdapter: MobileWalletAdapter by lazy {
        MobileWalletAdapter(identity, 10000)
    }

    private val scope = CoroutineScope(Dispatchers.IO)
    private lateinit var sender: ActivityResultSender

    @Volatile private var pendingCall: PluginCall? = null
    @Volatile private var connectInProgress = false
    @Volatile private var signingInProgress = false
    private val mwaResultDelivered = AtomicBoolean(false)

    private var customRpcUrl = "https://api.mainnet-beta.solana.com"

    override fun load() {
        super.load()
        sender = ActivityResultSender(activity)
    }

    override fun handleOnResume() {
        super.handleOnResume()
        scope.launch {
            delay(60000)
            if (pendingCall != null && connectInProgress && !signingInProgress && !mwaResultDelivered.get()) {
                withContext(Dispatchers.Main) {
                    pendingCall?.reject("Connection cancelled by user — wallet did not respond within 60 seconds.")
                    clearState()
                }
            }
        }
    }

    @PluginMethod
    fun connect(call: PluginCall) {
        if (connectInProgress || signingInProgress) {
            call.reject("Wallet operation already in progress")
            return
        }
        connectInProgress = true
        signingInProgress = false
        mwaResultDelivered.set(false)
        pendingCall = call
        scope.launch { doConnect() }
    }

    private suspend fun doConnect() {
        val result: TransactionResult<AuthorizationResult> = try {
            walletAdapter.transact(sender) {
                authorize(identity.identityUri, identity.iconUri, identity.identityName, chain = "solana:mainnet")
            }
        } catch (e: Exception) {
            TransactionResult.Failure("MWA transact failed: ${e.message}", e)
        }
        withContext(Dispatchers.Main) { handleResult(result) }
    }

    private fun handleResult(result: TransactionResult<AuthorizationResult>) {
        mwaResultDelivered.set(true)
        val call = pendingCall ?: return
        when (result) {
            is TransactionResult.Success -> {
                try {
                    val authResult = result.payload
                    val first = authResult.accounts.first()
                    val pubKeyBytes = first.publicKey
                    val ret = JSObject().apply {
                        put("success", true)
                        put("publicKeyBase64", Base64.encodeToString(pubKeyBytes, Base64.NO_WRAP))
                        put("publicKeyBase58", encodeBase58(pubKeyBytes))
                        put("authToken", authResult.authToken)
                    }
                    call.resolve(ret)
                } catch (e: Exception) {
                    call.reject("Failed to parse wallet response: ${e.message}")
                }
                clearState()
            }
            is TransactionResult.Failure -> {
                call.reject("MWA returned Failure: ${result.message}")
                clearState()
            }
            is TransactionResult.NoWalletFound -> {
                call.reject("No compatible wallet found. Please install Phantom or Solflare.")
                clearState()
            }
        }
    }

    @PluginMethod
    fun signAndSendTransaction(call: PluginCall) {
        val txBase64 = call.getString("txBase64") ?: return call.reject("Missing txBase64")
        val rpcUrl = call.getString("rpcUrl") ?: customRpcUrl
        if (connectInProgress || signingInProgress) return call.reject("Wallet operation already in progress")

        signingInProgress = true
        connectInProgress = false
        pendingCall = call
        mwaResultDelivered.set(false)

        scope.launch {
            try {
                val txBytes = Base64.decode(txBase64, Base64.DEFAULT)
                val signResult = walletAdapter.transact(sender) {
                    signTransactions(arrayOf(txBytes))
                }

                mwaResultDelivered.set(true)

                if (signResult !is TransactionResult.Success) {
                    val reason = if (signResult is TransactionResult.Failure) signResult.message else "unknown"
                    call.reject("Transaction signing declined by wallet: $reason")
                    return@launch
                }

                val signedTxBase64 = Base64.encodeToString(signResult.payload.signedPayloads.first(), Base64.NO_WRAP)

                val signature: String
                try {
                    signature = sendTransactionToRpc(signedTxBase64, rpcUrl)
                        ?: throw Exception("RPC returned empty result.")
                } catch (e: Exception) {
                    call.reject("RPC submission failed: ${e.message}")
                    return@launch
                }

                call.resolve(JSObject().put("ok", true).put("txSignature", signature))
            } catch (e: Exception) {
                call.reject(e.message ?: "Unknown error")
            } finally {
                clearState()
            }
        }
    }

    private fun sendTransactionToRpc(signedTxBase64: String, rpcUrl: String = customRpcUrl): String? {
        val params = JSONArray().put(signedTxBase64).put(JSONObject().put("encoding", "base64"))
        val request = JSONObject().put("jsonrpc", "2.0").put("id", 1).put("method", "sendTransaction").put("params", params)

        val result = postJsonDetailed(rpcUrl, request, emptyMap())
        val response = result.json

        if (response != null && response.has("error")) {
            val errorObj = response.optJSONObject("error")
            val message = errorObj?.optString("message") ?: "Unknown RPC error"
            throw Exception("RPC Error: $message")
        }
        return response?.optString("result")
    }

    data class PostResult(val json: JSONObject?, val error: String? = null)

    private fun postJsonDetailed(urlStr: String, jsonBody: JSONObject, headers: Map<String, String>): PostResult {
        var conn: HttpURLConnection? = null
        return try {
            val url = URL(urlStr)
            conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            headers.forEach { (k, v) -> conn.setRequestProperty(k, v) }
            conn.doOutput = true
            val writer = OutputStreamWriter(conn.outputStream)
            writer.write(jsonBody.toString())
            writer.flush()

            val code = conn.responseCode
            if (code in 200..299) {
                val text = BufferedReader(InputStreamReader(conn.inputStream)).readText()
                PostResult(JSONObject(text))
            } else {
                PostResult(null, "HTTP $code")
            }
        } catch (e: Exception) {
            PostResult(null, "Exception: ${e.message}")
        } finally { conn?.disconnect() }
    }

    private fun clearState() {
        pendingCall = null
        connectInProgress = false
        signingInProgress = false
    }

    private fun encodeBase58(input: ByteArray): String {
        val alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
        if (input.isEmpty()) return ""
        var zeros = 0
        while (zeros < input.size && input[zeros].toInt() == 0) zeros++
        val copy = input.copyOf()
        val encoded = CharArray(copy.size * 2)
        var outputStart = encoded.size
        var inputStart = zeros
        while (inputStart < copy.size) {
            var remainder = 0
            for (i in inputStart until copy.size) {
                val temp = remainder * 256 + (copy[i].toInt() and 0xFF)
                copy[i] = (temp / 58).toByte()
                remainder = temp % 58
            }
            if (copy[inputStart].toInt() == 0) inputStart++
            encoded[--outputStart] = alphabet[remainder]
        }
        while (outputStart < encoded.size && encoded[outputStart] == alphabet[0]) outputStart++
        repeat(zeros) { encoded[--outputStart] = alphabet[0] }
        return String(encoded, outputStart, encoded.size - outputStart)
    }

    @PluginMethod fun disconnect(call: PluginCall) { call.resolve() }
}
```

---

## 4. Register Plugin in MainActivity.java

Open `android/app/src/main/java/com/YOURAPP/MainActivity.java` and add the `registerPlugin` line snippet in `onCreate`:

```java
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SolanaMobilePlugin.class);
    super.onCreate(savedInstanceState);
  }
}
```

---

## 5. JavaScript / Capacitor Bridge

Create a file `src/plugins/solanaMobile.ts`

```typescript
import { registerPlugin } from "@capacitor/core";

export interface ConnectResult {
  success: boolean;
  publicKeyBase64?: string;
  publicKeyBase58?: string;
  authToken?: string;
}

export interface SignAndSendResult {
  ok: boolean;
  txSignature: string;
}

export interface SolanaMobilePlugin {
  connect(): Promise<ConnectResult>;
  signAndSendTransaction(options: {
    txBase64: string;
    rpcUrl?: string;
  }): Promise<SignAndSendResult>;
  disconnect(): Promise<{ ok?: boolean }>;
}

export const SolanaMobile = registerPlugin<SolanaMobilePlugin>("SolanaMobile");
```

---

## 6. Wrapper Utility Library

Create a file `src/lib/solanaMobile.ts`

```typescript
import { SolanaMobile } from "../plugins/solanaMobile";

export async function connectWalletNative() {
  return await SolanaMobile.connect();
}

export async function signAndSendTransactionNative(
  txBase64: string,
  rpcUrl?: string,
) {
  return await SolanaMobile.signAndSendTransaction({ txBase64, rpcUrl });
}

export async function disconnectWalletNative() {
  return await SolanaMobile.disconnect();
}
```

---

## 7. React UI Component

Create a file `src/components/WalletButtons.tsx`

```tsx
import { useState } from "react";
import { Wallet, LogOut } from "lucide-react";
import { SolanaMobile } from "../plugins/solanaMobile";

export default function WalletButtons() {
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const onConnect = async () => {
    try {
      setBusy(true);
      const res = await SolanaMobile.connect();
      setAddress(res.publicKeyBase58 || res.publicKeyBase64 || "");
    } catch (e: any) {
      const errorMsg = e?.message || JSON.stringify(e);
      if (!errorMsg.toLowerCase().includes("cancelled")) {
        alert("Connection Error: " + errorMsg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onDisconnect = async () => {
    try {
      setBusy(true);
      await SolanaMobile.disconnect();
      setAddress("");
    } catch (e) {
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full flex flex-col gap-3 mt-4">
      {!address ? (
        <button
          onClick={onConnect}
          disabled={busy}
          className="p-3 bg-indigo-500 text-white rounded-md flex justify-center gap-2"
        >
          <Wallet size={18} />
          {busy ? "CONNECTING..." : "CONNECT WALLET"}
        </button>
      ) : (
        <div className="p-4 bg-gray-900 text-white rounded-md flex flex-col items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400"></span>
            <span className="text-xs">Connected</span>
          </div>
          <div className="font-mono text-sm bg-black/50 px-3 py-1 rounded">
            {address.substring(0, 4)}...{address.substring(address.length - 4)}
          </div>
          <button
            onClick={onDisconnect}
            disabled={busy}
            className="text-red-400 text-xs flex gap-1"
          >
            <LogOut size={12} /> DISCONNECT
          </button>
        </div>
      )}
    </div>
  );
}
```

## Final Steps

Run standard Capacitor commands in your terminal:

```bash
npm run build
npx cap sync android
```

Then build from Android Studio. You're done!
