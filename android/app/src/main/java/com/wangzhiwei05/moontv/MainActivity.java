package com.wangzhiwei05.moontv;

import android.content.pm.ActivityInfo;
import android.content.res.Configuration;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.widget.FrameLayout;
import androidx.annotation.NonNull;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 全面屏适配
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        
        // 保持屏幕常亮（针对播放场景优化）
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // --- 核心修复代码开始 ---
        WebView webView = getBridge().getWebView();
        if (webView != null) {
            // 问题二：修改 UserAgent，去除 Mobile 标识，显示桌面版网页（找回顶部功能键）
            WebSettings settings = webView.getSettings();
            String ua = settings.getUserAgentString();
            // 移除 "Mobile" 关键字，强制识别为 PC/平板
            settings.setUserAgentString(ua.replace("Mobile", "").trim());

            // 问题一：全屏播放体验修复（沉浸式 + 强制横屏）
            webView.setWebChromeClient(new WebChromeClient() {
                private View mCustomView;
                private WebChromeClient.CustomViewCallback mCustomViewCallback;

                @Override
                public void onShowCustomView(View view, CustomViewCallback callback) {
                    if (mCustomView != null) {
                        callback.onCustomViewHidden();
                        return;
                    }
                    mCustomView = view;
                    mCustomViewCallback = callback;

                    // 1. 隐藏状态栏和导航栏 (沉浸式)
                    getWindow().getDecorView().setSystemUiVisibility(
                            View.SYSTEM_UI_FLAG_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    );

                    // 2. 强制横屏
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

                    // 3. 添加全屏视图
                    ((ViewGroup) getWindow().getDecorView()).addView(mCustomView, new FrameLayout.LayoutParams(
                            ViewGroup.LayoutParams.MATCH_PARENT,
                            ViewGroup.LayoutParams.MATCH_PARENT));
                }

                @Override
                public void onHideCustomView() {
                    if (mCustomView == null) return;
                    
                    ((ViewGroup) getWindow().getDecorView()).removeView(mCustomView);
                    mCustomView = null;

                    // 恢复系统 UI 显示
                    getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);

                    // 强制切回竖屏
                    setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);

                    if (mCustomViewCallback != null) {
                        mCustomViewCallback.onCustomViewHidden();
                        mCustomViewCallback = null;
                    }
                }
            });
        }
        // --- 核心修复代码结束 ---
    }

    @Override
    public void onConfigurationChanged(@NonNull Configuration newConfig) {
        super.onConfigurationChanged(newConfig);
        // 监听屏幕旋转，可在此处添加特定的布局调整逻辑
        if (newConfig.orientation == Configuration.ORIENTATION_LANDSCAPE) {
            // 横屏时的处理
        } else if (newConfig.orientation == Configuration.ORIENTATION_PORTRAIT) {
            // 竖屏时的处理
        }
    }
}