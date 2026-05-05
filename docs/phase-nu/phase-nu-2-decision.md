# Phase ν-2 完了記録 — 既存データ削除による終了

**完了日**: 2026-05-05
**判断**: 移行ではなく DELETE による終了

## 削除対象
- ow_threads: 4 件
- ow_messages: 10 件

## 判断根拠
1. 全 4 thread が同一 candidate_id (4a0decfa-...) → seed データと判定
2. 企業名(Salesforce / Ubie / LayerX / freee)が動作確認用
3. status / sender_type の分散が UI 状態網羅テスト的
4. 移行コスト > 価値:
   - ID 体系変換 (auth.users.id → ow_users.id)
   - sender_type='system' に対応するロールが新スキーマに不在
   - ow_threads の非正規化カラム(company_name/last_message/unread_count)
     を新スキーマ(正規化)に再構成する必要
   - A-1 制約(UNIQUE NULLS NOT DISTINCT)との整合確認

## バックアップ
- /Users/hisato/opinio-work/docs/backups/ow_threads_backup_2026-05-05.txt
- 念のため git 管理外に保管

## 旧テーブル本体の DROP
- Phase ν-7 で実施予定(v11 §4-3 参照)
- 対象: ow_threads, ow_messages
- 同時に確認: ow_casual_meetings, ow_mentor_reservations は新スキーマで
  conversation_id カラムを保持して継続使用するため DROP しない

## 次フェーズ
Phase ν-3(求職者側 UI)へ
