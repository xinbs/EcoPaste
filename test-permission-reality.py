#!/usr/bin/env python3
"""
验证剪贴板监听功能的真实状态
"""

import subprocess
import sqlite3
import time
import os

def count_recent_records():
    """统计最近1分钟的记录数"""
    db_path = "src-tauri/history.db"
    if not os.path.exists(db_path):
        return 0
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM history WHERE createTime > datetime('now', '-1 minute')")
        count = cursor.fetchone()[0]
        conn.close()
        return count
    except:
        return 0

def test_text_clipboard():
    """测试文本剪贴板监听"""
    print("🔍 测试文本剪贴板监听功能...")
    
    # 记录开始时的记录数
    start_count = count_recent_records()
    print(f"📊 当前最近1分钟记录数: {start_count}")
    
    # 复制测试文本
    test_text = f"权限测试文本-{int(time.time())}"
    subprocess.run(['pbcopy'], input=test_text, text=True)
    print(f"📝 复制测试文本: {test_text}")
    
    # 等待处理
    print("⏳ 等待3秒检测自动监听...")
    time.sleep(3)
    
    # 检查是否有新记录
    end_count = count_recent_records()
    print(f"📊 处理后最近1分钟记录数: {end_count}")
    
    if end_count > start_count:
        print("✅ 文本剪贴板监听正常工作!")
        return True
    else:
        print("❌ 文本剪贴板监听未工作 - 需要辅助功能权限!")
        return False

def main():
    print("🔬 EcoPaste 剪贴板监听权限验证")
    print("=" * 40)
    
    text_works = test_text_clipboard()
    
    print("\n🎯 结论:")
    if text_works:
        print("✅ 剪贴板监听已启用 - 文本和图片都应该可以工作")
        print("💡 如果图片不工作，可能是图片处理逻辑的问题")
    else:
        print("❌ 剪贴板监听未启用 - 文本和图片都不会自动记录")
        print("🔧 解决方案:")
        print("   1. 打开 系统设置 > 隐私与安全性 > 辅助功能")
        print("   2. 找到 EcoPaste 或 eco-paste，勾选启用")
        print("   3. 重启 EcoPaste 应用")
        print("   4. 重新测试")
    
    print("\n📚 技术解释:")
    print("   - macOS 的剪贴板监听需要辅助功能权限")
    print("   - 文本和图片使用相同的监听机制")
    print("   - 权限问题会影响所有类型的自动记录")

if __name__ == "__main__":
    main()