-- Remove the retired legacy Transaction table after the application no longer
-- exposes the temporary Prisma bridge model.
DROP TABLE `Transaction`;
