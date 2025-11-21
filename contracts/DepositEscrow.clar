(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-LEASE-NOT-FOUND u101)
(define-constant ERR-INVALID-AMOUNT u102)
(define-constant ERR-DEPOSIT-LOCKED u103)
(define-constant ERR-DEPOSIT-REFUNDED u104)
(define-constant ERR-DISPUTE-ACTIVE u105)
(define-constant ERR-GRACE-PERIOD-NOT-OVER u106)
(define-constant ERR-INVALID-STATE u107)
(define-constant ERR-INSUFFICIENT-BALANCE u108)
(define-constant ERR-DISPUTE-NOT-ACTIVE u109)
(define-constant ERR-ALREADY-CLAIMED u110)

(define-constant GRACE-PERIOD-BLOCKS u1008) ;; ~7 days on Stacks (10-min blocks)

(define-map leases
  uint
  {
    landlord: principal,
    tenant: principal,
    deposit-amount: uint,
    locked-at: uint,
    lease-end-block: uint,
    refunded: bool,
    dispute-filed: bool,
    dispute-filed-at: (optional uint),
    claimed-by-landlord: bool
  }
)

(define-data-var next-lease-id uint u1)

(define-read-only (get-lease (lease-id uint))
  (map-get? leases lease-id)
)

(define-read-only (get-next-lease-id)
  (var-get next-lease-id)
)

(define-public (initialize-lease
    (lease-id uint)
    (landlord principal)
    (tenant principal)
    (deposit-amount uint)
    (lease-duration-blocks uint))
  (let ((current-id (var-get next-lease-id)))
    (asserts! (is-eq lease-id current-id) (err ERR-INVALID-STATE))
    (asserts! (> deposit-amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (> lease-duration-blocks u0) (err ERR-INVALID-AMOUNT))
    (map-set leases lease-id
      {
        landlord: landlord,
        tenant: tenant,
        deposit-amount: deposit-amount,
        locked-at: block-height,
        lease-end-block: (+ block-height lease-duration-blocks),
        refunded: false,
        dispute-filed: false,
        dispute-filed-at: none,
        claimed-by-landlord: false
      }
    )
    (var-set next-lease-id (+ current-id u1))
    (ok lease-id)
  )
)

(define-public (lock-deposit (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND)))
        (amount (get deposit-amount lease)))
    (asserts! (is-eq tx-sender (get tenant lease)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get refunded lease)) (err ERR-DEPOSIT-REFUNDED))
    (asserts! (not (get dispute-filed lease)) (err ERR-DISPUTE-ACTIVE))
    (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
    (ok true)
  )
)

(define-public (file-dispute (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (or (is-eq tx-sender (get landlord lease)) (is-eq tx-sender (get tenant lease))) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= block-height (get lease-end-block lease)) (err ERR-INVALID-STATE))
    (asserts! (not (get dispute-filed lease)) (err ERR-DISPUTE-ACTIVE))
    (asserts! (not (get refunded lease)) (err ERR-DEPOSIT-REFUNDED))
    (map-set leases lease-id
      (merge lease {
        dispute-filed: true,
        dispute-filed-at: (some block-height)
      })
    )
    (ok true)
  )
)

(define-public (refund-deposit (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND)))
        (amount (get deposit-amount lease)))
    (asserts! (not (get refunded lease)) (err ERR-DEPOSIT-REFUNDED))
    (asserts! (not (get claimed-by-landlord lease)) (err ERR-ALREADY-CLAIMED))
    (if (get dispute-filed lease)
      (let ((dispute-at (unwrap! (get dispute-filed-at lease) (err ERR-DISPUTE-NOT-ACTIVE))))
        (asserts! (>= block-height (+ dispute-at GRACE-PERIOD-BLOCKS)) (err ERR-GRACE-PERIOD-NOT-OVER))
        true)
      (asserts! (>= block-height (get lease-end-block lease)) (err ERR-INVALID-STATE))
    )
    (map-set leases lease-id (merge lease { refunded: true }))
    (as-contract (stx-transfer? amount tx-sender (get tenant lease)))
  )
)

(define-public (claim-damages (lease-id uint) (amount uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND)))
        (contract-balance (stx-get-balance (as-contract tx-sender))))
    (asserts! (is-eq tx-sender (get landlord lease)) (err ERR-NOT-AUTHORIZED))
    (asserts! (get dispute-filed lease) (err ERR-DISPUTE-NOT-ACTIVE))
    (asserts! (not (get claimed-by-landlord lease)) (err ERR-ALREADY-CLAIMED))
    (asserts! (not (get refunded lease)) (err ERR-DEPOSIT-REFUNDED))
    (asserts! (<= amount (get deposit-amount lease)) (err ERR-INVALID-AMOUNT))
    (asserts! (>= contract-balance amount) (err ERR-INSUFFICIENT-BALANCE))
    (let ((remaining (- (get deposit-amount lease) amount)))
      (map-set leases lease-id
        (merge lease {
          claimed-by-landlord: true,
          refunded: (if (is-eq remaining u0) true false)
        })
      )
      (try! (as-contract (stx-transfer? amount tx-sender (get landlord lease))))
      (if (> remaining u0)
        (as-contract (stx-transfer? remaining tx-sender (get tenant lease)))
        (ok true))
    )
  )
)

(define-public (emergency-withdraw (amount uint))
  (begin
    (asserts! (is-eq tx-sender (contract-owner)) (err ERR-NOT-AUTHORIZED))
    (as-contract (stx-transfer? amount tx-sender tx-sender))
  )
)