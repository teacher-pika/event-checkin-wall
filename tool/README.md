# tool/ — 輔助工具 / Helper Scripts

## update_data.py

把零散、格式不一的新名單批次合併進專案根目錄的 `data.csv`。
Batch-merge a messy new participant list into the project-root `data.csv`.

### 中文說明

**用途**：自動清理格式（多餘換行、缺逗號）、為 `#N/A` 自動分配編號（家長→8XXX、其他→9XXX）、更新或新增資料、依編號排序，並自動備份。

**使用步驟**（於專案根目錄執行）：

```bash
# 1. 把新名單貼到根目錄的 new_data.txt（格式見 new_data.sample.txt）
# 2. 執行
python tool/update_data.py
```

**輸入 / 輸出**（皆位於專案根目錄）：

| 檔案 | 說明 |
|---|---|
| `new_data.txt` | 輸入：待合併的新名單 |
| `data.csv` | 會被更新（執行前自動備份到 `backup/`） |
| `backup/data_YYYYMMDD_HHMMSS.csv` | 自動備份 |
| `data_update_log.txt` | 更新報告 |

> ⚠️ `new_data.txt`、`data.csv`、`backup/`、`data_update_log.txt` 皆含個資，已被 `.gitignore` 排除，不會上 git。

### English

Cleans formatting, auto-assigns IDs to `#N/A` rows (parents → 8XXX, others → 9XXX),
updates/adds entries, sorts by ID, and backs up `data.csv` before writing.
Run from the project root: `python tool/update_data.py`. It reads `new_data.txt`
and writes `data.csv` (with a timestamped backup in `backup/`) — all in the project root.
