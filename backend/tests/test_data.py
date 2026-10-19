import csv
from pathlib import Path
import pytest
from wellness.data import DatasetError, load_dataset

ROOT = Path(__file__).resolve().parents[1]


def changed_csv(tmp_path, mutate):
    with (ROOT / 'data/student_wellness.csv').open() as stream:
        reader = csv.DictReader(stream)
        names, rows = reader.fieldnames, list(reader)
    mutate(names, rows)
    path = tmp_path / 'changed.csv'
    with path.open('w', newline='') as stream:
        writer = csv.DictWriter(stream, fieldnames=names)
        writer.writeheader()
        writer.writerows(rows)
    return path


def test_original_data_audit():
    x, y, report = load_dataset(ROOT / 'data/student_wellness.csv', 'drop')
    assert report['raw_rows'] == 5000
    assert report['invalid_reasons']['invalid_feature_values'] == 10
    assert report['invalid_reasons']['conflicting_duplicate_features'] > 0
    assert report['duplicates_removed'] == 2
    assert x.shape == (report['valid_rows'], 12)
    assert len(y) == report['valid_rows']
    assert report['valid_rows'] + report['invalid_rows'] + report['duplicates_removed'] == 5000
    assert (float(y.min()), float(y.max())) == (3.6, 9.4)


def test_invalid_original_requires_explicit_policy():
    with pytest.raises(DatasetError, match='explicitly'):
        load_dataset(ROOT / 'data/student_wellness.csv')


def test_missing_columns(tmp_path):
    path = changed_csv(tmp_path, lambda names, rows: (names.remove('Age'), [row.pop('Age') for row in rows]))
    with pytest.raises(DatasetError, match='exactly'):
        load_dataset(path, 'drop')


@pytest.mark.parametrize('field,value,reason', [
    ('Age', '', 'missing_or_malformed_values'),
    ('Age', 'eighteen', 'invalid_numeric_types'),
    ('Age', '18.5', 'noninteger_counts'),
    ('Sleep_Hours_Per_Night', 'NaN', 'nonfinite_numeric_values'),
    ('Study_Hours', 'inf', 'nonfinite_numeric_values'),
    ('Gender', 'Unknown', 'invalid_feature_values'),
    ('Daily_Unlocks', '-1', 'invalid_feature_values'),
])
def test_invalid_values_are_audited_not_clipped(tmp_path, field, value, reason):
    path = changed_csv(tmp_path, lambda _names, rows: rows[0].update({field: value}))
    _, _, report = load_dataset(path, 'drop')
    assert report['invalid_reasons'][reason] >= 1
    with pytest.raises(DatasetError):
        load_dataset(path)


def test_conflicting_duplicate_features_excluded(tmp_path):
    def mutate(_names, rows):
        row = dict(rows[0]); row['Mental_Health_Score'] = '123'
        rows.append(row)
    path = changed_csv(tmp_path, mutate)
    _, _, report = load_dataset(path, 'drop')
    assert report['invalid_reasons']['conflicting_duplicate_features'] >= 2
