#!/usr/bin/env python3
"""
图片处理流程诊断脚本
检查图片从剪贴板到数据库记录的完整流程
"""

import sqlite3
import subprocess
import time
import os

def get_db_path():
    """获取正确的数据库路径"""
    return "/Users/xinquan.liang/Library/Application Support/com.ayangweb.EcoPaste/EcoPaste.dev.db"

def get_images_path():
    """获取图片存储路径"""
    return "/Users/xinquan.liang/Library/Application Support/com.ayangweb.EcoPaste/images"

def count_db_records():
    """统计数据库记录"""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return {"total": 0, "image": 0, "text": 0, "html": 0}
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 总记录数
        cursor.execute("SELECT COUNT(*) FROM history")
        total = cursor.fetchone()[0]
        
        # 各类型记录数
        cursor.execute("SELECT type, COUNT(*) FROM history GROUP BY type")
        type_counts = dict(cursor.fetchall())
        
        conn.close()
        
        return {
            "total": total,
            "image": type_counts.get("image", 0),
            "text": type_counts.get("text", 0),
            "html": type_counts.get("html", 0),
            "files": type_counts.get("files", 0)
        }
    except Exception as e:
        print(f"❌ 数据库查询失败: {e}")
        return {"total": 0, "image": 0, "text": 0, "html": 0}

def count_image_files():
    """统计图片文件数量"""
    images_path = get_images_path()
    if not os.path.exists(images_path):
        return 0
    
    try:
        files = [f for f in os.listdir(images_path) if f.endswith('.png')]
        return len(files)
    except:
        return 0

def take_screenshot():
    """截图到剪贴板"""
    print("📸 截图到剪贴板...")
    result = subprocess.run(['screencapture', '-c'], capture_output=True)
    return result.returncode == 0

def check_clipboard_image():
    """检查剪贴板是否包含图片"""
    cmd = '''osascript -e 'try
    get the clipboard as «class PNGf»
    return "true"
on error
    return "false"
end try' '''
    
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip() == "true"

def get_latest_records():
    """获取最新的数据库记录"""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return []
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT id, type, substr(value, 1, 50) as short_value, 
                   width, height, createTime 
            FROM history 
            ORDER BY createTime DESC 
            LIMIT 3
        """)
        records = cursor.fetchall()
        conn.close()
        return records
    except Exception as e:
        print(f"❌ 获取记录失败: {e}")
        return []

def main():
    print("🔍 EcoPaste 图片处理流程诊断")
    print("=" * 50)
    
    # 1. 检查初始状态
    print("1️⃣ 检查初始状态:")
    initial_db = count_db_records()
    initial_files = count_image_files()
    
    print(f"   📊 数据库记录: 总数={initial_db['total']}, 图片={initial_db['image']}, 文本={initial_db['text']}")
    print(f"   📁 图片文件数: {initial_files}")
    
    # 2. 检查剪贴板状态
    print("\n2️⃣ 检查当前剪贴板:")
    has_image = check_clipboard_image()
    print(f"   🖼️  剪贴板包含图片: {has_image}")
    
    # 3. 截图测试
    print("\n3️⃣ 执行截图测试:")
    if take_screenshot():
        print("   ✅ 截图成功")
        
        # 确认剪贴板包含图片
        time.sleep(1)
        has_image = check_clipboard_image()
        print(f"   🔍 剪贴板现在包含图片: {has_image}")
        
        if has_image:
            # 4. 监控变化
            print("\n4️⃣ 监控系统变化 (等待10秒):")
            for i in range(10):
                time.sleep(1)
                current_db = count_db_records()
                current_files = count_image_files()
                
                db_changed = current_db['total'] != initial_db['total']
                files_changed = current_files != initial_files
                
                print(f"   {i+1}s: DB={current_db['total']}({current_db['image']}图), 文件={current_files}, 变化: DB={db_changed}, 文件={files_changed}")
                
                if db_changed or files_changed:
                    break
            
            # 5. 最终状态
            print("\n5️⃣ 最终状态:")
            final_db = count_db_records()
            final_files = count_image_files()
            
            print(f"   📊 最终数据库: 总数={final_db['total']}, 图片={final_db['image']}")
            print(f"   📁 最终文件数: {final_files}")
            
            db_added = final_db['total'] - initial_db['total']
            files_added = final_files - initial_files
            
            print(f"   📈 新增: 数据库+{db_added}, 文件+{files_added}")
            
            # 6. 显示最新记录
            print("\n6️⃣ 最新记录:")
            latest_records = get_latest_records()
            for record in latest_records:
                id_val, type_val, value, width, height, create_time = record
                print(f"   📝 {id_val[:12]}... | {type_val:5} | {value}... | {width}x{height} | {create_time}")
            
            # 7. 问题分析
            print("\n🎯 问题分析:")
            if files_added > 0 and db_added == 0:
                print("   ❌ 图片已保存但数据库记录未创建")
                print("   🔍 可能原因:")
                print("      - OCR 处理失败导致整个流程中断")
                print("      - 数据库写入权限问题") 
                print("      - 图片处理异常未被捕获")
                print("      - 主界面剪贴板监听回调有错误")
            elif files_added > 0 and db_added > 0:
                if final_db['image'] > initial_db['image']:
                    print("   ✅ 图片处理完全正常")
                else:
                    print("   ⚠️ 文件和记录都新增了，但图片记录数没变")
                    print("   🔍 可能记录被标记为其他类型")
            elif files_added == 0 and db_added == 0:
                print("   ❌ 完全没有反应")
                print("   🔍 可能原因:")
                print("      - 剪贴板监听未启用")
                print("      - 权限问题")
                print("      - 应用未正确运行")
        else:
            print("   ❌ 截图未成功复制到剪贴板")
    else:
        print("   ❌ 截图失败")
    
    print("\n✅ 诊断完成!")

if __name__ == "__main__":
    main()