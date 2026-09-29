;; kola-pot
;; Community pots on Stacks. Open a goal, friends chip in STX,
;; the opener claims the pot once the goal is met.
;; Anyone can pull their own chips back until the pot is claimed.

(define-constant ERR_NOT_FOUND (err u100))
(define-constant ERR_TITLE (err u101))
(define-constant ERR_STORY (err u102))
(define-constant ERR_ZERO (err u103))
(define-constant ERR_CLAIMED (err u104))
(define-constant ERR_NOT_OWNER (err u105))
(define-constant ERR_GOAL (err u106))
(define-constant ERR_NOTHING (err u107))
(define-constant ERR_MATH (err u108))
(define-constant ERR_XFER (err u109))

(define-data-var next-id uint u0)

(define-map pots
  uint
  {
    creator: principal,
    title: (string-utf8 64),
    story: (string-utf8 180),
    goal: uint,
    raised: uint,
    claimed: bool,
    backers: uint,
    opened: uint,
  }
)

(define-map contributions
  { pot-id: uint, who: principal }
  uint
)

(define-read-only (get-next-id)
  (var-get next-id)
)

(define-read-only (get-pot (id uint))
  (map-get? pots id)
)

(define-read-only (get-contribution (id uint) (who principal))
  (default-to u0 (map-get? contributions { pot-id: id, who: who }))
)

(define-public (open-pot (title (string-utf8 64)) (story (string-utf8 180)) (goal uint))
  (let ((id (+ (var-get next-id) u1)))
    (asserts! (> (len title) u0) ERR_TITLE)
    (asserts! (> (len story) u0) ERR_STORY)
    (asserts! (> goal u0) ERR_ZERO)
    (map-set pots id {
      creator: tx-sender,
      title: title,
      story: story,
      goal: goal,
      raised: u0,
      claimed: false,
      backers: u0,
      opened: stacks-block-height,
    })
    (var-set next-id id)
    (print { event: "open", id: id, creator: tx-sender, goal: goal })
    (ok id)
  )
)

(define-public (chip-in (id uint) (amount uint))
  (let (
    (pot (unwrap! (map-get? pots id) ERR_NOT_FOUND))
    (prev (default-to u0 (map-get? contributions { pot-id: id, who: tx-sender })))
  )
    (asserts! (not (get claimed pot)) ERR_CLAIMED)
    (asserts! (> amount u0) ERR_ZERO)
    (try! (stx-transfer? amount tx-sender current-contract))
    (map-set contributions { pot-id: id, who: tx-sender } (+ prev amount))
    (map-set pots id (merge pot {
      raised: (+ (get raised pot) amount),
      backers: (if (is-eq prev u0) (+ (get backers pot) u1) (get backers pot)),
    }))
    (print { event: "chip", id: id, who: tx-sender, amount: amount })
    (ok (+ (get raised pot) amount))
  )
)

(define-public (claim (id uint))
  (let (
    (pot (unwrap! (map-get? pots id) ERR_NOT_FOUND))
    (creator (get creator pot))
    (raised (get raised pot))
  )
    (asserts! (is-eq tx-sender creator) ERR_NOT_OWNER)
    (asserts! (not (get claimed pot)) ERR_CLAIMED)
    (asserts! (>= raised (get goal pot)) ERR_GOAL)
    (map-set pots id (merge pot { claimed: true }))
    (try! (as-contract? ((with-stx raised))
      (unwrap! (stx-transfer? raised tx-sender creator) ERR_XFER)
      true
    ))
    (print { event: "claim", id: id, amount: raised })
    (ok raised)
  )
)

(define-public (pull-out (id uint))
  (let (
    (sender tx-sender)
    (pot (unwrap! (map-get? pots id) ERR_NOT_FOUND))
    (key { pot-id: id, who: sender })
    (amount (unwrap! (map-get? contributions key) ERR_NOTHING))
  )
    (asserts! (not (get claimed pot)) ERR_CLAIMED)
    (asserts! (> amount u0) ERR_ZERO)
    (asserts! (>= (get raised pot) amount) ERR_MATH)
    (map-delete contributions key)
    (map-set pots id (merge pot {
      raised: (- (get raised pot) amount),
      backers: (if (> (get backers pot) u0) (- (get backers pot) u1) u0),
    }))
    (try! (as-contract? ((with-stx amount))
      (unwrap! (stx-transfer? amount tx-sender sender) ERR_XFER)
      true
    ))
    (print { event: "pull", id: id, who: sender, amount: amount })
    (ok amount)
  )
)
