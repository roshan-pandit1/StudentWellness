# Trained experimental artifact

`model.joblib` was fitted locally on the pinned reference CSV, not downloaded as an executable model from a third party. `metadata.json` contains its SHA-256, package versions, dataset provenance, training-code digest, split details, support ranges, candidate cross-validation results, held-out metrics, and limitations.

The API checks integrity, versions, and feature contracts before using this artifact. Only load trusted operator-controlled files: joblib/pickle deserialization can execute code. A checksum is not a signature and cannot make an attacker-controlled artifact plus metadata safe.

Retrain with `python -m wellness.train --invalid-policy drop` from `backend/`. Deploy both files together, on a read-only filesystem, and restart the API to load a changed model. Keep package versions identical; retrain and regenerate fixtures when upgrading dependencies. The pipeline is fitted only on the training partition; the held-out set is not folded back into the exported model.
