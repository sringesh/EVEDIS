package com.tabmon.app

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.content.Context
import android.content.SharedPreferences
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.webkit.*
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var prefs: SharedPreferences

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Keep Screen On (No Dimming / Sleeping)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        // 2. Hide System Bars (Edge-to-Edge Immersive Fullscreen Mode)
        hideSystemUI()

        prefs = getSharedPreferences("TabMonPrefs", Context.MODE_PRIVATE)

        // 3. Hardware-Accelerated WebView
        webView = WebView(this).apply {
            setLayerType(View.LAYER_TYPE_HARDWARE, null)
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = true
                allowContentAccess = true
                useWideViewPort = true
                loadWithOverviewMode = true
                displayZoomControls = false
                builtInZoomControls = false
            }

            webChromeClient = object : WebChromeClient() {
                override fun onPermissionRequest(request: PermissionRequest) {
                    // Grant WebRTC camera/audio/screen permissions
                    request.grant(request.resources)
                }
            }

            webViewClient = object : WebViewClient() {
                override fun onReceivedError(
                    view: WebView?,
                    request: WebResourceRequest?,
                    error: WebResourceError?
                ) {
                    super.onReceivedError(view, request, error)
                    if (request?.isForMainFrame == true) {
                        promptForHostIp("Could not reach host. Please verify IP address.")
                    }
                }
            }
        }

        setContentView(webView)

        // Load host URL
        val savedHost = prefs.getString("last_host_url", null)
        if (savedHost != null) {
            webView.loadUrl(savedHost)
        } else {
            promptForHostIp("Enter your Mac's TabMon URL or IP:")
        }
    }

    private fun promptForHostIp(message: String) {
        val input = EditText(this).apply {
            hint = "e.g., 192.168.1.5 or http://192.168.1.5:4040"
            setText(prefs.getString("last_ip", ""))
        }

        AlertDialog.Builder(this)
            .setTitle("Connect to TabMon Host")
            .setMessage(message)
            .setView(input)
            .setCancelable(false)
            .setPositiveButton("Connect") { _, _ ->
                var text = input.text.toString().trim()
                if (!text.startsWith("http://") && !text.startsWith("https://")) {
                    text = if (text.contains(":")) "http://$text" else "http://$text:4040"
                }
                if (!text.endsWith("/client.html") && !text.contains("client.html")) {
                    text = "$text/client.html"
                }

                prefs.edit()
                    .putString("last_host_url", text)
                    .putString("last_ip", input.text.toString().trim())
                    .apply()

                webView.loadUrl(text)
            }
            .setNegativeButton("Retry") { _, _ ->
                promptForHostIp(message)
            }
            .show()
    }

    private fun hideSystemUI() {
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val insetsController = WindowInsetsControllerCompat(window, window.decorView)
        insetsController.hide(WindowInsetsCompat.Type.systemBars())
        insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) {
            hideSystemUI()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
    }
}
