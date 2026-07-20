-- pro_messages 에 실제 응답 모델 기록용 컬럼 추가.
-- 어시스턴트 메시지에만 채워지며(사용자 메시지는 null), 채팅 UI 에서 관리자에게만 배지로 표시.
-- 서버사이드 폴백 시에는 실제 응답한 모델(예: fable 거부 → opus)이 저장된다.

alter table public.pro_messages
  add column if not exists model text;
