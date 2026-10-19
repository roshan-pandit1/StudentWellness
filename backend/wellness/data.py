"""Strict CSV validation with explicit, auditable row exclusion; no imputation/clipping."""
from __future__ import annotations

import csv
import hashlib
import math
from collections import Counter
from pathlib import Path
from typing import Literal
import numpy as np
from pydantic import ValidationError
from .contracts import AssessmentRequest, FEATURES, NUMERIC, TARGET


class DatasetError(ValueError):
    pass


def load_dataset(path: Path, invalid_policy: Literal['error', 'drop'] = 'error'):
    if invalid_policy not in ('error', 'drop'):
        raise DatasetError('invalid_policy must be error or drop')
    raw = path.read_bytes()
    with path.open(encoding='utf-8-sig', newline='') as stream:
        reader = csv.DictReader(stream)
        expected = FEATURES + [TARGET]
        if reader.fieldnames is None or len(reader.fieldnames) != len(expected) or set(reader.fieldnames) != set(expected):
            raise DatasetError('CSV must contain exactly the 12 feature columns and Mental_Health_Score.')
        rows = list(reader)
    valid, targets = [], []
    issues, duplicates, seen = Counter(), 0, {}
    conflicts = set()
    for row in rows:
        try:
            if None in row or any(value is None or not value.strip() for value in row.values()):
                raise DatasetError('missing_or_malformed_values')
            converted = {name: row[name] for name in FEATURES}
            for name in NUMERIC + [TARGET]:
                number = float(row[name])
                if not math.isfinite(number):
                    raise DatasetError('nonfinite_numeric_values')
                if name in ('Age', 'Daily_Unlocks'):
                    if not number.is_integer():
                        raise DatasetError('noninteger_counts')
                    number = int(number)
                if name != TARGET:
                    converted[name] = number
                else:
                    target = number
            # Do not silently normalize categorical values or infer missing identities.
            AssessmentRequest.model_validate(converted)
            feature_row = tuple(converted[name] for name in FEATURES)
            if feature_row in seen:
                if seen[feature_row] != target:
                    conflicts.add(feature_row)
                    raise DatasetError('conflicting_duplicate_features')
                duplicates += 1
                continue
            seen[feature_row] = target
            valid.append(feature_row)
            targets.append(target)
        except ValidationError:
            issues['invalid_feature_values'] += 1
        except DatasetError as exc:
            issues[str(exc)] += 1
        except (TypeError, ValueError):
            issues['invalid_numeric_types'] += 1
    # Remove the first occurrence too: conflicting targets must not depend on file order.
    keep = [index for index, row in enumerate(valid) if row not in conflicts]
    issues['conflicting_duplicate_features'] += len(valid) - len(keep)
    valid, targets = [valid[index] for index in keep], [targets[index] for index in keep]
    issues = Counter({key: count for key, count in issues.items() if count})
    report = {'raw_rows': len(rows), 'valid_rows': len(valid), 'invalid_rows': sum(issues.values()),
              'invalid_reasons': dict(issues), 'duplicates_removed': duplicates,
              'invalid_policy': invalid_policy, 'sha256': hashlib.sha256(raw).hexdigest()}
    if issues and invalid_policy == 'error':
        raise DatasetError(f'Dataset contains invalid rows: {dict(issues)}. Review before explicitly selecting --invalid-policy drop.')
    if len(valid) < 50 or len(set(targets)) < 2:
        raise DatasetError('At least 50 valid independent rows and a varying target are required.')
    return np.asarray(valid, dtype=object), np.asarray(targets, dtype=float), report
