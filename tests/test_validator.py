"""Unit tests for the data-quality validation layer (scraper/validator.py).

Covers the record-level gate used before DB insertion: required-field
enforcement, title/URL quality flags, and salary/location normalization.
Pure-Python — no DB or browser needed, so these run anywhere (incl. CI).
"""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scraper"))

from validator import normalize_location, normalize_salary, validate


def make_job(**overrides):
    """A minimal valid job record; override fields per test."""
    job = {
        "title": "Data Engineer",
        "company": "Acme Corp",
        "source": "Naukri",
        "location": "Bengaluru",
        "salary": "4-6 LPA",
        "skills": "Python\nSQL",
        "job_url": "https://example.com/job/123",
    }
    job.update(overrides)
    return job


# ---------- required-field gate ----------

class TestRequiredFields:
    def test_valid_record_passes(self):
        is_valid, issues = validate(make_job())
        assert is_valid
        assert issues == []

    @pytest.mark.parametrize("field", ["title", "company", "source"])
    def test_missing_required_field_discards_record(self, field):
        is_valid, issues = validate(make_job(**{field: ""}))
        assert not is_valid
        assert f"missing_required:{field}" in issues

    @pytest.mark.parametrize("bad", ["", "N/A", "None", "   "])
    def test_placeholder_values_count_as_missing(self, bad):
        is_valid, issues = validate(make_job(title=bad))
        assert not is_valid

    def test_multiple_missing_fields_all_reported(self):
        is_valid, issues = validate(make_job(title="", company="N/A"))
        assert not is_valid
        assert "missing_required:title" in issues
        assert "missing_required:company" in issues


# ---------- quality warnings (record kept, issue logged) ----------

class TestQualityWarnings:
    def test_short_title_flagged_but_kept(self):
        is_valid, issues = validate(make_job(title="QA"))
        assert is_valid
        assert "title_too_short" in issues

    def test_html_in_title_flagged(self):
        is_valid, issues = validate(make_job(title="Engineer <b>urgent</b>"))
        assert is_valid
        assert "title_contains_html" in issues

    def test_invalid_url_flagged_and_blanked(self):
        job = make_job(job_url="not-a-url")
        is_valid, issues = validate(job)
        assert is_valid
        assert "invalid_url" in issues
        assert job["job_url"] == ""

    def test_https_url_accepted(self):
        is_valid, issues = validate(make_job())
        assert "invalid_url" not in issues


# ---------- salary normalization ----------

class TestNormalizeSalary:
    @pytest.mark.parametrize("raw", ["", "N/A", "Not disclosed", "Not Disclosed", None])
    def test_empty_or_placeholder_becomes_not_disclosed(self, raw):
        assert normalize_salary(raw) == "Not disclosed"

    @pytest.mark.parametrize("raw", ["4-6 LPA", "₹ 4,00,000", "50,000 per month"])
    def test_recognized_formats_kept_as_is(self, raw):
        assert normalize_salary(raw) == raw

    def test_html_stripped_from_unrecognized(self):
        assert normalize_salary("<span>Competitive</span>") == "Competitive"

    def test_only_html_becomes_not_disclosed(self):
        assert normalize_salary("<br/>") == "Not disclosed"


# ---------- location normalization ----------

class TestNormalizeLocation:
    @pytest.mark.parametrize("raw", ["", "N/A", None])
    def test_empty_becomes_not_specified(self, raw):
        assert normalize_location(raw) == "Not specified"

    def test_whitespace_collapsed(self):
        assert normalize_location("Bengaluru,\n   Karnataka") == "Bengaluru, Karnataka"

    def test_clean_value_untouched(self):
        assert normalize_location("Mumbai") == "Mumbai"


# ---------- normalization applied during validate ----------

class TestValidateNormalizes:
    def test_salary_and_location_normalized_in_place(self):
        job = make_job(salary="N/A", location="Pune \n Maharashtra", skills="  SQL  ")
        validate(job)
        assert job["salary"] == "Not disclosed"
        assert job["location"] == "Pune Maharashtra"
        assert job["skills"] == "SQL"
