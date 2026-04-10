/**
 * ============================================================================
 * SMART_RETAIL - Insufficient Balance Exception
 * ============================================================================
 * Se lanza cuando un usuario intenta una operación sin saldo suficiente.
 * 
 * Mapeo HTTP: 402 Payment Required
 * Caso de Uso: CU-02 (Rechazo por Fondos Insuficientes)
 * ============================================================================
 */

import { DomainException } from './domain.exception';

export class InsufficientBalanceException extends DomainException {
  readonly code = 'INSUFFICIENT_BALANCE';
  readonly httpStatus = 402; // Payment Required

  readonly userId: string;
  readonly currentBalance: number;
  readonly requiredAmount: number;

  constructor(
    userId: string,
    currentBalance: number,
    requiredAmount: number,
  ) {
    super(
      `User ${userId} has insufficient balance. Current: ${currentBalance}, Required: ${requiredAmount}`,
      {
        userId,
        currentBalance,
        requiredAmount,
        deficit: requiredAmount - currentBalance,
      },
    );

    this.userId = userId;
    this.currentBalance = currentBalance;
    this.requiredAmount = requiredAmount;
  }
}
