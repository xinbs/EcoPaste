#!/usr/bin/env python3
"""
EcoPaste 图片剪贴板功能测试脚本
"""

import subprocess
import time
import sqlite3
import os

def copy_image_to_clipboard(image_path):
    """将图片复制到剪贴板 - macOS版本"""
    try:
        # 使用 osascript 将图片复制到剪贴板
        cmd = f'''osascript -e 'set the clipboard to (read file POSIX file "{image_path}" as «class PNGf»)' '''
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        
        if result.returncode == 0:
            print("✅ 图片已成功复制到剪贴板")
            return True
        else:
            print(f"❌ 复制图片到剪贴板失败: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ 复制图片时发生错误: {e}")
        return False

def check_clipboard_history():
    """检查剪贴板历史记录数据库"""
    db_path = "src-tauri/history.db"
    if not os.path.exists(db_path):
        print("❌ 数据库文件不存在")
        return
        
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 查询所有记录
        cursor.execute("SELECT id, type, substr(value, 1, 50) as short_value, count, width, height, createTime FROM history ORDER BY createTime DESC LIMIT 10")
        records = cursor.fetchall()
        
        print("\n📋 剪贴板历史记录 (最近10条):")
        print("ID | 类型 | 值 | 字节数 | 宽度 | 高度 | 创建时间")
        print("-" * 80)
        
        for record in records:
            id_val, type_val, value, count, width, height, create_time = record
            print(f"{id_val[:8]} | {type_val:5} | {value[:30]:30} | {count or 0:6} | {width or 0:4} | {height or 0:4} | {create_time}")
        
        # 特别检查图片记录
        cursor.execute("SELECT COUNT(*) FROM history WHERE type = 'image'")
        image_count = cursor.fetchone()[0]
        print(f"\n📸 图片记录总数: {image_count}")
        
        if image_count > 0:
            cursor.execute("SELECT id, value, width, height, createTime FROM history WHERE type = 'image' ORDER BY createTime DESC LIMIT 3")
            image_records = cursor.fetchall()
            print("\n最近的图片记录:")
            for record in image_records:
                id_val, path, width, height, create_time = record
                print(f"  🖼️  ID: {id_val}")
                print(f"      路径: {path}")
                print(f"      尺寸: {width}x{height}")
                print(f"      时间: {create_time}")
                
                # 检查文件是否存在
                if os.path.exists(path):
                    size = os.path.getsize(path)
                    print(f"      文件大小: {size} 字节 ✅")
                else:
                    print(f"      文件不存在 ❌")
                print()
        
        conn.close()
        
    except Exception as e:
        print(f"❌ 查询数据库时发生错误: {e}")

def main():
    print("🚀 EcoPaste 图片剪贴板功能测试")
    print("=" * 50)
    
    # 获取测试图片路径
    test_image = "test-image.png"
    if not os.path.exists(test_image):
        print(f"❌ 测试图片不存在: {test_image}")
        return
    
    print(f"📸 使用测试图片: {test_image}")
    image_size = os.path.getsize(test_image)
    print(f"📏 图片大小: {image_size} 字节")
    
    # 检查当前状态
    print("\n1️⃣ 检查当前剪贴板历史状态...")
    check_clipboard_history()
    
    # 复制图片到剪贴板
    print("\n2️⃣ 复制图片到剪贴板...")
    if not copy_image_to_clipboard(os.path.abspath(test_image)):
        return
    
    # 等待EcoPaste处理
    print("\n3️⃣ 等待 EcoPaste 处理图片...")
    print("请确保 EcoPaste 应用正在运行并启用了剪贴板监听...")
    time.sleep(3)  # 等待3秒让EcoPaste处理
    
    # 再次检查状态
    print("\n4️⃣ 检查处理后的剪贴板历史状态...")
    check_clipboard_history()
    
    # 检查images目录
    print("\n5️⃣ 检查图片存储目录...")
    data_dirs = [
        "src-tauri/images",
        os.path.expanduser("~/Library/Application Support/com.tauri.dev/images"),
        os.path.expanduser("~/Library/Application Support/EcoPaste/images"),
    ]
    
    for dir_path in data_dirs:
        if os.path.exists(dir_path):
            files = os.listdir(dir_path)
            print(f"📁 {dir_path}: {len(files)} 个文件")
            for file in files[:5]:  # 显示前5个文件
                file_path = os.path.join(dir_path, file)
                size = os.path.getsize(file_path)
                print(f"   - {file} ({size} 字节)")
        else:
            print(f"📁 {dir_path}: 目录不存在")
    
    print("\n✅ 测试完成!")
    print("\n💡 提示:")
    print("   - 如果没有看到图片记录，请确保 EcoPaste 正在运行")
    print("   - 检查应用是否启用了剪贴板监听")
    print("   - 尝试手动复制一张图片再运行此脚本")

if __name__ == "__main__":
    main()