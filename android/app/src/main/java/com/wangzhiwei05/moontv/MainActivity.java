package com.wangzhiwei05.moontv;

import android.content.res.Configuration;
import android.os.Bundle;
import android.view.WindowManager;
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
