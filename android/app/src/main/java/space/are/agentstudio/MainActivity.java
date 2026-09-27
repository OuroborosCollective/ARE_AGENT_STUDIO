package space.are.agentstudio;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.content.res.AssetManager;

import java.io.IOException;
import java.io.InputStream;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://app.local/";
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebViewClient(new LocalAssetClient(getAssets()));
        setContentView(webView);
        webView.loadUrl(ORIGIN);
    }

    private static final class LocalAssetClient extends WebViewClient {
        private final AssetManager assets;

        LocalAssetClient(AssetManager assets) {
            this.assets = assets;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            String scheme = request.getUrl().getScheme();
            String host = request.getUrl().getHost();
            if (!"https".equals(scheme) || !"app.local".equals(host)) {
                return super.shouldInterceptRequest(view, request);
            }

            String path = request.getUrl().getPath();
            if (path == null || path.isEmpty() || "/".equals(path)) {
                path = "/index.html";
            }

            String assetPath = "www" + path;
            try {
                InputStream stream = assets.open(assetPath);
                return new WebResourceResponse(
                    mimeType(path),
                    "UTF-8",
                    200,
                    "OK",
                    null,
                    stream
                );
            } catch (IOException ignored) {
                if (path.indexOf('.') < 0) {
                    try {
                        InputStream stream = assets.open("www/index.html");
                        return new WebResourceResponse(
                            "text/html",
                            "UTF-8",
                            200,
                            "OK",
                            null,
                            stream
                        );
                    } catch (IOException ignoredAgain) {
                        return notFound();
                    }
                }
                return notFound();
            }
        }

        private static WebResourceResponse notFound() {
            return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", null, null);
        }

        private static String mimeType(String path) {
            String lower = path.toLowerCase();
            if (lower.endsWith(".html")) return "text/html";
            if (lower.endsWith(".js")) return "text/javascript";
            if (lower.endsWith(".css")) return "text/css";
            if (lower.endsWith(".json")) return "application/json";
            if (lower.endsWith(".png")) return "image/png";
            if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
            if (lower.endsWith(".svg")) return "image/svg+xml";
            if (lower.endsWith(".webp")) return "image/webp";
            if (lower.endsWith(".woff")) return "font/woff";
            if (lower.endsWith(".woff2")) return "font/woff2";
            if (lower.endsWith(".map")) return "application/json";
            return "application/octet-stream";
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
