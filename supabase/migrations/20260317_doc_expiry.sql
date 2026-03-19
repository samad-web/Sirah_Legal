-- Feature 13: Document Expiry Alerts
alter table documents
  add column if not exists expiry_date date;
