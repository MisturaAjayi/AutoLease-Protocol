(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-DURATION u101)
(define-constant ERR-INVALID-RENT u102)
(define-constant ERR-INVALID-DEPOSIT u103)
(define-constant ERR-INVALID-GRACE-PERIOD u104)
(define-constant ERR-INVALID-STATE u105)
(define-constant ERR-LEASE-ALREADY-EXISTS u106)
(define-constant ERR-LEASE-NOT-FOUND u107)
(define-constant ERR-INVALID-START-TIME u108)
(define-constant ERR-AUTHORITY-NOT-SET u109)
(define-constant ERR-INVALID-PENALTY-RATE u110)
(define-constant ERR-INVALID-MAX-RENEWS u111)
(define-constant ERR-UPDATE-NOT-ALLOWED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-MAX-LEASES-EXCEEDED u114)
(define-constant ERR-INVALID-LEASE-TYPE u115)
(define-constant ERR-INVALID-TERMINATION-FEE u116)
(define-constant ERR-INVALID-RENEWAL-THRESHOLD u117)
(define-constant ERR-INVALID-LOCATION u118)
(define-constant ERR-INVALID-CURRENCY u119)
(define-constant ERR-INVALID-STATUS u120)
(define-constant ERR-INTEGRATION-NOT-VERIFIED u121)
(define-constant ERR-INVALID-PARTY u122)
(define-constant ERR-LEASE-EXPIRED u123)
(define-constant ERR-DISPUTE-ALREADY-FILED u124)
(define-constant ERR-NO-DISPUTE u125)

(define-data-var next-lease-id uint u0)
(define-data-var max-leases uint u10000)
(define-data-var creation-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var payment-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var escrow-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var verifier-contract principal 'SP000000000000000000002Q6VF78)
(define-data-var arbiter-contract principal 'SP000000000000000000002Q6VF78)

(define-map leases
  uint
  {
    landlord: principal,
    tenant: principal,
    duration: uint,
    rent-amount: uint,
    deposit-amount: uint,
    grace-period: uint,
    start-time: uint,
    state: (string-ascii 20),
    lease-type: (string-ascii 20),
    penalty-rate: uint,
    max-renews: uint,
    renew-count: uint,
    termination-fee: uint,
    renewal-threshold: uint,
    location: (string-utf8 100),
    currency: (string-ascii 10),
    last-payment-time: uint,
    end-time: (optional uint),
    dispute-filed: bool
  }
)

(define-map leases-by-location
  (string-utf8 100)
  (list 100 uint)
)

(define-map lease-updates
  uint
  {
    update-duration: uint,
    update-rent: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-lease (id uint))
  (map-get? leases id)
)

(define-read-only (get-lease-updates (id uint))
  (map-get? lease-updates id)
)

(define-read-only (is-lease-active (id uint))
  (match (map-get? leases id)
    lease (is-eq (get state lease) "active")
    false
  )
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
    (ok true)
    (err ERR-NOT-AUTHORIZED)
  )
)

(define-private (validate-duration (dur uint))
  (if (and (> dur u0) (<= dur u3650))
    (ok true)
    (err ERR-INVALID-DURATION)
  )
)

(define-private (validate-rent (amount uint))
  (if (> amount u0)
    (ok true)
    (err ERR-INVALID-RENT)
  )
)

(define-private (validate-deposit (amount uint))
  (if (>= amount u0)
    (ok true)
    (err ERR-INVALID-DEPOSIT)
  )
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
    (ok true)
    (err ERR-INVALID-GRACE-PERIOD)
  )
)

(define-private (validate-start-time (ts uint))
  (if (>= ts block-height)
    (ok true)
    (err ERR-INVALID-START-TIME)
  )
)

(define-private (validate-lease-type (typ (string-ascii 20)))
  (if (or (is-eq typ "residential") (is-eq typ "commercial") (is-eq typ "short-term"))
    (ok true)
    (err ERR-INVALID-LEASE-TYPE)
  )
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u100)
    (ok true)
    (err ERR-INVALID-PENALTY-RATE)
  )
)

(define-private (validate-max-renews (max uint))
  (if (<= max u10)
    (ok true)
    (err ERR-INVALID-MAX-RENEWS)
  )
)

(define-private (validate-termination-fee (fee uint))
  (if (>= fee u0)
    (ok true)
    (err ERR-INVALID-TERMINATION-FEE)
  )
)

(define-private (validate-renewal-threshold (thresh uint))
  (if (and (> thresh u0) (<= thresh u100))
    (ok true)
    (err ERR-INVALID-RENEWAL-THRESHOLD)
  )
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
    (ok true)
    (err ERR-INVALID-LOCATION)
  )
)

(define-private (validate-currency (cur (string-ascii 10)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
    (ok true)
    (err ERR-INVALID-CURRENCY)
  )
)

(define-private (validate-party (p principal))
  (if (not (is-eq p tx-sender))
    (ok true)
    (err ERR-INVALID-PARTY)
  )
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-leases (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-LEASES-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set max-leases new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (set-payment-contract (contract principal))
  (begin
    (try! (validate-principal contract))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set payment-contract contract)
    (ok true)
  )
)

(define-public (set-escrow-contract (contract principal))
  (begin
    (try! (validate-principal contract))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set escrow-contract contract)
    (ok true)
  )
)

(define-public (set-verifier-contract (contract principal))
  (begin
    (try! (validate-principal contract))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set verifier-contract contract)
    (ok true)
  )
)

(define-public (set-arbiter-contract (contract principal))
  (begin
    (try! (validate-principal contract))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set arbiter-contract contract)
    (ok true)
  )
)

(define-public (create-lease
  (landlord principal)
  (tenant principal)
  (duration uint)
  (rent-amount uint)
  (deposit-amount uint)
  (grace-period uint)
  (start-time uint)
  (lease-type (string-ascii 20))
  (penalty-rate uint)
  (max-renews uint)
  (termination-fee uint)
  (renewal-threshold uint)
  (location (string-utf8 100))
  (currency (string-ascii 10))
)
  (let (
    (next-id (var-get next-lease-id))
    (current-max (var-get max-leases))
    (authority (var-get authority-contract))
  )
    (asserts! (< next-id current-max) (err ERR-MAX-LEASES-EXCEEDED))
    (try! (validate-duration duration))
    (try! (validate-rent rent-amount))
    (try! (validate-deposit deposit-amount))
    (try! (validate-grace-period grace-period))
    (try! (validate-start-time start-time))
    (try! (validate-lease-type lease-type))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-max-renews max-renews))
    (try! (validate-termination-fee termination-fee))
    (try! (validate-renewal-threshold renewal-threshold))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-party landlord))
    (try! (validate-party tenant))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-SET))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set leases next-id
      {
        landlord: landlord,
        tenant: tenant,
        duration: duration,
        rent-amount: rent-amount,
        deposit-amount: deposit-amount,
        grace-period: grace-period,
        start-time: start-time,
        state: "pending",
        lease-type: lease-type,
        penalty-rate: penalty-rate,
        max-renews: max-renews,
        renew-count: u0,
        termination-fee: termination-fee,
        renewal-threshold: renewal-threshold,
        location: location,
        currency: currency,
        last-payment-time: u0,
        end-time: none,
        dispute-filed: false
      }
    )
    (map-set leases-by-location location (cons next-id (default-to (list) (map-get? leases-by-location location))))
    (var-set next-lease-id (+ next-id u1))
    (print { event: "lease-created", id: next-id })
    (ok next-id)
  )
)

(define-public (activate-lease (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "pending") (err ERR-INVALID-STATE))
    (asserts! (is-eq tx-sender (get tenant lease)) (err ERR-NOT-AUTHORIZED))
    (asserts! (>= block-height (get start-time lease)) (err ERR-INVALID-START-TIME))
    (map-set leases lease-id (merge lease { state: "active", last-payment-time: block-height }))
    (print { event: "lease-activated", id: lease-id })
    (ok true)
  )
)

(define-public (end-lease (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "active") (err ERR-INVALID-STATE))
    (asserts! (or (is-eq tx-sender (get landlord lease)) (is-eq tx-sender (get tenant lease))) (err ERR-NOT-AUTHORIZED))
    (let ((calculated-end (+ (get start-time lease) (get duration lease))))
      (asserts! (>= block-height calculated-end) (err ERR-LEASE-EXPIRED))
      (map-set leases lease-id (merge lease { state: "ended", end-time: (some block-height) }))
      (print { event: "lease-ended", id: lease-id })
      (ok true)
    )
  )
)

(define-public (file-dispute (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "ended") (err ERR-INVALID-STATE))
    (asserts! (is-eq tx-sender (get landlord lease)) (err ERR-NOT-AUTHORIZED))
    (asserts! (not (get dispute-filed lease)) (err ERR-DISPUTE-ALREADY-FILED))
    (let ((grace-end (+ (unwrap! (get end-time lease) (err ERR-INVALID-STATE)) (get grace-period lease))))
      (asserts! (<= block-height grace-end) (err ERR-LEASE-EXPIRED))
      (map-set leases lease-id (merge lease { state: "disputed", dispute-filed: true }))
      (print { event: "dispute-filed", id: lease-id })
      (ok true)
    )
  )
)

(define-public (resolve-dispute (lease-id uint) (resolved-state (string-ascii 20)))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "disputed") (err ERR-INVALID-STATE))
    (asserts! (is-eq tx-sender (var-get arbiter-contract)) (err ERR-NOT-AUTHORIZED))
    (asserts! (or (is-eq resolved-state "resolved-refund") (is-eq resolved-state "resolved-deduct")) (err ERR-INVALID-STATUS))
    (map-set leases lease-id (merge lease { state: resolved-state }))
    (print { event: "dispute-resolved", id: lease-id, resolution: resolved-state })
    (ok true)
  )
)

(define-public (renew-lease (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "active") (err ERR-INVALID-STATE))
    (asserts! (is-eq tx-sender (get tenant lease)) (err ERR-NOT-AUTHORIZED))
    (asserts! (< (get renew-count lease) (get max-renews lease)) (err ERR-INVALID-MAX-RENEWS))
    (let ((end-time (unwrap! (get end-time lease) (err ERR-INVALID-STATE))))
      (asserts! (<= (- end-time block-height) (get renewal-threshold lease)) (err ERR-INVALID-RENEWAL-THRESHOLD))
      (map-set leases lease-id
        (merge lease
          {
            duration: (+ (get duration lease) (get duration lease)),
            end-time: (some (+ end-time (get duration lease))),
            renew-count: (+ (get renew-count lease) u1)
          }
        )
      )
      (print { event: "lease-renewed", id: lease-id })
      (ok true)
    )
  )
)

(define-public (update-lease
  (lease-id uint)
  (new-duration uint)
  (new-rent uint)
)
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "pending") (err ERR-UPDATE-NOT-ALLOWED))
    (asserts! (is-eq tx-sender (get landlord lease)) (err ERR-NOT-AUTHORIZED))
    (try! (validate-duration new-duration))
    (try! (validate-rent new-rent))
    (map-set leases lease-id
      (merge lease
        {
          duration: new-duration,
          rent-amount: new-rent
        }
      )
    )
    (map-set lease-updates lease-id
      {
        update-duration: new-duration,
        update-rent: new-rent,
        update-timestamp: block-height,
        updater: tx-sender
      }
    )
    (print { event: "lease-updated", id: lease-id })
    (ok true)
  )
)

(define-public (record-payment (lease-id uint) (payment-time uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq (get state lease) "active") (err ERR-INVALID-STATE))
    (asserts! (is-eq tx-sender (var-get payment-contract)) (err ERR-NOT-AUTHORIZED))
    (asserts! (> payment-time (get last-payment-time lease)) (err ERR-INVALID-START-TIME))
    (map-set leases lease-id (merge lease { last-payment-time: payment-time }))
    (print { event: "payment-recorded", id: lease-id })
    (ok true)
  )
)

(define-public (get-lease-count)
  (ok (var-get next-lease-id))
)

(define-public (get-leases-by-location (loc (string-utf8 100)))
  (ok (default-to (list) (map-get? leases-by-location loc)))
)

(define-public (integrate-with-escrow (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get escrow-contract)) (err ERR-INTEGRATION-NOT-VERIFIED))
    (ok true)
  )
)

(define-public (integrate-with-verifier (lease-id uint))
  (let ((lease (unwrap! (map-get? leases lease-id) (err ERR-LEASE-NOT-FOUND))))
    (asserts! (is-eq tx-sender (var-get verifier-contract)) (err ERR-INTEGRATION-NOT-VERIFIED))
    (ok true)
  )
)