import { describe, expect, it } from 'vitest';
import {
  checkTransition,
  isDeliveryStep,
  OrderStatus,
  orderStatusFromDeliveries,
} from './delivery.rules.js';

const { processing, in_transit, delivered, cancelled } = OrderStatus;

describe('checkTransition', () => {
  it.each([
    [processing, in_transit],
    [in_transit, delivered],
    [processing, delivered],
  ])('allows %s -> %s (forward, one or more steps)', (from, to) => {
    expect(checkTransition(from, to)).toEqual({ allowed: true });
  });

  it.each([
    [in_transit, processing],
    [delivered, in_transit],
    [delivered, processing],
  ])('refuses going back from %s to %s', (from, to) => {
    const result = checkTransition(from, to);

    expect(result.allowed).toBe(false);
    expect(result).toMatchObject({ reason: expect.stringContaining('back') });
  });

  it.each([processing, in_transit, delivered])(
    'refuses setting the same status %s again',
    (status) => {
      const result = checkTransition(status, status);

      expect(result).toMatchObject({
        allowed: false,
        reason: expect.stringContaining('already'),
      });
    },
  );

  it.each([processing, in_transit, delivered])(
    'refuses cancelling a %s delivery',
    (from) => {
      expect(checkTransition(from, cancelled)).toMatchObject({
        allowed: false,
        reason: expect.stringContaining('cancelled'),
      });
    },
  );

  it('refuses to move a delivery that is already cancelled', () => {
    expect(checkTransition(cancelled, delivered)).toMatchObject({
      allowed: false,
      reason: expect.stringContaining('can no longer change'),
    });
  });
});

describe('isDeliveryStep', () => {
  it('accepts the three steps and refuses cancelled and other values', () => {
    expect(isDeliveryStep('processing')).toBe(true);
    expect(isDeliveryStep('in_transit')).toBe(true);
    expect(isDeliveryStep('delivered')).toBe(true);
    expect(isDeliveryStep('cancelled')).toBe(false);
    expect(isDeliveryStep('shipped')).toBe(false);
    expect(isDeliveryStep(undefined)).toBe(false);
  });
});

describe('orderStatusFromDeliveries', () => {
  it('is the status of the least advanced delivery row', () => {
    expect(orderStatusFromDeliveries([delivered, processing])).toBe(processing);
    expect(orderStatusFromDeliveries([delivered, in_transit])).toBe(in_transit);
    expect(orderStatusFromDeliveries([in_transit, processing, delivered])).toBe(
      processing,
    );
    expect(orderStatusFromDeliveries([in_transit, in_transit])).toBe(
      in_transit,
    );
  });

  it('is delivered only when every row is delivered', () => {
    expect(orderStatusFromDeliveries([delivered])).toBe(delivered);
    expect(orderStatusFromDeliveries([delivered, delivered])).toBe(delivered);
    expect(orderStatusFromDeliveries([delivered, in_transit])).not.toBe(
      delivered,
    );
  });

  it('ignores cancelled rows, and is cancelled when nothing else is left', () => {
    expect(orderStatusFromDeliveries([delivered, cancelled])).toBe(delivered);
    expect(orderStatusFromDeliveries([cancelled, processing])).toBe(processing);
    expect(orderStatusFromDeliveries([cancelled, cancelled])).toBe(cancelled);
  });

  it('has no status for an order without delivery rows', () => {
    expect(orderStatusFromDeliveries([])).toBeNull();
  });
});
