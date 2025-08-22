#!/usr/bin/env python3
"""
测试修复后的EcoPaste功能
"""

import sqlite3
import subprocess
import time
import os

def get_db_path():
    """获取正确的数据库路径"""
    return "/Users/xinquan.liang/Library/Application Support/com.ayangweb.EcoPaste/EcoPaste.dev.db"

def count_db_records():
    """统计数据库记录"""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        return {"total": 0, "image": 0, "text": 0}
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 总记录数
        cursor.execute("SELECT COUNT(*) FROM history")
        total = cursor.fetchone()[0]
        
        # 各类型记录数
        cursor.execute("SELECT type, COUNT(*) FROM history GROUP BY type")
        type_counts = dict(cursor.fetchall())
        
        # 最新的几条记录
        cursor.execute("""
            SELECT id, type, substr(value, 1, 30) as short_value, createTime 
            FROM history 
            ORDER BY createTime DESC 
            LIMIT 5
        """)
        recent_records = cursor.fetchall()
        
        conn.close()
        
        return {
            "total": total,
            "image": type_counts.get("image", 0),
            "text": type_counts.get("text", 0),
            "html": type_counts.get("html", 0),
            "files": type_counts.get("files", 0),
            "recent": recent_records
        }
    except Exception as e:
        print(f"❌ 数据库查询失败: {e}")
        return {"total": 0, "image": 0, "text": 0, "recent": []}

def test_text_functionality():
    """测试文本功能"""
    print("🔤 测试文本剪贴板功能...")
    
    # 记录开始状态
    start_state = count_db_records()
    print(f"   📊 初始状态: 总数={start_state['total']}, 文本={start_state['text']}, 图片={start_state['image']}")
    
    # 测试文本复制
    test_text = f"修复测试文本-{int(time.time())}"
    subprocess.run(['pbcopy'], input=test_text, text=True)
    print(f"   📝 复制文本: {test_text}")
    
    # 等待处理
    print("   ⏳ 等待5秒检测处理...")
    time.sleep(5)
    
    # 检查结果
    end_state = count_db_records()
    print(f"   📊 处理后: 总数={end_state['total']}, 文本={end_state['text']}, 图片={end_state['image']}")
    
    text_added = end_state['text'] - start_state['text']
    if text_added > 0:
        print("   ✅ 文本功能正常！")
        return True
    else:
        print("   ❌ 文本功能仍有问题")
        return False

def test_image_functionality():
    """测试图片功能"""
    print("\n🖼️  测试图片剪贴板功能...")
    
    # 记录开始状态
    start_state = count_db_records()
    print(f"   📊 初始状态: 总数={start_state['total']}, 文本={start_state['text']}, 图片={start_state['image']}")
    
    # 测试截图
    print("   📸 执行截图...")
    result = subprocess.run(['screencapture', '-c'], capture_output=True)
    
    if result.returncode == 0:
        print("   ✅ 截图成功")
        
        # 等待处理
        print("   ⏳ 等待10秒检测处理...")
        time.sleep(10)
        
        # 检查结果
        end_state = count_db_records()
        print(f"   📊 处理后: 总数={end_state['total']}, 文本={end_state['text']}, 图片={end_state['image']}")
        
        image_added = end_state['image'] - start_state['image']
        total_added = end_state['total'] - start_state['total']
        
        if image_added > 0:
            print("   ✅ 图片功能正常！")
            return True
        elif total_added > 0:
            print("   ⚠️ 有新记录但不是图片类型，检查最新记录...")
            for record in end_state['recent'][:2]:
                print(f"      📝 {record[1]}: {record[2]}...")
            return False
        else:
            print("   ❌ 图片功能仍有问题")
            return False
    else:
        print("   ❌ 截图失败")
        return False

def show_recent_records():
    """显示最近的记录"""
    print("\n📋 最近的剪贴板记录:")
    state = count_db_records()
    
    if state['recent']:
        for i, record in enumerate(state['recent'], 1):
            record_id, record_type, value, create_time = record
            print(f"   {i}. [{record_type}] {value}... ({create_time})")
    else:
        print("   ❌ 无记录")

def main():
    print("🔧 EcoPaste 修复验证测试")
    print("=" * 50)
    
    # 测试文本功能
    text_works = test_text_functionality()
    
    # 测试图片功能
    image_works = test_image_functionality()
    
    # 显示最近记录
    show_recent_records()
    
    # 总结
    print("\n🎯 测试结果总结:")
    print(f"   文本功能: {'✅ 正常' if text_works else '❌ 异常'}")
    print(f"   图片功能: {'✅ 正常' if image_works else '❌ 异常'}")
    
    if text_works and image_works:
        print("\n🎉 所有功能修复成功！")
        print("💡 现在可以测试UI标签页切换功能:")
        print("   1. 打开EcoPaste应用")
        print("   2. 点击不同的标签页（全部、文本、图片）")
        print("   3. 查看列表是否正确更新")
    elif text_works:
        print("\n⚠️ 文本功能已修复，但图片功能仍需要进一步调试")
    else:
        print("\n❌ 功能仍有问题，需要进一步检查代码")

if __name__ == "__main__":
    main()