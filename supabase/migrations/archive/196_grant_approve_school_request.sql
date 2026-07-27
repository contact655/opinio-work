-- Migration 196: approve_school_request 関数に EXECUTE 権限を付与
-- 原因: 関数が PUBLIC REVOKE 状態で authenticated / service_role から呼び出し不可
-- 効果: /admin/school-requests での承認ボタンが動作するようになる

GRANT EXECUTE ON FUNCTION approve_school_request(uuid, text, text, uuid)
  TO authenticated, service_role;
