#!/usr/bin/env python3
"""
详细检查图片记录的脚本
"""

import sqlite3
import subprocess
import time
import os

def get_db_path():
    """获取正确的数据库路径"""
    return "/Users/xinquan.liang/Library/Application Support/com.ayangweb.EcoPaste/EcoPaste.dev.db"

def analyze_db_records():
    """详细分析数据库记录"""
    db_path = get_db_path()
    if not os.path.exists(db_path):
        print("❌ 数据库文件不存在")
        return
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 总记录数和类型分布
        cursor.execute("SELECT type, COUNT(*) FROM history GROUP BY type")
        type_counts = dict(cursor.fetchall())
        
        print("📊 数据库记录类型分布:")
        for type_name, count in type_counts.items():
            print(f"   {type_name}: {count}条")
        
        # 查看最新的10条记录
        cursor.execute("""
            SELECT id, type, substr(value, 1, 50) as short_value, 
                   width, height, count, createTime 
            FROM history 
            ORDER BY createTime DESC 
            LIMIT 10
        """)
        records = cursor.fetchall()
        
        print("\n📋 最新10条记录:")
        for i, record in enumerate(records, 1):
            record_id, record_type, value, width, height, count, create_time = record
            size_info = ""
            if width and height:
                size_info = f" ({width}x{height})"
            print(f"   {i}. [{record_type}]{size_info} {value}... ({create_time})")
        
        # 专门查看图片记录
        cursor.execute("""
            SELECT id, value, width, height, count, search, createTime 
            FROM history 
            WHERE type = 'image' 
            ORDER BY createTime DESC
        """)
        image_records = cursor.fetchall()
        
        print(f"\n🖼️  图片记录详情 (共{len(image_records)}条):")
        if image_records:
            for i, record in enumerate(image_records, 1):
                record_id, value, width, height, count, search, create_time = record
                print(f"   {i}. ID: {record_id[:12]}...")
                print(f"      路径: {value}")
                print(f"      尺寸: {width}x{height}")
                print(f"      大小: {count} 字节")
                print(f"      搜索: {search}")
                print(f"      时间: {create_time}")
                # 检查文件是否存在
                if os.path.exists(value):
                    actual_size = os.path.getsize(value)
                    print(f"      文件: ✅ 存在 ({actual_size} 字节)")
                else:
                    print(f"      文件: ❌ 不存在")
                print()
        else:
            print("   无图片记录")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ 数据库查询失败: {e}")

def test_image_with_analysis():
    """测试图片功能并分析结果"""
    print("🖼️  图片功能详细测试")
    print("=" * 50)
    
    # 分析初始状态
    print("1️⃣ 初始状态:")
    analyze_db_records()
    
    # 执行截图测试
    print("\n2️⃣ 执行截图测试:")
    result = subprocess.run(['screencapture', '-c'], capture_output=True)
    
    if result.returncode == 0:
        print("   📸 截图成功，等待处理...")
        time.sleep(8)
        
        print("\n3️⃣ 处理后状态:")
        analyze_db_records()
    else:
        print("   ❌ 截图失败")

if __name__ == "__main__":
    test_image_with_analysis()