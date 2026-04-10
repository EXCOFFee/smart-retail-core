/**
 * ============================================================================
 * SMART_RETAIL - Transaction Entity Tests
 * ============================================================================
 * Tests unitarios para la entidad Transaction.
 * 
 * Por qué: Transaction es el corazón del sistema (Critical Path).
 * ============================================================================
 */

import { Transaction, TransactionStatus } from '../../../src/domain/entities/transaction.entity';
import { Money } from '../../../src/domain/value-objects/money.value-object';

describe('Transaction Entity', () => {
  const createTransaction = (overrides = {}) => {
    return new Transaction({
      id: 'txn-123',
      userId: 'user-001',
      deviceId: 'device-001',
      productId: 'prod-001',
      locationId: 'loc-001',
      amount: Money.fromCents(1000),
      quantity: 1,
      traceId: 'trace-abc123',
      ...overrides,
    });
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CREACIÓN
  // ─────────────────────────────────────────────────────────────────────────

  describe('Creation', () => {
    it('should create a transaction with all properties', () => {
      const txn = createTransaction();

      expect(txn.id).toBe('txn-123');
      expect(txn.userId).toBe('user-001');
      expect(txn.deviceId).toBe('device-001');
      expect(txn.productId).toBe('prod-001');
      expect(txn.locationId).toBe('loc-001');
      expect(txn.amount.cents).toBe(1000);
      expect(txn.quantity).toBe(1);
      expect(txn.traceId).toBe('trace-abc123');
    });

    it('should default to PENDING status', () => {
      const txn = createTransaction();
      expect(txn.status).toBe(TransactionStatus.PENDING);
    });

    it('should allow null productId for access-only transactions', () => {
      const txn = createTransaction({ productId: null });
      expect(txn.productId).toBeNull();
    });

    it('should default quantity to 1', () => {
      const txn = new Transaction({
        id: 'txn-123',
        userId: 'user-001',
        deviceId: 'device-001',
        locationId: 'loc-001',
        amount: Money.fromCents(1000),
        traceId: 'trace-abc123',
      });
      expect(txn.quantity).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Status Transitions', () => {
    it('should mark as paid', () => {
      const txn = createTransaction();
      txn.markPaid({
        externalId: 'mp-123',
        gateway: 'MERCADOPAGO',
        method: 'card',
      });

      expect(txn.status).toBe(TransactionStatus.PAID);
      expect(txn.paymentInfo.externalId).toBe('mp-123');
      expect(txn.paymentInfo.gateway).toBe('MERCADOPAGO');
    });

    it('should mark as completed from PAID', () => {
      const txn = createTransaction();
      txn.markPaid({
        externalId: 'mp-123',
        gateway: 'MERCADOPAGO',
        method: 'card',
      });
      txn.markCompleted();

      expect(txn.status).toBe(TransactionStatus.COMPLETED);
      expect(txn.completedAt).toBeInstanceOf(Date);
    });

    it('should mark as completed from PENDING (access-only)', () => {
      const txn = createTransaction();
      txn.markCompleted();

      expect(txn.status).toBe(TransactionStatus.COMPLETED);
    });

    it('should mark as failed', () => {
      const txn = createTransaction();
      txn.markFailed('REJECTED', 'Payment rejected');

      expect(txn.status).toBe(TransactionStatus.FAILED);
      expect(txn.paymentInfo.responseMessage).toBe('Payment rejected');
    });

    it('should mark as refunded for hardware failure', () => {
      const txn = createTransaction();
      txn.markPaid({
        externalId: 'mp-123',
        gateway: 'MERCADOPAGO',
        method: 'card',
      });
      txn.markRefundedHardwareFailure();

      expect(txn.status).toBe(TransactionStatus.REFUNDED_HW_FAILURE);
    });

    it('should mark as cancelled', () => {
      const txn = createTransaction();
      txn.markCancelled();

      expect(txn.status).toBe(TransactionStatus.CANCELLED);
    });

    it('should mark as expired', () => {
      const txn = createTransaction();
      txn.markExpired();

      expect(txn.status).toBe(TransactionStatus.EXPIRED);
    });

    it('should throw on invalid transition', () => {
      const txn = createTransaction();
      txn.markCompleted(); // Now COMPLETED

      expect(() => txn.markCancelled()).toThrow('Invalid transaction state transition');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // STATUS CHECKS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Status Checks', () => {
    it('should identify terminal transactions', () => {
      const pendingTxn = createTransaction({ status: TransactionStatus.PENDING });
      const completedTxn = createTransaction({ status: TransactionStatus.COMPLETED });
      const failedTxn = createTransaction({ status: TransactionStatus.FAILED });

      expect(pendingTxn.isTerminal()).toBe(false);
      expect(completedTxn.isTerminal()).toBe(true);
      expect(failedTxn.isTerminal()).toBe(true);
    });

    it('should identify paid transactions', () => {
      const paidTxn = createTransaction({ status: TransactionStatus.PAID });
      const completedTxn = createTransaction({ status: TransactionStatus.COMPLETED });
      const pendingTxn = createTransaction({ status: TransactionStatus.PENDING });

      expect(paidTxn.isPaid()).toBe(true);
      expect(completedTxn.isPaid()).toBe(true);
      expect(pendingTxn.isPaid()).toBe(false);
    });

    it('should identify refundable transactions', () => {
      const paidTxn = createTransaction({ status: TransactionStatus.PAID });
      const completedTxn = createTransaction({ status: TransactionStatus.COMPLETED });

      expect(paidTxn.isRefundable()).toBe(true);
      expect(completedTxn.isRefundable()).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // PAYMENT INFO
  // ─────────────────────────────────────────────────────────────────────────

  describe('Payment Info', () => {
    it('should initialize with null payment info fields', () => {
      const txn = createTransaction();
      
      expect(txn.paymentInfo.externalId).toBeNull();
      expect(txn.paymentInfo.gateway).toBeNull();
      expect(txn.paymentInfo.method).toBeNull();
    });

    it('should preserve payment info on status changes', () => {
      const txn = createTransaction();
      txn.markPaid({
        externalId: 'mp-123',
        gateway: 'MERCADOPAGO',
        method: 'card',
      });
      txn.markCompleted();

      expect(txn.paymentInfo.externalId).toBe('mp-123');
      expect(txn.paymentInfo.gateway).toBe('MERCADOPAGO');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // ADDITIONAL STATE TRANSITIONS
  // ─────────────────────────────────────────────────────────────────────────

  describe('Additional State Transitions', () => {
    it('should mark as in process from pending', () => {
      const txn = createTransaction({ status: TransactionStatus.PENDING });

      txn.markInProcess();

      expect(txn.status).toBe(TransactionStatus.IN_PROCESS);
    });

    it('should mark as refunded manual from PAID', () => {
      const txn = createTransaction({ status: TransactionStatus.PENDING });
      txn.markPaid({
        externalId: 'mp-456',
        gateway: 'MODO',
        method: 'qr',
      });

      txn.markRefundedManual();

      expect(txn.status).toBe(TransactionStatus.REFUNDED_MANUAL);
    });

    it('should mark as refunded manual from COMPLETED', () => {
      const txn = createTransaction({ status: TransactionStatus.PENDING });
      txn.markPaid({
        externalId: 'mp-789',
        gateway: 'MERCADOPAGO',
        method: 'card',
      });
      txn.markCompleted();

      txn.markRefundedManual();

      expect(txn.status).toBe(TransactionStatus.REFUNDED_MANUAL);
    });

    it('should throw when marking in process from non-pending state', () => {
      const txn = createTransaction({ status: TransactionStatus.PENDING });
      txn.markCompleted();

      expect(() => txn.markInProcess()).toThrow('Invalid transaction state transition');
    });

    it('should mark failed from in process', () => {
      const txn = createTransaction({ status: TransactionStatus.PENDING });
      txn.markInProcess();

      txn.markFailed('TIMEOUT', 'Payment timeout');

      expect(txn.status).toBe(TransactionStatus.FAILED);
      expect(txn.paymentInfo.responseCode).toBe('TIMEOUT');
    });
  });
});
