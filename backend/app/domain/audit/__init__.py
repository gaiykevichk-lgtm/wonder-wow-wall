"""Audit bounded context — Phase 9.

Records every critical admin action in an append-only log so an
incident can be reconstructed (who, what, when, against whom). The
write path is synchronous on purpose: a missing audit row is worse
than a slow request, and Postgres-indexed inserts are cheap (<5 ms in
the DoD). The read path is admin-only and paginated.

Modelled as a separate bounded context (not a sub-domain of `user`)
because the audit log spans every other context — wiring it under one
makes the dependency arrow point the wrong way.
"""
