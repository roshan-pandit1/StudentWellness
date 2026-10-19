# Reference dataset

`student_wellness.csv` is an unmodified download of `Student Social Media And Mental Health Impact.csv` at commit `6a3111bf6dcd8a2d858a3c6377b35702c8453627` of https://github.com/tanishq-latent/Mental-Health-Score.

The exact URL, retrieval date, and SHA-256 are recorded in `provenance.json`. Training checks that checksum before fitting. No dataset or target values were fabricated.

5,000 source rows contain 10 negative physical-activity values, 2 exact duplicates, and 10 rows belonging to 5 groups with identical feature vectors but conflicting targets. The explicit `--invalid-policy drop` policy removes all conflicting group members and invalid rows, and deduplicates identical records before splitting. It does not clip values, change targets, or silently recode categories. Final sample: 4,978 rows. Strict mode (default) rejects this source until the operator explicitly chooses the documented exclusion policy.

Observed target values range from 3.6 to 9.4. The README and notebook do not establish how that target was generated, its theoretical scale, an assessment instrument, participant recruitment, consent, or clinical validity. This is not evidence of a validated mental-health measure. Originating country names and demographic categories are not proof of a representative sample. Dataset licensing was not established; review redistribution and use rights before public distribution or deployment.
