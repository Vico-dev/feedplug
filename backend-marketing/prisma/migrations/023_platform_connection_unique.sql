-- One connection per (account, platform) so GMC callback upsert works
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformConnection_account_platform_key"
ON "PlatformConnection"("accountid", "platform");
