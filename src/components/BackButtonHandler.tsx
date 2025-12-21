/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function BackButtonHandler() {
  const router = useRouter();
  // Using a ref to track if we've already pushed the state to avoid loops
  const hasPushedState = useRef(false);

  useEffect(() => {
    // 核心修复逻辑：
    // 在移动端，如果历史栈为空，点击物理返回键会直接退出应用。
    // 我们需要在进入页面时手动 push 一个 state，这样点击返回键时，
    // 浏览器会触发 popstate 事件而不是关闭页面。
    // 然后在 popstate 事件中，我们可以拦截并决定是真正返回还是执行其他操作（如 toast 提示）。
    
    // Push a dummy state when component mounts (app starts or page loads)
    if (!hasPushedState.current) {
        window.history.pushState(null, '', window.location.href);
        hasPushedState.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      // 当用户点击物理返回键时触发
      // 我们阻止默认的“退出”行为（因为我们之前 push 了一个 state，所以这里实际上是回到了前一个 state）
      
      // 如果不在根路径，则执行 router.back()
      if (window.location.pathname !== '/') {
         // 这里不需要 router.back()，因为 popstate 已经发生了 url 变化
         // 但我们需要让 Next.js 的 router 感知到变化
         // 通常 Next.js 会自动处理 popstate。
         // 问题在于如果已经是 root，再 back 就会退出。
      } else {
         // 如果在根路径，再次 push state 防止退出，或者显示“再按一次退出”
         // 这里简单处理：始终保持有一个历史记录，防止误触退出
         window.history.pushState(null, '', window.location.href);
         // 可以添加 Toast: "再按一次退出" 逻辑，这里暂略
      }
    };

    window.addEventListener('popstate', handlePopState);

    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  return null;
}
