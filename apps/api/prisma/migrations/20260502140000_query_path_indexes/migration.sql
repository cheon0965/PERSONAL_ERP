CREATE INDEX `wae_tenant_result_occurred_idx` ON `WorkspaceAuditEvent`(
  `tenantId`,
  `result`,
  `occurredAt`
);

CREATE INDEX `ste_user_occurred_idx` ON `SecurityThreatEvent`(
  `userId`,
  `occurredAt`
);

CREATE INDEX `ib_tenant_ledger_uploaded_idx` ON `ImportBatch`(
  `tenantId`,
  `ledgerId`,
  `uploadedAt`
);

CREATE INDEX `ctx_tenant_ledger_occurred_created_idx` ON `CollectedTransaction`(
  `tenantId`,
  `ledgerId`,
  `occurredOn`,
  `createdAt`
);

CREATE INDEX `je_tenant_ledger_entry_created_idx` ON `JournalEntry`(
  `tenantId`,
  `ledgerId`,
  `entryDate`,
  `createdAt`
);
