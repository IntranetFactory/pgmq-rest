export type Bindings = {
  DATABASE_URL: string;
};

export type IdRow = [string];

export type MessageRow = [string, number, string, string, unknown, unknown]; // msg_id, read_ct, enqueued_at, vt, message, headers

export type BooleanRow = [boolean];

export type QueueRow = [string, boolean, boolean, string]; // queue_name, is_partitioned, is_unlogged, created_at

export type MetricRow = [string, string, number | null, number | null, string, string]; // queue_name, queue_length, newest_msg_age_sec, oldest_msg_age_sec, total_messages, scrape_time
