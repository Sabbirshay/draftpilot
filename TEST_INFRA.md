# E2E Test Infra: DraftPilot Super Admin & Auth Hardening

## Test Philosophy
- Opaque-box, requirement-driven. Derived strictly from `ORIGINAL_REQUEST.md` and `PROJECT.md`.
- Methodology: Category-Partition + Boundary Value Analysis (BVA) + Pairwise Combinatorial Testing + Real-World Workload Testing.

## Feature Inventory
| # | Feature | Source (requirement) | Tier 1 (Min 5) | Tier 2 (Min 5) | Tier 3 (Pairwise) | Tier 4 (Real World) |
|---|---------|---------------------|:--------------:|:--------------:|:-----------------:|:-------------------:|
| F1-F4 | User Deletion, Ban Registry, Gateway Interception & 1-Click Restore | ORIGINAL_REQUEST R1 | 5 | 5 | ✓ | ✓ |
| F5-F8 | Root Passkey Vault, Dynamic Resolution & In-Panel Updater | ORIGINAL_REQUEST R2 | 5 | 5 | ✓ | ✓ |
| F9-F12 | Mandatory Email Verification, Banner, Login Block & Resend Flow | ORIGINAL_REQUEST R3 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- Test Runner: Node 22 native test runner (`node --experimental-strip-types --test`) and Jest for API.
- Test Files Location: `packages/web/src/lib/__tests__/` and `packages/api/src/`
- Command to run all tests: `pnpm test`
- Pass/Fail Semantics: Exit code 0, 100% tests passing, zero uncaught errors.

## Coverage Thresholds
- **Tier 1 (Feature Coverage)**: >=5 test cases per major feature area (15+ total).
- **Tier 2 (Boundary & Corner Cases)**: >=5 test cases per feature area covering case sensitivity, empty inputs, token expiry, multi-tenant boundaries (15+ total).
- **Tier 3 (Cross-Feature Combinations)**: Pairwise interactions (e.g., banned user attempts password reset, passkey update during active admin session, unverified user attempting AI generation).
- **Tier 4 (Real-World Application Scenarios)**: Realistic end-to-end admin lifecycle and user registration journeys.
- **Tier 5 (Adversarial Coverage Hardening)**: Security stress testing, bypass attempts, timing attack resilience, RLS isolation verification.
