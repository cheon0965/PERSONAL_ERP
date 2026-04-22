import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from '@nestjs/common';
import type {
  CreateVehicleRequest,
  CreateVehicleFuelLogRequest,
  CreateVehicleMaintenanceLogRequest,
  UpdateVehicleRequest
} from '@personal-erp/contracts';
import {
  CategoryKind,
  CollectedTransactionStatus,
  FundingAccountStatus,
  PlanItemStatus,
  type Prisma
} from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { normalizeCaseInsensitiveText } from '../../common/utils/normalize-unique-key.util';
import {
  assertCollectedTransactionCanBeDeleted,
  assertCollectedTransactionCanBeUpdated
} from '../collected-transactions/collected-transaction-transition.policy';
import { mapCollectedTransactionTypeToLedgerTransactionCode } from '../collected-transactions/collected-transaction-type.mapper';
import { resolveManualCollectedTransactionStatus } from '../collected-transactions/manual-collected-transaction-status.policy';

type VehicleWorkspaceScope = {
  tenantId: string;
  ledgerId: string;
};

type VehicleLogAccountingLinkWrite = {
  periodId: string;
  fundingAccountId: string;
  categoryId: string | null;
};

type LinkedCollectedTransactionRecord = {
  id: string;
  matchedPlanItemId: string | null;
  status: CollectedTransactionStatus;
  postedJournalEntry: {
    id: string;
  } | null;
};

const linkedCollectedTransactionSelect = {
  id: true,
  fundingAccountId: true,
  categoryId: true,
  status: true,
  matchedPlanItemId: true,
  postedJournalEntry: {
    select: {
      id: true,
      entryNumber: true
    }
  }
} as const;

const fuelLogInclude = {
  vehicle: {
    select: {
      id: true,
      name: true
    }
  },
  linkedCollectedTransaction: {
    select: linkedCollectedTransactionSelect
  }
} as const;

const maintenanceLogInclude = {
  vehicle: {
    select: {
      id: true,
      name: true
    }
  },
  linkedCollectedTransaction: {
    select: linkedCollectedTransactionSelect
  }
} as const;

@Injectable()
export class VehiclesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAllInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findMany({
      where: { tenantId, ledgerId },
      orderBy: [{ createdAt: 'asc' }, { name: 'asc' }]
    });
  }

  findByIdInWorkspace(vehicleId: string, tenantId: string, ledgerId: string) {
    return this.prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        tenantId,
        ledgerId
      }
    });
  }

  createInWorkspace(
    userId: string,
    tenantId: string,
    ledgerId: string,
    input: CreateVehicleRequest
  ) {
    return this.prisma.vehicle.create({
      data: {
        userId,
        tenantId,
        ledgerId,
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        manufacturer: input.manufacturer,
        fuelType: input.fuelType,
        initialOdometerKm: input.initialOdometerKm,
        estimatedFuelEfficiencyKmPerLiter:
          input.estimatedFuelEfficiencyKmPerLiter,
        defaultFundingAccountId: input.defaultFundingAccountId,
        defaultFuelCategoryId: input.defaultFuelCategoryId,
        defaultMaintenanceCategoryId: input.defaultMaintenanceCategoryId,
        operatingExpensePlanOptIn: input.operatingExpensePlanOptIn ?? false
      }
    });
  }

  updateInWorkspace(vehicleId: string, input: UpdateVehicleRequest) {
    return this.prisma.vehicle.update({
      where: {
        id: vehicleId
      },
      data: {
        name: input.name,
        normalizedName: normalizeCaseInsensitiveText(input.name),
        manufacturer: input.manufacturer,
        fuelType: input.fuelType,
        initialOdometerKm: input.initialOdometerKm,
        estimatedFuelEfficiencyKmPerLiter:
          input.estimatedFuelEfficiencyKmPerLiter,
        defaultFundingAccountId: input.defaultFundingAccountId,
        defaultFuelCategoryId: input.defaultFuelCategoryId,
        defaultMaintenanceCategoryId: input.defaultMaintenanceCategoryId,
        operatingExpensePlanOptIn: input.operatingExpensePlanOptIn ?? false
      }
    });
  }

  async assertVehicleDefaultReferencesInWorkspace(input: {
    workspace: VehicleWorkspaceScope;
    defaultFundingAccountId: string | null;
    defaultFuelCategoryId: string | null;
    defaultMaintenanceCategoryId: string | null;
  }) {
    const [fundingAccount, fuelCategory, maintenanceCategory] =
      await Promise.all([
        input.defaultFundingAccountId
          ? this.prisma.account.findFirst({
              where: {
                id: input.defaultFundingAccountId,
                tenantId: input.workspace.tenantId,
                ledgerId: input.workspace.ledgerId,
                status: FundingAccountStatus.ACTIVE
              },
              select: {
                id: true
              }
            })
          : Promise.resolve(true),
        input.defaultFuelCategoryId
          ? this.prisma.category.findFirst({
              where: {
                id: input.defaultFuelCategoryId,
                tenantId: input.workspace.tenantId,
                ledgerId: input.workspace.ledgerId,
                kind: CategoryKind.EXPENSE,
                isActive: true
              },
              select: {
                id: true
              }
            })
          : Promise.resolve(true),
        input.defaultMaintenanceCategoryId
          ? this.prisma.category.findFirst({
              where: {
                id: input.defaultMaintenanceCategoryId,
                tenantId: input.workspace.tenantId,
                ledgerId: input.workspace.ledgerId,
                kind: CategoryKind.EXPENSE,
                isActive: true
              },
              select: {
                id: true
              }
            })
          : Promise.resolve(true)
      ]);

    if (input.defaultFundingAccountId && !fundingAccount) {
      throw new NotFoundException(
        '차량 기본 자금수단을 현재 워크스페이스에서 찾을 수 없습니다.'
      );
    }

    if (input.defaultFuelCategoryId && !fuelCategory) {
      throw new NotFoundException(
        '차량 연료 기본 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.'
      );
    }

    if (input.defaultMaintenanceCategoryId && !maintenanceCategory) {
      throw new NotFoundException(
        '차량 정비 기본 카테고리를 현재 워크스페이스에서 찾을 수 없습니다.'
      );
    }
  }

  findFuelLogsInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.fuelLog.findMany({
      where: {
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: fuelLogInclude,
      orderBy: [{ filledOn: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findFuelLogInWorkspace(
    fuelLogId: string,
    vehicleId: string,
    tenantId: string,
    ledgerId: string
  ) {
    return this.prisma.fuelLog.findFirst({
      where: {
        id: fuelLogId,
        vehicleId,
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: fuelLogInclude
    });
  }

  createFuelLogForVehicle(input: {
    vehicleId: string;
    vehicleName: string;
    workspace: VehicleWorkspaceScope;
    log: CreateVehicleFuelLogRequest;
    accountingLink: VehicleLogAccountingLinkWrite | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const linkedCollectedTransactionId = input.accountingLink
        ? await this.createLinkedVehicleExpenseCollectedTransactionInTx(tx, {
            workspace: input.workspace,
            businessDate: input.log.filledOn,
            amountWon: input.log.amountWon,
            title: buildFuelLogCollectedTransactionTitle(input.vehicleName),
            memo: buildFuelLogCollectedTransactionMemo(input),
            accountingLink: input.accountingLink
          })
        : null;

      return tx.fuelLog.create({
        data: {
          vehicleId: input.vehicleId,
          linkedCollectedTransactionId,
          filledOn: new Date(`${input.log.filledOn}T00:00:00.000Z`),
          odometerKm: input.log.odometerKm,
          liters: input.log.liters,
          amountWon: input.log.amountWon,
          unitPriceWon: input.log.unitPriceWon,
          isFullTank: input.log.isFullTank
        },
        include: fuelLogInclude
      });
    });
  }

  updateFuelLog(input: {
    fuelLogId: string;
    vehicleId: string;
    vehicleName: string;
    workspace: VehicleWorkspaceScope;
    log: CreateVehicleFuelLogRequest;
    accountingLink: VehicleLogAccountingLinkWrite | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fuelLog.findFirst({
        where: {
          id: input.fuelLogId,
          vehicleId: input.vehicleId,
          vehicle: {
            is: {
              tenantId: input.workspace.tenantId,
              ledgerId: input.workspace.ledgerId
            }
          }
        },
        select: {
          id: true,
          linkedCollectedTransactionId: true
        }
      });

      if (!existing) {
        throw new NotFoundException('Vehicle fuel log not found');
      }

      let linkedCollectedTransactionId =
        existing.linkedCollectedTransactionId ?? null;

      if (linkedCollectedTransactionId && input.accountingLink) {
        await this.updateLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: linkedCollectedTransactionId,
          businessDate: input.log.filledOn,
          amountWon: input.log.amountWon,
          title: buildFuelLogCollectedTransactionTitle(input.vehicleName),
          memo: buildFuelLogCollectedTransactionMemo(input),
          accountingLink: input.accountingLink
        });
      } else if (linkedCollectedTransactionId && !input.accountingLink) {
        await this.deleteLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: linkedCollectedTransactionId
        });
        linkedCollectedTransactionId = null;
      } else if (!linkedCollectedTransactionId && input.accountingLink) {
        linkedCollectedTransactionId =
          await this.createLinkedVehicleExpenseCollectedTransactionInTx(tx, {
            workspace: input.workspace,
            businessDate: input.log.filledOn,
            amountWon: input.log.amountWon,
            title: buildFuelLogCollectedTransactionTitle(input.vehicleName),
            memo: buildFuelLogCollectedTransactionMemo(input),
            accountingLink: input.accountingLink
          });
      }

      return tx.fuelLog.update({
        where: {
          id: input.fuelLogId
        },
        data: {
          linkedCollectedTransactionId,
          filledOn: new Date(`${input.log.filledOn}T00:00:00.000Z`),
          odometerKm: input.log.odometerKm,
          liters: input.log.liters,
          amountWon: input.log.amountWon,
          unitPriceWon: input.log.unitPriceWon,
          isFullTank: input.log.isFullTank
        },
        include: fuelLogInclude
      });
    });
  }

  deleteFuelLog(input: {
    fuelLogId: string;
    vehicleId: string;
    workspace: VehicleWorkspaceScope;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.fuelLog.findFirst({
        where: {
          id: input.fuelLogId,
          vehicleId: input.vehicleId,
          vehicle: {
            is: {
              tenantId: input.workspace.tenantId,
              ledgerId: input.workspace.ledgerId
            }
          }
        },
        select: {
          id: true,
          linkedCollectedTransactionId: true
        }
      });

      if (!existing) {
        throw new NotFoundException('Vehicle fuel log not found');
      }

      if (existing.linkedCollectedTransactionId) {
        await this.deleteLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: existing.linkedCollectedTransactionId
        });
      }

      await tx.fuelLog.delete({
        where: {
          id: input.fuelLogId
        }
      });
    });
  }

  findMaintenanceLogsInWorkspace(tenantId: string, ledgerId: string) {
    return this.prisma.vehicleMaintenanceLog.findMany({
      where: {
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: maintenanceLogInclude,
      orderBy: [{ performedOn: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findMaintenanceLogInWorkspace(
    maintenanceLogId: string,
    vehicleId: string,
    tenantId: string,
    ledgerId: string
  ) {
    return this.prisma.vehicleMaintenanceLog.findFirst({
      where: {
        id: maintenanceLogId,
        vehicleId,
        vehicle: {
          is: {
            tenantId,
            ledgerId
          }
        }
      },
      include: maintenanceLogInclude
    });
  }

  createMaintenanceLogForVehicle(input: {
    vehicleId: string;
    vehicleName: string;
    workspace: VehicleWorkspaceScope;
    log: CreateVehicleMaintenanceLogRequest;
    accountingLink: VehicleLogAccountingLinkWrite | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const linkedCollectedTransactionId = input.accountingLink
        ? await this.createLinkedVehicleExpenseCollectedTransactionInTx(tx, {
            workspace: input.workspace,
            businessDate: input.log.performedOn,
            amountWon: input.log.amountWon,
            title: buildMaintenanceLogCollectedTransactionTitle(
              input.vehicleName,
              input.log.description
            ),
            memo: buildMaintenanceLogCollectedTransactionMemo(input),
            accountingLink: input.accountingLink
          })
        : null;

      return tx.vehicleMaintenanceLog.create({
        data: {
          vehicleId: input.vehicleId,
          linkedCollectedTransactionId,
          performedOn: new Date(`${input.log.performedOn}T00:00:00.000Z`),
          odometerKm: input.log.odometerKm,
          category: input.log.category,
          vendor: input.log.vendor,
          description: input.log.description,
          amountWon: input.log.amountWon,
          memo: input.log.memo
        },
        include: maintenanceLogInclude
      });
    });
  }

  updateMaintenanceLog(input: {
    maintenanceLogId: string;
    vehicleId: string;
    vehicleName: string;
    workspace: VehicleWorkspaceScope;
    log: CreateVehicleMaintenanceLogRequest;
    accountingLink: VehicleLogAccountingLinkWrite | null;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleMaintenanceLog.findFirst({
        where: {
          id: input.maintenanceLogId,
          vehicleId: input.vehicleId,
          vehicle: {
            is: {
              tenantId: input.workspace.tenantId,
              ledgerId: input.workspace.ledgerId
            }
          }
        },
        select: {
          id: true,
          linkedCollectedTransactionId: true
        }
      });

      if (!existing) {
        throw new NotFoundException('Vehicle maintenance log not found');
      }

      let linkedCollectedTransactionId =
        existing.linkedCollectedTransactionId ?? null;

      if (linkedCollectedTransactionId && input.accountingLink) {
        await this.updateLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: linkedCollectedTransactionId,
          businessDate: input.log.performedOn,
          amountWon: input.log.amountWon,
          title: buildMaintenanceLogCollectedTransactionTitle(
            input.vehicleName,
            input.log.description
          ),
          memo: buildMaintenanceLogCollectedTransactionMemo(input),
          accountingLink: input.accountingLink
        });
      } else if (linkedCollectedTransactionId && !input.accountingLink) {
        await this.deleteLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: linkedCollectedTransactionId
        });
        linkedCollectedTransactionId = null;
      } else if (!linkedCollectedTransactionId && input.accountingLink) {
        linkedCollectedTransactionId =
          await this.createLinkedVehicleExpenseCollectedTransactionInTx(tx, {
            workspace: input.workspace,
            businessDate: input.log.performedOn,
            amountWon: input.log.amountWon,
            title: buildMaintenanceLogCollectedTransactionTitle(
              input.vehicleName,
              input.log.description
            ),
            memo: buildMaintenanceLogCollectedTransactionMemo(input),
            accountingLink: input.accountingLink
          });
      }

      return tx.vehicleMaintenanceLog.update({
        where: {
          id: input.maintenanceLogId
        },
        data: {
          linkedCollectedTransactionId,
          performedOn: new Date(`${input.log.performedOn}T00:00:00.000Z`),
          odometerKm: input.log.odometerKm,
          category: input.log.category,
          vendor: input.log.vendor,
          description: input.log.description,
          amountWon: input.log.amountWon,
          memo: input.log.memo
        },
        include: maintenanceLogInclude
      });
    });
  }

  deleteMaintenanceLog(input: {
    maintenanceLogId: string;
    vehicleId: string;
    workspace: VehicleWorkspaceScope;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.vehicleMaintenanceLog.findFirst({
        where: {
          id: input.maintenanceLogId,
          vehicleId: input.vehicleId,
          vehicle: {
            is: {
              tenantId: input.workspace.tenantId,
              ledgerId: input.workspace.ledgerId
            }
          }
        },
        select: {
          id: true,
          linkedCollectedTransactionId: true
        }
      });

      if (!existing) {
        throw new NotFoundException('Vehicle maintenance log not found');
      }

      if (existing.linkedCollectedTransactionId) {
        await this.deleteLinkedVehicleExpenseCollectedTransactionInTx(tx, {
          workspace: input.workspace,
          collectedTransactionId: existing.linkedCollectedTransactionId
        });
      }

      await tx.vehicleMaintenanceLog.delete({
        where: {
          id: input.maintenanceLogId
        }
      });
    });
  }

  private async createLinkedVehicleExpenseCollectedTransactionInTx(
    tx: Prisma.TransactionClient,
    input: {
      workspace: VehicleWorkspaceScope;
      businessDate: string;
      amountWon: number;
      title: string;
      memo: string | null;
      accountingLink: VehicleLogAccountingLinkWrite;
    }
  ) {
    await this.assertCollectedTransactionReferencesInWorkspace(tx, {
      workspace: input.workspace,
      fundingAccountId: input.accountingLink.fundingAccountId,
      categoryId: input.accountingLink.categoryId
    });

    if (input.amountWon <= 0) {
      throw new BadRequestException(
        '회계 연동 거래 금액은 0보다 큰 안전한 정수여야 합니다.'
      );
    }

    const ledgerTransactionTypeId = await this.findLedgerTransactionTypeIdInTx(
      tx,
      input.workspace,
      'EXPENSE'
    );

    const created = await tx.collectedTransaction.create({
      data: {
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        periodId: input.accountingLink.periodId,
        ledgerTransactionTypeId,
        fundingAccountId: input.accountingLink.fundingAccountId,
        categoryId: input.accountingLink.categoryId,
        title: input.title,
        occurredOn: new Date(`${input.businessDate}T00:00:00.000Z`),
        amount: input.amountWon,
        status: resolveManualCollectedTransactionStatus({
          type: 'EXPENSE',
          categoryId: input.accountingLink.categoryId
        }),
        memo: input.memo
      },
      select: {
        id: true
      }
    });

    return created.id;
  }

  private async updateLinkedVehicleExpenseCollectedTransactionInTx(
    tx: Prisma.TransactionClient,
    input: {
      workspace: VehicleWorkspaceScope;
      collectedTransactionId: string;
      businessDate: string;
      amountWon: number;
      title: string;
      memo: string | null;
      accountingLink: VehicleLogAccountingLinkWrite;
    }
  ) {
    await this.assertCollectedTransactionReferencesInWorkspace(tx, {
      workspace: input.workspace,
      fundingAccountId: input.accountingLink.fundingAccountId,
      categoryId: input.accountingLink.categoryId
    });

    const current = await this.findLinkedCollectedTransactionInTx(tx, {
      workspace: input.workspace,
      collectedTransactionId: input.collectedTransactionId
    });

    assertCollectedTransactionCanBeUpdated({
      postingStatus: mapCollectedTransactionPostingStatus(current.status),
      postedJournalEntryId: current.postedJournalEntry?.id ?? null
    });

    if (input.amountWon <= 0) {
      throw new BadRequestException(
        '회계 연동 거래 금액은 0보다 큰 안전한 정수여야 합니다.'
      );
    }

    const ledgerTransactionTypeId = await this.findLedgerTransactionTypeIdInTx(
      tx,
      input.workspace,
      'EXPENSE'
    );

    const result = await tx.collectedTransaction.updateMany({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        status: {
          in: [
            CollectedTransactionStatus.COLLECTED,
            CollectedTransactionStatus.REVIEWED,
            CollectedTransactionStatus.READY_TO_POST
          ]
        }
      },
      data: {
        periodId: input.accountingLink.periodId,
        ledgerTransactionTypeId,
        fundingAccountId: input.accountingLink.fundingAccountId,
        categoryId: input.accountingLink.categoryId,
        title: input.title,
        occurredOn: new Date(`${input.businessDate}T00:00:00.000Z`),
        amount: input.amountWon,
        status: resolveManualCollectedTransactionStatus({
          type: 'EXPENSE',
          categoryId: input.accountingLink.categoryId
        }),
        memo: input.memo
      }
    });

    if (result.count === 0) {
      throw new ConflictException(
        '연결된 수집거래를 현재 상태에서는 갱신할 수 없습니다.'
      );
    }
  }

  private async deleteLinkedVehicleExpenseCollectedTransactionInTx(
    tx: Prisma.TransactionClient,
    input: {
      workspace: VehicleWorkspaceScope;
      collectedTransactionId: string;
    }
  ) {
    const current = await this.findLinkedCollectedTransactionInTx(tx, input);

    assertCollectedTransactionCanBeDeleted({
      postingStatus: mapCollectedTransactionPostingStatus(current.status),
      postedJournalEntryId: current.postedJournalEntry?.id ?? null
    });

    const result = await tx.collectedTransaction.deleteMany({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId,
        status: {
          in: [
            CollectedTransactionStatus.COLLECTED,
            CollectedTransactionStatus.REVIEWED,
            CollectedTransactionStatus.READY_TO_POST
          ]
        }
      }
    });

    if (result.count === 0) {
      throw new ConflictException(
        '연결된 수집거래를 현재 상태에서는 삭제할 수 없습니다.'
      );
    }

    if (current.matchedPlanItemId) {
      await tx.planItem.update({
        where: {
          id: current.matchedPlanItemId
        },
        data: {
          status: PlanItemStatus.DRAFT
        }
      });
    }
  }

  private async findLinkedCollectedTransactionInTx(
    tx: Prisma.TransactionClient,
    input: {
      workspace: VehicleWorkspaceScope;
      collectedTransactionId: string;
    }
  ): Promise<LinkedCollectedTransactionRecord> {
    const current = await tx.collectedTransaction.findFirst({
      where: {
        id: input.collectedTransactionId,
        tenantId: input.workspace.tenantId,
        ledgerId: input.workspace.ledgerId
      },
      select: {
        id: true,
        matchedPlanItemId: true,
        status: true,
        postedJournalEntry: {
          select: {
            id: true
          }
        }
      }
    });

    if (!current) {
      throw new NotFoundException('Collected transaction not found');
    }

    return current;
  }

  private async assertCollectedTransactionReferencesInWorkspace(
    tx: Prisma.TransactionClient,
    input: {
      workspace: VehicleWorkspaceScope;
      fundingAccountId: string;
      categoryId: string | null;
    }
  ) {
    const [fundingAccount, category] = await Promise.all([
      tx.account.findFirst({
        where: {
          id: input.fundingAccountId,
          tenantId: input.workspace.tenantId,
          ledgerId: input.workspace.ledgerId
        },
        select: {
          id: true
        }
      }),
      input.categoryId
        ? tx.category.findFirst({
            where: {
              id: input.categoryId,
              tenantId: input.workspace.tenantId,
              ledgerId: input.workspace.ledgerId
            },
            select: {
              id: true
            }
          })
        : Promise.resolve(true)
    ]);

    if (!fundingAccount) {
      throw new NotFoundException('선택한 자금수단을 찾을 수 없습니다.');
    }

    if (input.categoryId && !category) {
      throw new NotFoundException('선택한 카테고리를 찾을 수 없습니다.');
    }
  }

  private async findLedgerTransactionTypeIdInTx(
    tx: Prisma.TransactionClient,
    workspace: VehicleWorkspaceScope,
    type: 'EXPENSE'
  ) {
    const ledgerTransactionType = await tx.ledgerTransactionType.findFirst({
      where: {
        tenantId: workspace.tenantId,
        ledgerId: workspace.ledgerId,
        code: mapCollectedTransactionTypeToLedgerTransactionCode(type),
        isActive: true
      },
      select: {
        id: true
      }
    });

    if (!ledgerTransactionType) {
      throw new BadRequestException(
        '차량 운영비를 연결할 기본 거래유형을 찾을 수 없습니다.'
      );
    }

    return ledgerTransactionType.id;
  }
}

function buildFuelLogCollectedTransactionTitle(vehicleName: string) {
  return `${vehicleName} 연료비`;
}

function buildFuelLogCollectedTransactionMemo(input: {
  log: CreateVehicleFuelLogRequest;
}) {
  return [
    `${input.log.liters.toFixed(3).replace(/0+$/u, '').replace(/\.$/u, '')}L`,
    `단가 ${input.log.unitPriceWon}원`,
    `주행거리 ${input.log.odometerKm}km`,
    input.log.isFullTank ? '가득 주유' : '부분 주유'
  ].join(' / ');
}

function buildMaintenanceLogCollectedTransactionTitle(
  vehicleName: string,
  description: string
) {
  const normalizedDescription = description.trim();
  return normalizedDescription.length > 0
    ? `${vehicleName} 정비비 · ${normalizedDescription}`
    : `${vehicleName} 정비비`;
}

function buildMaintenanceLogCollectedTransactionMemo(input: {
  log: CreateVehicleMaintenanceLogRequest;
}) {
  return [
    input.log.description,
    input.log.vendor ? `정비처 ${input.log.vendor}` : null,
    `주행거리 ${input.log.odometerKm}km`,
    input.log.memo ?? null
  ]
    .filter((value): value is string => Boolean(value))
    .join(' / ');
}

function mapCollectedTransactionPostingStatus(
  status: CollectedTransactionStatus
) {
  switch (status) {
    case CollectedTransactionStatus.COLLECTED:
      return 'COLLECTED' as const;
    case CollectedTransactionStatus.READY_TO_POST:
      return 'READY_TO_POST' as const;
    case CollectedTransactionStatus.POSTED:
      return 'POSTED' as const;
    case CollectedTransactionStatus.CORRECTED:
      return 'CORRECTED' as const;
    case CollectedTransactionStatus.LOCKED:
      return 'LOCKED' as const;
    case CollectedTransactionStatus.REVIEWED:
    default:
      return 'REVIEWED' as const;
  }
}
