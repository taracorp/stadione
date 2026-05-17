-- Allow voucher-covered transactions in venue_payments.
-- Supports zero-amount payment rows for fully covered voucher/benefit cases.

alter table if exists venue_payments
  drop constraint if exists venue_payments_method_check;

alter table if exists venue_payments
  add constraint venue_payments_method_check
  check (method in ('cash', 'qris', 'transfer', 'split', 'doku', 'voucher_full', 'free_voucher'));

alter table if exists venue_payments
  drop constraint if exists venue_payments_amount_check;

alter table if exists venue_payments
  add constraint venue_payments_amount_check
  check (
    amount >= 0
    and (
      amount > 0
      or method in ('voucher_full', 'free_voucher')
    )
  );
