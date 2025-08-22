#!/usr/bin/env python3
"""
剪贴板内容调试脚本
"""

import subprocess
import os

def check_clipboard_formats():
    """检查剪贴板中的内容格式"""
    print("🔍 检查剪贴板内容格式...")
    
    # 检查文本内容
    try:
        result = subprocess.run(['pbpaste'], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            print(f"📝 文本内容: '{result.stdout.strip()[:50]}{'...' if len(result.stdout.strip()) > 50 else ''}'")
        else:
            print("📝 无文本内容")
    except Exception as e:
        print(f"❌ 获取文本内容失败: {e}")
    
    # 检查是否有图片
    try:
        # 使用 osascript 检查剪贴板内容类型
        cmd = '''osascript -e 'try
    get the clipboard as string
    return "text"
on error
    try
        get the clipboard as «class PNGf»
        return "image"
    on error
        try
            get the clipboard as «class TIFF»
            return "tiff"
        on error
            return "other"
        end try
    end try
end try' '''
        
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            content_type = result.stdout.strip()
            print(f"🎯 剪贴板内容类型: {content_type}")
            
            if content_type in ['image', 'tiff']:
                print("📸 确认剪贴板包含图片数据!")
            
        else:
            print(f"❌ 检查剪贴板类型失败: {result.stderr}")
            
    except Exception as e:
        print(f"❌ 检查剪贴板类型时发生错误: {e}")

def copy_test_image():
    """复制测试图片到剪贴板"""
    test_image = "test-image.png"
    if not os.path.exists(test_image):
        print(f"❌ 测试图片不存在: {test_image}")
        return False
        
    abs_path = os.path.abspath(test_image)
    print(f"📸 复制图片到剪贴板: {abs_path}")
    
    # 使用 osascript 复制图片
    cmd = f'''osascript -e 'set the clipboard to (read file POSIX file "{abs_path}" as «class PNGf»)' '''
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.returncode == 0:
        print("✅ 图片复制成功")
        return True
    else:
        print(f"❌ 图片复制失败: {result.stderr}")
        return False

def copy_test_text():
    """复制测试文本到剪贴板"""
    text = f"EcoPaste 测试文本 - {os.getpid()}"
    result = subprocess.run(['pbcopy'], input=text, text=True)
    if result.returncode == 0:
        print(f"✅ 文本复制成功: '{text}'")
        return True
    else:
        print("❌ 文本复制失败")
        return False

def main():
    print("🔧 EcoPaste 剪贴板调试工具")
    print("=" * 40)
    
    print("\n1️⃣ 当前剪贴板状态:")
    check_clipboard_formats()
    
    print("\n2️⃣ 复制测试文本:")
    copy_test_text()
    print("等待 2 秒...")
    import time
    time.sleep(2)
    check_clipboard_formats()
    
    print("\n3️⃣ 复制测试图片:")
    if copy_test_image():
        print("等待 2 秒...")
        time.sleep(2)
        check_clipboard_formats()
    
    print("\n✅ 调试完成!")
    print("\n📋 现在可以检查 EcoPaste 是否有新记录了")

if __name__ == "__main__":
    main()