#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
資料更新工具
處理新增資料並合併到 data.csv
"""

import csv
import shutil
import time
from pathlib import Path
from datetime import datetime

# 設定路徑
SCRIPT_DIR = Path(__file__).parent
DATA_CSV = SCRIPT_DIR / "data.csv"
NEW_DATA_FILE = SCRIPT_DIR / "new_data.txt"
LOG_FILE = SCRIPT_DIR / "data_update_log.txt"
BACKUP_DIR = SCRIPT_DIR / "backup"

def get_max_id_with_prefix(existing_ids, prefix):
    """取得特定前綴的最大編號"""
    matching_ids = [id_str for id_str in existing_ids if id_str.startswith(prefix) and id_str[len(prefix):].isdigit()]

    if not matching_ids:
        return int(f"{prefix}000")

    max_id = max(int(id_str) for id_str in matching_ids)
    return max_id

def get_next_na_id(existing_ids, intro):
    """根據 intro 判斷是家長還是其他，分配 8XXX 或 9XXX"""
    if '家長' in intro:
        # 家長 → 8XXX
        max_id = get_max_id_with_prefix(existing_ids, '8')
        next_id = max_id + 1
        return f"{next_id:04d}"
    else:
        # 其他 → 9XXX
        max_id = get_max_id_with_prefix(existing_ids, '9')
        next_id = max_id + 1
        return f"{next_id:04d}"

def validate_csv_format(file_path):
    """檢查 CSV 格式是否有未閉合的引號"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        # 檢查引號數量是否成對
        quote_count = content.count('"')
        if quote_count % 2 != 0:
            print("⚠️  警告：發現未閉合的雙引號！")
            print("   這會導致 CSV 解析失敗，請檢查以下可能的問題：")
            print("   1. 多行 quote 欄位缺少結尾的雙引號")
            print("   2. 內容中的引號沒有正確轉義")
            print()

            # 嘗試找出可能有問題的行
            lines = content.split('\n')
            in_quote = False
            problem_lines = []

            for i, line in enumerate(lines, 1):
                # 簡單計數（不完美但能抓大部分問題）
                line_quotes = line.count('"')
                if line_quotes % 2 != 0:
                    in_quote = not in_quote
                    if in_quote:
                        problem_lines.append(i)

            if problem_lines:
                print(f"   可能有問題的行號: {problem_lines[:5]}")
                print()

            return False

        return True
    except Exception as e:
        print(f"⚠️  格式檢查失敗: {e}")
        return True  # 檢查失敗不影響執行

def record_to_csv_line(record, fieldnames):
    """將 record dict 轉為 CSV 行（用於 log）"""
    values = [record.get(field, '') for field in fieldnames]
    return ','.join(f'"{v}"' if ',' in v or '\n' in v or '"' in v else v for v in values)

def process_new_data():
    """處理新資料並合併到 data.csv"""

    # 1. 建立 backup 資料夾
    BACKUP_DIR.mkdir(exist_ok=True)

    # 2. 備份原始 data.csv
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    backup_file = BACKUP_DIR / f"data_{timestamp}.csv"

    if DATA_CSV.exists():
        shutil.copy2(DATA_CSV, backup_file)
        print(f"✅ 已備份: {backup_file}")
    else:
        print("⚠️  data.csv 不存在，將建立新檔案")

    # 3. 讀取現有資料
    existing_data = {}
    existing_ids = set()
    fieldnames = ['id', 'name', 'code', 'intro', 'quote', 'photo', 'checkedIn']

    if DATA_CSV.exists():
        with open(DATA_CSV, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            fieldnames = reader.fieldnames
            for row in reader:
                id_val = row.get('id', '').strip()
                # 跳過無效行（id 為空或不合理）
                if id_val and not id_val.startswith('很開心') and not id_val.startswith('期待') and not id_val.startswith('祝'):
                    existing_data[id_val] = row
                    existing_ids.add(id_val)

    print(f"📊 現有資料: {len(existing_data)} 筆")
    print(f"📋 欄位: {fieldnames}")

    # 4. 讀取新資料（使用 csv 模組正確解析）
    if not NEW_DATA_FILE.exists():
        print(f"❌ 找不到: {NEW_DATA_FILE}")
        return

    # 4.1 格式檢查
    print("🔍 檢查 new_data.txt 格式...")
    if not validate_csv_format(NEW_DATA_FILE):
        print("❌ 格式檢查未通過，建議修正後再執行")
        print("   如果要強制執行，請按 Ctrl+C 取消，或繼續執行可能會出錯\n")
        time.sleep(3)  # 給 3 秒時間讓使用者看到警告

    # 直接用 csv.reader 解析檔案（可正確處理多行 quote）
    new_records_raw = []
    with open(NEW_DATA_FILE, 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if len(row) < 2:
                continue  # 跳過空行或只有一個欄位的行

            id_val = row[0].strip()

            # 跳過註解行（整行是註解，例如：# 這是註解）
            # 但不跳過 #N/A（資料行）
            if id_val.startswith('#') and id_val not in ['#N/A', '#n/a']:
                continue

            new_records_raw.append(row)

    print(f"📥 新資料: {len(new_records_raw)} 行")

    # 5. 處理新資料
    updated_records = []
    na_parent_records = []
    na_other_records = []

    for row in new_records_raw:
        # 補齊到 7 個欄位
        while len(row) < 7:
            row.append('')

        id_val = row[0].strip()
        name = row[1].strip()
        code = row[2].strip()
        intro = row[3].strip()
        # 處理 quote：將實際換行轉為字面的 \n，移除多餘空白
        quote = row[4].strip()
        if quote:
            # 將多行合併為一行，用 \n 分隔
            quote = quote.replace('\n', '\\n')
            # 移除連續的 \n（空行）
            while '\\n\\n' in quote:
                quote = quote.replace('\\n\\n', '\\n')
        # photo 欄位：強制保持空白（不使用 new_data.txt 中的值）
        photo = ''  # 強制空白
        checkin = row[6].strip()

        # 建立基礎 record
        base_record = {field: '' for field in fieldnames}

        # 處理 #N/A
        if id_val == '#N/A' or id_val == 'N/A' or not id_val:
            new_id = get_next_na_id(existing_ids, intro)
            existing_ids.add(new_id)

            new_record = {
                **base_record,
                'id': new_id,
                'name': name,
                'code': new_id,
                'intro': intro,
                'quote': quote,
                'photo': photo,
            }

            if 'checkedIn' in fieldnames:
                new_record['checkedIn'] = 'false'
            if 'checkin' in fieldnames:
                new_record['checkin'] = checkin

            existing_data[new_id] = new_record

            # 分類記錄
            if '家長' in intro:
                na_parent_records.append(new_record)
            else:
                na_other_records.append(new_record)

            print(f"  ✅ N/A → {new_id}: {name} ({intro})")

        else:
            # 正常編號
            new_record = {
                **base_record,
                'id': id_val,
                'name': name,
                'code': code if code else id_val,
                'intro': intro,
                'quote': quote,
                'photo': photo,
            }

            if 'checkedIn' in fieldnames:
                new_record['checkedIn'] = checkin if checkin else 'false'
            if 'checkin' in fieldnames:
                new_record['checkin'] = checkin

            # 檢查是否為更新
            if id_val in existing_data:
                old_record = existing_data[id_val]
                updated_records.append((old_record, new_record))
                print(f"  🔄 更新: {id_val} - {name}")

            existing_data[id_val] = new_record
            existing_ids.add(id_val)

    # 6. 排序並寫回 data.csv
    def sort_key(record):
        id_str = record['id']
        try:
            return (0, int(id_str))
        except ValueError:
            return (1, id_str)

    sorted_data = sorted(existing_data.values(), key=sort_key)

    with open(DATA_CSV, 'w', encoding='utf-8', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(sorted_data)

    print(f"\n✅ 已更新 data.csv (總共 {len(sorted_data)} 筆)")

    # 7. 生成 Log
    with open(LOG_FILE, 'w', encoding='utf-8') as f:
        f.write(f"資料更新報告\n")
        f.write(f"執行時間: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"{'='*80}\n\n")

        f.write(f"統計:\n")
        f.write(f"  總筆數: {len(sorted_data)}\n")
        f.write(f"  更新: {len(updated_records)} 筆\n")
        f.write(f"  N/A 家長: {len(na_parent_records)} 筆\n")
        f.write(f"  N/A 其他: {len(na_other_records)} 筆\n\n")
        f.write(f"{'='*80}\n\n")

        # 更新部分
        if updated_records:
            f.write("# 更新部分:\n")
            for old, new in updated_records:
                f.write(f"{record_to_csv_line(old, fieldnames)}\n")
                f.write(f"{record_to_csv_line(new, fieldnames)}\n")
                f.write("\n")

        # N/A 家長部分
        if na_parent_records:
            f.write("# N/A部分 家長\n")
            for record in na_parent_records:
                f.write(f"{record_to_csv_line(record, fieldnames)}\n")
            f.write("\n")

        # N/A 其他部分
        if na_other_records:
            f.write("# N/A部分 其他\n")
            for record in na_other_records:
                f.write(f"{record_to_csv_line(record, fieldnames)}\n")

    print(f"📝 Log 已生成: {LOG_FILE}\n")

    # 顯示摘要
    if updated_records:
        print(f"更新了 {len(updated_records)} 筆:")
        for old, new in updated_records:
            print(f"  {new['id']} - {new['name']}")

    if na_parent_records:
        print(f"\n新增家長 {len(na_parent_records)} 筆:")
        for record in na_parent_records:
            print(f"  {record['id']} - {record['name']}")

    if na_other_records:
        print(f"\n新增其他 {len(na_other_records)} 筆:")
        for record in na_other_records:
            print(f"  {record['id']} - {record['name']}")

if __name__ == "__main__":
    try:
        process_new_data()
        print("\n✅ 處理完成！")
    except Exception as e:
        print(f"\n❌ 發生錯誤: {e}")
        import traceback
        traceback.print_exc()
