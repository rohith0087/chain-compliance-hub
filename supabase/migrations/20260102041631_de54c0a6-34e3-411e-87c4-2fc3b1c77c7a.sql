-- Enable REPLICA IDENTITY FULL for better realtime tracking of read receipts
ALTER TABLE communication_messages REPLICA IDENTITY FULL;
ALTER TABLE message_read_receipts REPLICA IDENTITY FULL;