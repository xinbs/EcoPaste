#!/usr/bin/env python3
"""
直接测试图片功能的脚本
绕过剪贴板监听，直接向数据库插入图片记录
"""

import sqlite3
import os
import shutil
from datetime import datetime

def create_test_image_record():
    """直接在数据库中创建图片记录来测试图片显示功能"""
    
    # 确保测试图片存在
    test_image = "test-image.png"
    if not os.path.exists(test_image):
        print(f"❌ 测试图片不存在: {test_image}")
        return False
    
    # 创建images目录（模拟EcoPaste的行为）
    images_dir = "src-tauri/images"
    os.makedirs(images_dir, exist_ok=True)
    
    # 复制图片到images目录（模拟EcoPaste保存图片的行为）
    target_image = os.path.join(images_dir, "test-direct.png")
    shutil.copy2(test_image, target_image)
    
    # 获取图片信息
    image_size = os.path.getsize(target_image)
    
    print(f"📸 测试图片: {test_image}")
    print(f"💾 目标路径: {target_image}")
    print(f"📏 文件大小: {image_size} 字节")
    
    # 连接数据库
    db_path = "src-tauri/history.db"
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 插入图片记录
        record_id = "direct-test-image"
        create_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        cursor.execute("""
            INSERT OR REPLACE INTO history 
            (id, type, value, search, "group", subtype, count, width, height, createTime, favorite)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record_id,
            "image",
            target_image,  # 图片路径
            "test image",  # 搜索文本
            "image",       # 分组
            None,          # 子类型
            image_size,    # 文件大小
            400,           # 宽度（示例值）
            300,           # 高度（示例值）  
            create_time,   # 创建时间
            0              # 不是收藏
        ))
        
        conn.commit()
        print(f"✅ 成功插入图片记录: {record_id}")
        
        # 验证插入结果
        cursor.execute("SELECT * FROM history WHERE id = ?", (record_id,))
        record = cursor.fetchone()
        if record:
            print("📋 插入的记录:")
            columns = [desc[0] for desc in cursor.description]
            for i, value in enumerate(record):
                print(f"   {columns[i]}: {value}")
        
        conn.close()
        return True
        
    except Exception as e:
        print(f"❌ 数据库操作失败: {e}")
        return False

def check_image_display():
    """检查图片记录和文件"""
    print("\n🔍 检查图片记录和文件:")
    
    db_path = "src-tauri/history.db"
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # 查询图片记录
        cursor.execute("SELECT id, type, value, width, height, count FROM history WHERE type = 'image' ORDER BY createTime DESC")
        image_records = cursor.fetchall()
        
        print(f"📸 图片记录总数: {len(image_records)}")
        
        for record in image_records:
            record_id, record_type, image_path, width, height, count = record
            print(f"\n🖼️  记录 ID: {record_id}")
            print(f"   类型: {record_type}")
            print(f"   路径: {image_path}")
            print(f"   尺寸: {width}x{height}")
            print(f"   大小: {count} 字节")
            
            # 检查文件是否存在
            if os.path.exists(image_path):
                actual_size = os.path.getsize(image_path)
                print(f"   文件状态: ✅ 存在 ({actual_size} 字节)")
            else:
                print(f"   文件状态: ❌ 不存在")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ 检查失败: {e}")

def main():
    print("🎯 EcoPaste 图片功能直接测试")
    print("=" * 40)
    
    print("1️⃣ 创建测试图片记录...")
    if create_test_image_record():
        print("\n2️⃣ 验证图片记录...")
        check_image_display()
        
        print("\n✅ 测试完成!")
        print("\n💡 提示:")
        print("   - 现在可以在 EcoPaste 应用中查看是否显示了图片")
        print("   - 检查图片列表或切换到'图片'分组")
        print("   - 如果图片显示正常，说明图片处理功能本身是工作的")
        print("   - 如果仍然不显示，可能是 UI 渲染或路径转换的问题")
    else:
        print("❌ 测试失败")

if __name__ == "__main__":
    main()