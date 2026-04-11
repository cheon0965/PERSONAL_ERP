ALTER TABLE `UserSetting`
  MODIFY `minimumReserveWon` DECIMAL(19, 0) NOT NULL DEFAULT 400000,
  MODIFY `monthlySinkingFundWon` DECIMAL(19, 0) NOT NULL DEFAULT 140000;

ALTER TABLE `Account`
  MODIFY `balanceWon` DECIMAL(19, 0) NOT NULL DEFAULT 0;

ALTER TABLE `Transaction`
  MODIFY `amountWon` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `RecurringRule`
  MODIFY `amountWon` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `PlanItem`
  MODIFY `plannedAmount` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `CollectedTransaction`
  MODIFY `amount` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `JournalLine`
  MODIFY `debitAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0,
  MODIFY `creditAmount` DECIMAL(19, 0) NOT NULL DEFAULT 0;

ALTER TABLE `ClosingSnapshot`
  MODIFY `totalAssetAmount` DECIMAL(19, 0) NOT NULL,
  MODIFY `totalLiabilityAmount` DECIMAL(19, 0) NOT NULL,
  MODIFY `totalEquityAmount` DECIMAL(19, 0) NOT NULL,
  MODIFY `periodPnLAmount` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `BalanceSnapshotLine`
  MODIFY `balanceAmount` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `InsurancePolicy`
  MODIFY `monthlyPremiumWon` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `Vehicle`
  MODIFY `monthlyExpenseWon` DECIMAL(19, 0) NOT NULL DEFAULT 0;

ALTER TABLE `FuelLog`
  MODIFY `amountWon` DECIMAL(19, 0) NOT NULL,
  MODIFY `unitPriceWon` DECIMAL(19, 0) NOT NULL;

ALTER TABLE `VehicleMaintenanceLog`
  MODIFY `amountWon` DECIMAL(19, 0) NOT NULL;
