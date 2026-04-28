CREATE INDEX `plan_item_collect_match_idx` ON `PlanItem`(
  `periodId`,
  `status`,
  `plannedAmount`,
  `fundingAccountId`,
  `ledgerTransactionTypeId`,
  `plannedDate`
);

CREATE INDEX `ctx_collect_match_idx` ON `CollectedTransaction`(
  `periodId`,
  `amount`,
  `fundingAccountId`,
  `ledgerTransactionTypeId`,
  `status`,
  `occurredOn`
);
